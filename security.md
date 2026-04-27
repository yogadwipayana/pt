# Security Audit

## Scope
- `main/`: frontend Next.js for Dwipa website/settings
- `ai/`: backend/dashboard + OpenAI-compatible API/router

## Findings

### P0 — Web API key route missing auth and ownership checks
- File: `ai/src/app/api/keys/[id]/route.js:29`
- File: `ai/src/app/api/keys/[id]/route.js:59`
- File: `ai/src/app/api/keys/[id]/route.js:102`
- Issue: the route reads, updates, and deletes `web_*` API keys directly with Prisma and does not verify the caller session or key ownership.
- Impact: anyone who can guess or obtain a `web_<id>` value may read key metadata, revoke keys, or delete keys.
- Recommendation: require authenticated session and verify `userId` ownership before all read/update/delete operations.

### P0 — Hardcoded fallback secrets for auth/session signing
- File: `ai/src/lib/web/auth/facade.js:150`
- File: `ai/src/app/api/auth/login/route.js:7`
- File: `ai/src/dashboardGuard.js:5`
- Issue: auth/session signing falls back to static development secrets when env vars are unset.
- Impact: if deployed without proper secret configuration, attackers can forge session cookies or JWTs.
- Recommendation: fail fast on startup when required secrets are missing; never use production-capable fallback secrets.

### P0 — Weak dashboard protection model on localhost/default password
- File: `ai/src/dashboardGuard.js:67`
- File: `ai/src/app/api/auth/login/route.js:28`
- Issue: sensitive dashboard API paths are allowed when request is considered localhost; login also accepts default password `123456` when no password has been configured.
- Impact: local exposure, reverse-proxy mistakes, or local malware/userland abuse can grant unauthorized access to sensitive settings and keys.
- Recommendation: remove implicit localhost trust for sensitive routes, require explicit auth, and force password setup before enabling dashboard access.

### P1 — Sensitive provider connection data exposed by client sync route
- File: `ai/src/app/api/providers/client/route.js:4`
- Issue: the route returns provider connection objects including sensitive fields and documents that they are intentionally exposed for sync, but the route itself has no route-level auth check.
- Impact: if middleware/guard assumptions break, secrets may be exposed in bulk.
- Recommendation: enforce auth and authorization inside the route, and return only the minimum fields required.

### P2 — OTP disclosure in non-production flows
- File: `ai/src/lib/web/auth/facade.js:122`
- Issue: when OTP delivery fails in non-production, the OTP is returned in `debugOtp` and may also be logged.
- Impact: debug behavior can leak verification codes in logs/responses in staging or misconfigured environments.
- Recommendation: gate this behind an explicit debug flag and avoid logging live OTP values.

### P1 — Password reset flow stores raw reset token and appears unthrottled
- File: `ai/src/lib/web/auth/facade.js:386`
- File: `ai/src/app/api/web/v1/auth/password/forgot/route.js:5`
- File: `ai/src/app/api/web/v1/auth/password/reset/route.js:5`
- Issue: password reset challenges store `betterAuthRef` as the raw reset token, unlike sign-up OTP which is hashed, and the web auth routes do not appear to apply rate limiting or cooldown checks.
- Impact: database disclosure would immediately expose active reset tokens, and the endpoints may be more vulnerable to brute force, spam, or account recovery abuse.
- Recommendation: hash reset tokens before storage, add per-email/IP rate limiting and cooldown, and return uniform responses.

### P1 — OAuth authorize route trusts arbitrary `returnTo`
- File: `ai/src/app/api/web/v1/auth/oauth/[provider]/authorize/route.js:29`
- Issue: `returnTo` is taken from query params and passed as `callbackURL` without visible allowlist validation.
- Impact: depending on Better Auth behavior, this may enable open redirect or post-auth flow abuse.
- Recommendation: restrict `returnTo` to same-site allowlisted URLs or map it to safe internal routes.

### P2 — Web auth endpoints do not appear to use the existing rate-limit helper
- File: `ai/src/lib/web/http/rateLimit.js:10`
- Issue: rate-limit and cooldown helpers exist, but no usage was found under `ai/src/app/api/web/v1` for sign-in, sign-up, OTP, or password-reset routes.
- Impact: authentication endpoints may be exposed to credential stuffing, OTP brute force, resend spam, and reset abuse.
- Recommendation: apply per-IP and per-identity rate limits to all auth-sensitive endpoints.

## Additional Deep Findings

### P0 — Cloud worker exposes unauthenticated open proxy / SSRF
- File: `ai/cloud/src/index.js:202`
- File: `ai/cloud/src/index.js:210`
- File: `ai/cloud/src/handlers/forward.js:8`
- File: `ai/cloud/src/handlers/forwardRaw.js:3`
- Issue: `/forward` and `/forward-raw` accept user-supplied `targetUrl` without authentication or strict allowlisting. `forward-raw` can open raw TCP sockets to arbitrary host:port.
- Impact: full SSRF/open-proxy capability, including access attempts to internal services, metadata endpoints, arbitrary external targets, and possible port scanning/abuse relay.
- Recommendation: remove these endpoints from production or require strong auth plus strict destination allowlists and private-address blocking.

### P0 — Cloud sync API appears unauthenticated and stores provider secrets
- File: `ai/cloud/src/index.js:97`
- File: `ai/cloud/src/handlers/sync.js:12`
- File: `ai/cloud/src/handlers/sync.js:67`
- Issue: `/sync/:machineId` supports GET/POST/DELETE without strong auth and stores/returns sensitive provider fields such as tokens and API keys.
- Impact: if `machineId` is known or guessable, an attacker may exfiltrate, overwrite, or delete synced machine secrets.
- Recommendation: require authenticated machine credentials, encrypt secrets at rest, and never expose full secret material in normal read responses.

### P0 — Password reset is brute-forceable and token design is weak
- File: `ai/src/lib/web/auth/facade.js:386`
- File: `ai/src/lib/web/auth/facade.js:408`
- File: `ai/src/lib/web/repos/authChallengesRepo.js:26`
- Issue: reset uses a 6-digit numeric token as the sole authenticator, stores it effectively in plaintext, and does not require a challenge-bound verifier such as `challengeId + token`.
- Impact: practical account takeover via brute force or token collision across pending reset challenges.
- Recommendation: use long random reset tokens, store only hashes, bind verification to the specific challenge/user, and enforce strict rate/attempt limits.

### P1 — Sign-up OTP verification is brute-forceable
- File: `ai/src/lib/web/auth/facade.js:310`
- File: `ai/src/app/api/web/v1/auth/otp/verify/route.js:6`
- Issue: 6-digit OTP verification has no failed-attempt counter, lockout, cooldown, or route-level throttling.
- Impact: attackers with a valid `challengeId` can brute-force email verification and potentially obtain a session.
- Recommendation: add per-challenge and per-IP limits and invalidate challenges after a small number of failures.

### P1 — Cookie-authenticated web routes appear to lack CSRF protection
- File: `ai/src/app/api/web/v1/me/keys/route.js:13`
- File: `ai/src/app/api/web/v1/me/keys/[keyId]/route.js:5`
- File: `ai/src/app/api/web/v1/auth/logout/route.js:5`
- File: `ai/src/proxy.js:22`
- Issue: state-changing cookie-authenticated routes do not show CSRF token checks or strict Origin/Referer validation.
- Impact: cross-site authenticated actions may be possible depending on browser/cookie behavior.
- Recommendation: add CSRF tokens or strict Origin/Referer enforcement on all non-GET cookie-authenticated routes.

### P1 — Tunnel control APIs do not appear covered by auth guard
- File: `ai/src/proxy.js:54`
- File: `ai/src/app/api/tunnel/enable/route.js:6`
- File: `ai/src/app/api/tunnel/disable/route.js:4`
- File: `ai/src/app/api/tunnel/tailscale-enable/route.js:4`
- File: `ai/src/app/api/tunnel/tailscale-install/route.js:18`
- Issue: `/api/tunnel/*` routes are not included in the auth proxy matcher and perform privileged local exposure/tunnel operations.
- Impact: remote callers may be able to alter tunnel state, expose services, or trigger privileged local operations.
- Recommendation: protect all tunnel routes with explicit authz and local-admin checks.

### P1 — Compatible provider validation/model fetch can become SSRF with secret-bearing requests
- File: `ai/src/app/api/providers/validate/route.js:21`
- File: `ai/src/app/api/providers/[id]/models/route.js:185`
- Issue: user/admin-controlled provider base URLs are used for outbound fetches without clear SSRF restrictions against private or metadata destinations.
- Impact: if an attacker can influence provider config, they may coerce the server into sending authenticated requests to arbitrary destinations and leak provider credentials.
- Recommendation: validate destination URLs strictly, disallow private/link-local/metadata hosts, and constrain protocols/ports.

### P1 — Payment destination endpoint under `/me` lacks auth
- File: `ai/src/app/api/web/v1/me/billing/payment-destination/route.js:4`
- File: `ai/src/lib/web/billing/manualPayments.js:14`
- Issue: active payment destination details appear retrievable without `requireWebSession()`.
- Impact: operational billing destination data can be scraped or abused even though the route is namespaced like a private user endpoint.
- Recommendation: require session auth or move it to an explicitly public route with minimized output.

### P1 — Sensitive headers and bodies can leak into logs
- File: `ai/open-sse/utils/requestLogger.js:72`
- File: `ai/open-sse/utils/requestLogger.js:130`
- File: `ai/open-sse/handlers/chatCore.js:69`
- File: `ai/cloud/src/handlers/forward.js:36`
- File: `ai/cloud/src/handlers/forwardRaw.js:73`
- Issue: request logging paths and cloud forward handlers may write unredacted headers, bodies, and tokens to logs.
- Impact: filesystem or log-access compromise can expose API keys, cookies, bearer tokens, prompts, and provider responses.
- Recommendation: redact sensitive headers/body fields by default and disable raw body/header logging outside tightly controlled local debugging.

### P2 — Password reset does not revoke active sessions
- File: `ai/src/lib/web/auth/facade.js:426`
- Issue: after password reset, existing user sessions do not appear to be revoked.
- Impact: stolen session cookies may remain valid after credential reset.
- Recommendation: revoke all active sessions on password change/reset and require re-authentication.

### P2 — Manual payment metadata is over-retained and re-exposed
- File: `ai/src/app/api/web/v1/me/billing/manual-payments/route.js:15`
- File: `ai/src/app/api/web/v1/me/billing/manual-payments/[paymentId]/submit/route.js:7`
- File: `ai/src/lib/web/billing/manualPayments.js:49`
- Issue: user-supplied payment metadata such as sender name/reference/notes is stored and returned with limited minimization.
- Impact: unnecessary retention of payer PII and increased blast radius if DB/admin tooling/logs are exposed.
- Recommendation: minimize fields, add strict validation/length limits, and mask/truncate sensitive values in responses.

### P2 — Raw request headers/body are forwarded deeper into chat pipeline
- File: `ai/src/sse/handlers/chat.js:40`
- File: `ai/src/sse/handlers/chat.js:258`
- Issue: full request headers and body are packaged into `clientRawRequest` and passed downstream.
- Impact: downstream logging/debug/persistence paths may inadvertently capture secrets and prompt data.
- Recommendation: pass only a minimal sanitized audit object and strip secret-bearing headers.

### P0 — Tunnel control routes are directly reachable and unauthenticated at handler level
- File: `ai/src/proxy.js:54`
- File: `ai/src/app/api/tunnel/enable/route.js:6`
- File: `ai/src/app/api/tunnel/status/route.js:5`
- File: `ai/src/app/api/tunnel/tailscale-enable/route.js:4`
- File: `ai/src/app/api/tunnel/tailscale-start-daemon/route.js:10`
- File: `ai/src/app/api/tunnel/tailscale-install/route.js:18`
- Issue: these routes expose tunnel state changes and privileged local operations, but they are not covered by the current proxy matcher and contain no route-level auth checks.
- Impact: remote callers may enable/disable exposure paths, inspect tunnel status, start daemons, or trigger install flows with privileged execution paths.
- Recommendation: protect all `/api/tunnel/*` routes with explicit authentication, authorization, and CSRF defenses.

### P1 — Request logging explicitly disables header redaction
- File: `ai/open-sse/utils/requestLogger.js:72`
- File: `ai/open-sse/utils/requestLogger.js:130`
- File: `ai/open-sse/utils/requestLogger.js:157`
- Issue: `maskSensitiveHeaders()` returns headers unchanged and comments state masking is disabled for testing.
- Impact: when request logging is enabled, authorization headers, cookies, API keys, and other secrets are written to disk.
- Recommendation: re-enable redaction immediately and avoid raw header/body logging by default.

### P1 — Observability request-details APIs appear unauthenticated and can expose stored request/response payloads
- File: `ai/src/app/api/usage/request-details/route.js:8`
- File: `ai/src/app/api/usage/providers/route.js:10`
- File: `ai/src/lib/requestDetailsDb.js:126`
- Issue: usage observability endpoints read from `request-details.json` without route-level auth checks, while the DB stores request/providerRequest/providerResponse/response objects.
- Impact: remote callers may enumerate request telemetry and potentially access prompt fragments, provider payload previews, model usage metadata, or other sensitive operational data.
- Recommendation: require admin authentication on observability endpoints and minimize/redact stored request/response content.

### P1 — Cloud sync GET returns full secret-bearing provider objects
- File: `ai/cloud/src/handlers/sync.js:48`
- File: `ai/cloud/src/handlers/sync.js:57`
- File: `ai/cloud/src/handlers/sync.js:173`
- Issue: sync reads return `data` containing provider objects with `accessToken`, `refreshToken`, `idToken`, `apiKey`, and `providerSpecificData`.
- Impact: once a machine record is accessible, this becomes direct bulk credential exfiltration.
- Recommendation: never return full secrets in sync reads; encrypt at rest and issue scoped sync credentials.

### P1 — Cloud forward handlers log forwarded headers and raw HTTP fragments
- File: `ai/cloud/src/handlers/forward.js:36`
- File: `ai/cloud/src/handlers/forwardRaw.js:73`
- File: `ai/cloud/src/handlers/forwardRaw.js:127`
- Issue: cloud proxy handlers print forwarded headers, partial raw requests, and response fragments to logs.
- Impact: secrets sent through these endpoints may leak into worker/runtime logs even aside from the SSRF issue itself.
- Recommendation: remove verbose request/response logging and keep only minimal metadata.

## Notes
- `main/` mostly forwards cookies to `ai/` web API and did not show a critical standalone auth issue in this pass.
- The highest-risk issues are concentrated in `ai/` auth, dashboard guard, key-management routes, cloud worker endpoints, and network-facing proxy/tunnel surfaces.

## Additional Angles

### P2 — Insecure defaults in environment contract increase deployment risk
- File: `ai/.env.example:17`
- File: `ai/.env.example:19`
- File: `ai/.env.example:25`
- File: `ai/.env.example:30`
- File: `ai/.env.example:48`
- Issue: example config promotes risky defaults such as placeholder secrets, `AUTH_COOKIE_SECURE=false`, `REQUIRE_API_KEY=false`, and observability enabled by default.
- Impact: operators frequently bootstrap from example files; weak defaults materially increase the chance of insecure production deployments.
- Recommendation: ship secure-by-default examples, mark dangerous values clearly as local-dev-only, and fail startup on placeholder secrets.

### P2 — Docker release pipeline disables provenance and SBOM generation
- File: `ai/.github/workflows/docker-publish.yml:53`
- File: `ai/.github/workflows/docker-publish.yml:54`
- Issue: container publishing turns off provenance attestations and SBOM output.
- Impact: weaker artifact integrity, reduced supply-chain traceability, and poorer incident response when dependencies are compromised.
- Recommendation: enable provenance and SBOM generation for published images.

### P2 — Privileged local-operation code greatly amplifies impact of auth failures
- File: `ai/src/app/api/tunnel/tailscale-install/route.js:25`
- File: `ai/src/app/api/tunnel/tailscale-start-daemon/route.js:14`
- File: `ai/src/mitm/manager.js:92`
- File: `ai/src/mitm/manager.js:180`
- Issue: the codebase contains multiple paths that cache/load passwords and execute privileged local commands through `exec`, `spawn`, and sudo-assisted flows.
- Impact: any auth bypass or admin-route exposure becomes far more severe because it can cross from app compromise into host-level operations.
- Recommendation: isolate privileged helpers behind separate local-only services/process boundaries and avoid storing reusable sudo credentials where possible.

### P2 — Observability storage is enabled by default in example config
- File: `ai/.env.example:30`
- File: `ai/src/lib/requestDetailsDb.js:126`
- Issue: request-detail persistence is encouraged by default while request/provider payload objects are stored to disk.
- Impact: higher chance of accidental prompt, metadata, or secret retention on fresh deployments.
- Recommendation: default observability off, require explicit opt-in, and store only minimized/redacted telemetry.

## Suggested Remediation Order
1. Lock down `ai/src/app/api/keys/[id]/route.js` with session + ownership checks.
2. Remove or strongly protect cloud `/forward`, `/forward-raw`, and `/sync/:machineId` endpoints.
3. Remove all fallback auth secrets and require env configuration.
4. Redesign password reset and OTP verification with hashed tokens plus strict rate/attempt limits.
5. Remove default password/localhost trust shortcuts and protect `/api/tunnel/*` with explicit authz.
6. Add CSRF protection to cookie-authenticated non-GET routes.
7. Add in-route auth checks to sensitive sync/export/payment-destination routes.
8. Disable sensitive header/body logging and sanitize request propagation paths.
9. Tighten insecure defaults, observability defaults, and release integrity settings.

<!-- BEGIN:nextjs-agent-rules -->

## Next.js Notes

This project may use a newer or different Next.js setup than expected.

- Check the relevant guide in `node_modules/next/dist/docs/` before making framework-level changes
- Do not assume older APIs, file structure, or conventions still apply
- Follow deprecation warnings
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:design-system-rules -->

## Design System

For UI, UX, layout, and styling work

- Keep the Ollama-inspired direction unless the user asks otherwise
- Follow its rules for typography, grayscale palette, spacing, radius, components, and interaction style
<!-- END:design-system-rules -->

<!-- BEGIN:responsive-mobile-rules -->

## Responsive and Mobile-First

Treat mobile-first as the default approach for frontend work.

- Start layout, spacing, and interaction design from small screens first
- Scale up progressively for tablet and desktop, not the other way around
- Do not hide important functionality on mobile; adapt it for smaller screens
- Ensure touch targets, navigation, and text remain usable on mobile devices
- Verify the result works well on both mobile and desktop before considering it complete
<!-- END:responsive-mobile-rules -->

<!-- BEGIN:git-worktree-rules -->

## Git Worktree Hygiene

When using `git worktree`, clean it up after the task is finished.

- Merge the worktree branch back into its parent branch when the work is complete
- Delete the temporary worktree after the merge
- Delete the temporary branch if it was created only for that worktree
- Keep the branch list clean unless the user explicitly asks to keep the worktree or branch
<!-- END:git-worktree-rules -->

<!-- BEGIN:code-quality-rules -->

## Code Quality

Default to clean, production-ready code.

- Prefer simple, readable solutions over clever abstractions
- Keep files, components, and functions focused
- Avoid duplication when extraction improves clarity
- Match existing naming and code patterns
- Preserve type safety, validation, and error handling where relevant
- Write code that is easy to test, debug, review, and extend
<!-- END:code-quality-rules -->

<!-- BEGIN:react-useeffect-rules -->

## React `useEffect`

Use `useEffect` only when syncing with external systems.

- Do not use it for derived state that can be handled during render or in event handlers
- Keep each effect focused on one synchronization concern
- Include all reactive dependencies unless there is a justified exception
- Always mirror setup with cleanup
- Prevent stale updates and race conditions in async effects
- If supported by the project, prefer `useEffectEvent` for reading latest values without retriggering the effect

Reference: official React guidance via Context7 (`/reactjs/react.dev`)

<!-- END:react-useeffect-rules -->

<!-- BEGIN:metadata-seo-rules -->

## Metadata and SEO

For Next.js App Router work:

- Use `metadata` or `generateMetadata`, not manual head management
- Give each important page a clear, specific title and description
- Keep metadata close to the route that owns it
- Avoid duplicate or placeholder SEO copy

Reference: official Next.js docs via Context7 (`/vercel/next.js`)

<!-- END:metadata-seo-rules -->

<!-- BEGIN:error-handling-validation-rules -->

## Error Handling and Validation

Handle unhappy paths deliberately.

- Validate inputs at clear boundaries
- Guard against missing, nullable, or malformed data
- Use clear fallback behavior instead of silent failure
- Use `loading.tsx`, `error.tsx`, `not-found.tsx`, and `notFound()` where appropriate
- Keep user messages helpful and diagnostics useful without leaking sensitive details

Reference: official Next.js docs via Context7 (`/vercel/next.js`)

<!-- END:error-handling-validation-rules -->

<!-- BEGIN:testing-expectations-rules -->

## Testing

Keep testability in scope when implementing or refactoring.

- Write modular code that is easy to verify and isolate
- Add or update tests for non-trivial logic when test infrastructure exists
- If tests are not practical yet, keep logic deterministic so tests can be added later
- Do not rely only on happy-path manual checks for complex behavior
- Be explicit when tests are not added and note the verification gap
<!-- END:testing-expectations-rules -->

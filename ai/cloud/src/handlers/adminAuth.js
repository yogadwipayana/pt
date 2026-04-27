import { clearAdminSessionCookie, getAdminSession, logoutAdmin, signInAdmin } from "../services/adminAuth.js";
import { errorResponse, jsonResponse, readJson } from "../utils/jsonResponse.js";

const invalidLoginMessage = "Email atau password admin tidak valid.";

export async function handleAdminAuth(request, env, path) {
  if (path === "/api/web/v1/admin/auth/session" && request.method === "GET") {
    return jsonResponse(await getAdminSession(request, env));
  }

  if (path === "/api/web/v1/admin/auth/logout" && request.method === "POST") {
    await logoutAdmin(request, env);
    return jsonResponse(undefined, 204, { "Set-Cookie": clearAdminSessionCookie(env) });
  }

  if (path === "/api/web/v1/admin/auth/sign-in" && request.method === "POST") {
    const body = await readJson(request);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return errorResponse(400, "invalid_admin_credentials", invalidLoginMessage);
    }

    const signedIn = await signInAdmin(email, password, env);
    if (signedIn?.throttled) {
      return errorResponse(429, "admin_login_throttled", "Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.");
    }
    if (!signedIn) {
      return errorResponse(401, "invalid_admin_credentials", invalidLoginMessage);
    }

    return jsonResponse(
      {
        session: signedIn.response,
        redirectTo: "/admin"
      },
      200,
      { "Set-Cookie": signedIn.cookie }
    );
  }

  return errorResponse(404, "not_found", "Admin auth endpoint not found.");
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { webApi } from "@/lib/web-api";

export async function redirectAuthenticatedUser(target = "/settings/usage") {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  let shouldRedirect = false;

  try {
    const session = await webApi.getSession({
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });

    if (session.authenticated && session.user) {
      shouldRedirect = true;
    }
  } catch {
    return;
  }

  if (shouldRedirect) {
    redirect(target);
  }
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { webApi } from "@/lib/web-api";

import { SettingsShell } from "./settings-shell";

async function getSession() {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");

  return webApi.getSession({
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });
}

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  let session;

  try {
    session = await getSession();
  } catch {
    redirect("/sign-in?returnTo=/settings/usage");
  }

  if (!session.authenticated || !session.user) {
    redirect("/sign-in?returnTo=/settings/usage");
  }

  return <SettingsShell session={session}>{children}</SettingsShell>;
}

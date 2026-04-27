import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { webApi } from "@/lib/web-api";

import { AdminShell } from "./admin-shell";

async function getAdminSession() {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");

  return webApi.getAdminSession({
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let session;

  try {
    session = await getAdminSession();
  } catch {
    redirect("/admin/sign-in?returnTo=/admin");
  }

  if (!session.authenticated || !session.admin) {
    redirect("/admin/sign-in?returnTo=/admin");
  }

  return <AdminShell session={session}>{children}</AdminShell>;
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";
import { adminNavItems } from "@/content/admin";
import { type AdminSessionResponse, webApi } from "@/lib/web-api";

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children, session }: { children: ReactNode; session: AdminSessionResponse }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    void webApi.adminLogout().finally(() => {
      router.push("/admin/sign-in");
      router.refresh();
    });
  };

  return (
    <main className="admin-surface min-h-screen bg-[#f7f3eb] pb-6 pt-[6px] text-[#111111]">
      <SiteHeader />
      <PageContainer>
        <div className="w-full border-t border-[#c8bfae]" />
        <div className="mx-auto max-w-[1040px] px-4 pb-10 pt-8 sm:px-8 sm:pb-14 sm:pt-10">
          <section className="border-b border-[#b8b1a5] pb-5 sm:pb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[8px] uppercase tracking-[0.16em] text-[#8a847a] sm:text-[9px]">Admin</p>
                <h1 className="mt-2 text-[30px] leading-[0.96] tracking-[-0.05em] text-black sm:text-[40px]">
                  Dwipa operations
                </h1>
                <p className="mt-2 text-[10px] leading-[1.55] text-[#6f695f] sm:text-[11px]">
                  {session.admin?.email || "Admin session"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[44px] w-full items-center justify-center border border-black bg-black px-4 text-[8px] uppercase tracking-[0.16em] text-white sm:w-auto sm:min-w-[112px] sm:text-[9px]"
              >
                Logout
              </button>
            </div>

            <nav className="mt-6 flex gap-5 overflow-x-auto pb-1 text-[10px] uppercase tracking-[0.12em] text-[#7a746b] sm:mt-8 sm:gap-6 sm:text-[11px]">
              {adminNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive(pathname, item.href) ? "shrink-0 border-b border-black pb-1 text-black" : "shrink-0 pb-1 hover:text-black"}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </section>
          <section className="pt-6 sm:pt-8">{children}</section>
        </div>
      </PageContainer>
    </main>
  );
}

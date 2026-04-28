"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";
import { settingsTabs } from "@/content/account";
import type { SessionResponse } from "@/lib/web-api";

const isSettingsTabActive = (pathname: string, href: string) => pathname === href;

const settingsTabClassName = (pathname: string, href: string) =>
  isSettingsTabActive(pathname, href) ? "border-b border-black pb-1 text-black" : "pb-1 hover:text-black";

export function SettingsShell({ children, session }: { children: ReactNode; session: SessionResponse }) {
  const pathname = usePathname();
  const name = session.profile?.username || session.profile?.fullName || session.user?.name || "Dwipa user";
  const email = session.user?.email || session.profile?.email || "";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return (
    <main className="min-h-screen bg-[#f7f3eb] pb-6 pt-[6px] text-[#111111]">
      <SiteHeader />

      <PageContainer>
        <div className="w-full border-t border-[#c8bfae]" />

        <div className="mx-auto max-w-[760px] px-4 pb-10 pt-8 sm:px-8 sm:pb-14 sm:pt-12">
          <section className="border-b border-[#b8b1a5] pb-6 sm:pb-7">
            <div className="max-w-[520px]">
              <p className="text-[28px] leading-[0.98] tracking-[-0.05em] text-black sm:text-[34px]">
                {name}
              </p>
              <p className="mt-2 text-[16px] leading-[1.3] text-[#4f4a43] sm:text-[18px]">
                {email}
              </p>
            </div>

            <nav className="mt-10 flex flex-wrap items-center gap-5 text-[10px] uppercase tracking-[0.12em] text-[#7a746b] sm:mt-12 sm:gap-6 sm:text-[11px]">
              {settingsTabs.map((tab) => {
                return (
                  <Link key={tab.label} href={tab.href} className={settingsTabClassName(pathname, tab.href)}>
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </section>

          <section className="pt-6 sm:pt-8">{children}</section>
        </div>
      </PageContainer>
    </main>
  );
}

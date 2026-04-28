import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";
import { adminCopy } from "@/content/admin";

import { AdminSignInForm } from "./admin-sign-in-form";

export const metadata: Metadata = {
  title: "Admin Sign In - Dwipa",
  description: "Sign in to the Dwipa admin area.",
};

export default function AdminSignInPage() {
  return (
    <main className="admin-surface min-h-screen bg-[#f7f3eb] pb-6 pt-[6px] text-[#111111]">
      <SiteHeader />
      <PageContainer>
        <div className="w-full border-t border-[#c8bfae]" />
        <section className="mx-auto max-w-[430px] px-4 pb-10 pt-12 sm:px-8 sm:pt-16">
          <p className="text-[8px] uppercase tracking-[0.16em] text-[#8a847a] sm:text-[9px]">Dwipa internal</p>
          <h1 className="mt-3 text-[36px] leading-[0.94] tracking-[-0.06em] text-black sm:text-[48px]">
            {adminCopy.signInTitle}
          </h1>
          <p className="mt-4 text-[11px] leading-[1.6] text-[#6f695f] sm:text-[12px]">
            {adminCopy.signInDescription}
          </p>
          <Suspense fallback={null}>
            <AdminSignInForm />
          </Suspense>
        </section>
      </PageContainer>
    </main>
  );
}

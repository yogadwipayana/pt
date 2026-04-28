import type { Metadata } from "next";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";
import { redirectAuthenticatedUser } from "@/lib/auth-redirect";

import { OtpPanel } from "./otp-panel";

export const metadata: Metadata = {
  title: "Verify Email - Dwipa",
  description:
    "Enter the one-time verification code sent during Dwipa account creation to validate your email address.",
};

export default async function OtpPage() {
  await redirectAuthenticatedUser();

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f3eb] pb-6 pt-[6px] text-[#111111]">
      <SiteHeader />

      <PageContainer className="flex flex-1 flex-col">
        <section className="border-t border-[#bdb7ab] pb-6 pt-8 sm:pb-8 sm:pt-10">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[#7b7469]">
            Verification // OTP
          </p>
          <h1 className="mt-2 text-[28px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[36px] lg:text-[42px]">
            VERIFY EMAIL
          </h1>
        </section>

        <section className="flex flex-1 items-start justify-center pt-4 sm:pt-8">
          <div className="w-full max-w-[420px]">
            <OtpPanel />
          </div>
        </section>
      </PageContainer>
    </main>
  );
}

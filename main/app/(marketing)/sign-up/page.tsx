import type { Metadata } from "next";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";
import { redirectAuthenticatedUser } from "@/lib/auth-redirect";

import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Sign Up - Dwipa",
  description:
    "Create your Dwipa account to start routing models, managing API access, and configuring your developer workspace.",
};

export default async function SignUpPage() {
  await redirectAuthenticatedUser();

  return (
    <main className="min-h-screen bg-[#f7f3eb] px-[26px] pb-8 pt-[6px] text-[#111111] sm:px-8 lg:px-[26px]">
      <SiteHeader />

      <PageContainer className="pb-4 sm:pb-5">
        <div className="w-full border-t border-[#c8bfae]" />

        <section className="flex min-h-[calc(100vh-120px)] items-center justify-center py-8 sm:py-12 lg:py-16">
          <div className="w-full max-w-[420px] border border-[#a59e92] bg-[#fbfaf7] px-5 py-6 sm:px-7 sm:py-8">
            <div className="border-b border-[#ddd7cf] pb-6 sm:pb-7">
              <p className="text-[8px] uppercase tracking-[0.16em] text-[#6e6a63] sm:text-[9px]">
                Developer Access
              </p>
              <h1 className="mt-4 text-[30px] font-semibold leading-[0.95] tracking-[-0.06em] sm:text-[38px]">
                Sign up
              </h1>
              <p className="mt-3 max-w-[296px] text-[10px] leading-[1.6] text-[#68645c] sm:text-[11px]">
                Create your DWIPA account to start managing API access, model routing, and billing from one workspace.
              </p>
            </div>

            <SignUpForm />
          </div>
        </section>
      </PageContainer>
    </main>
  );
}

import type { Metadata } from "next";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Privacy Policy - Dwipa",
  description:
    "Read how Dwipa handles account data, API keys, usage metadata, billing information, and privacy for developers using Dwipa services.",
};

const policySections = [
  {
    title: "Information we collect",
    body: [
      "Dwipa collects account information you provide, such as your name, email address, Google account identifier, profile image when provided by Google sign-in, authentication details, and workspace profile data.",
      "When you use Dwipa APIs, we process operational metadata such as API key identifiers, request timestamps, selected models, token or credit usage, response status, and billing events.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "We use this information to provide authentication, API access, model routing, usage tracking, billing, support, abuse prevention, and service reliability.",
      "We do not use private API request content to advertise to you. Request content may be processed by model providers only as needed to deliver the service you requested.",
    ],
  },
  {
    title: "API keys and security",
    body: [
      "API keys are used to authenticate requests and connect usage to your account. You are responsible for keeping keys private and rotating keys if they may have been exposed.",
      "Dwipa applies reasonable technical safeguards for production systems, but no internet service can guarantee absolute security.",
    ],
  },
  {
    title: "Third-party services",
    body: [
      "Dwipa may rely on infrastructure, payment, analytics, authentication, email, and AI model providers to operate the platform.",
      "Google may process your name, email address, profile image, and account identifier when you choose Google sign-in. Dwipa does not sell Google user data or use it for advertising.",
      "These providers process information only for the services they provide to Dwipa or to you through Dwipa.",
    ],
  },
  {
    title: "Cookies and sessions",
    body: [
      "Dwipa may use cookies or similar storage to keep you signed in, protect sessions, remember preferences, and understand basic product usage.",
      "You can control cookies through your browser settings, but disabling them may prevent sign-in or account features from working correctly.",
    ],
  },
  {
    title: "Retention and deletion",
    body: [
      "We keep account, usage, and billing records for as long as needed to provide the service, meet legal obligations, resolve disputes, and enforce agreements.",
      "You may contact Dwipa through dwipa.my.id to request access, correction, or deletion of personal information where applicable law allows.",
    ],
  },
  {
    title: "Contact",
    body: [
      "For privacy questions, contact Dwipa through the official website at dwipa.my.id.",
      "This policy applies to Dwipa services on dwipa.my.id and ai.dwipa.my.id.",
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f3eb] px-[26px] pb-8 pt-[6px] text-[#111111] sm:px-8 lg:px-[26px]">
      <SiteHeader />

      <PageContainer>
        <div className="border-t border-[#c8bfae]" />

        <section className="grid gap-10 pb-12 pt-10 sm:pb-14 sm:pt-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20 lg:pb-16">
          <div>
            <p className="text-[8px] uppercase tracking-[0.18em] text-[#6e6a63] sm:text-[9px]">
              Legal
            </p>
            <h1 className="mt-5 max-w-[440px] text-[42px] font-semibold leading-[0.84] tracking-[-0.085em] sm:text-[60px] lg:text-[72px]">
              Privacy Policy
            </h1>
            <p className="mt-7 max-w-[360px] text-[11px] leading-[1.78] text-[#68645c] sm:text-[12px]">
              Dwipa gives developers access to AI infrastructure while keeping account, usage, and billing data understandable.
            </p>
            <p className="mt-5 text-[8px] uppercase tracking-[0.16em] text-[#8a847a] sm:text-[9px]">
              Last updated: April 26, 2026
            </p>
          </div>

          <div className="space-y-3">
            {policySections.map((section, index) => (
              <article
                key={section.title}
                className="border border-[#d9d2c7] bg-[#fbfaf7] px-5 py-5 sm:px-6 sm:py-6"
              >
                <div className="flex items-start justify-between gap-6 border-b border-[#ebe5db] pb-4">
                  <h2 className="max-w-[520px] text-[22px] leading-[0.96] tracking-[-0.06em] sm:text-[28px]">
                    {section.title}
                  </h2>
                  <span className="font-mono text-[9px] text-[#8a847a]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-5 space-y-4 text-[11px] leading-[1.78] text-[#68645c] sm:text-[12px]">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </PageContainer>
    </main>
  );
}

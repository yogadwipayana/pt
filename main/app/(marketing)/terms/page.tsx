import type { Metadata } from "next";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Terms of Service - Dwipa",
  description:
    "Read the terms that apply when using Dwipa accounts, API keys, credits, billing, model routing, and developer services.",
};

const termsSections = [
  {
    title: "Using Dwipa",
    body: [
      "Dwipa provides developer tools, API access, model routing, account features, usage tracking, and billing services.",
      "You may use Dwipa only in compliance with applicable laws, these terms, and any provider rules that apply to models accessed through Dwipa.",
    ],
  },
  {
    title: "Accounts and access",
    body: [
      "You are responsible for the accuracy of account information and for activity that happens through your account, workspace, API keys, or credentials.",
      "Keep credentials confidential. If you believe an API key or account has been compromised, rotate the key and contact Dwipa through the official website.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "Do not use Dwipa to abuse, disrupt, reverse engineer, overload, or interfere with the platform, model providers, or other users.",
      "Do not submit content or build systems that violate law, infringe rights, distribute malware, or intentionally bypass safety, billing, or access controls.",
    ],
  },
  {
    title: "Credits and billing",
    body: [
      "Dwipa plans may include free access, recurring credits, manual top-ups, metered billing, or discounts for model usage.",
      "Credits, prices, limits, and discounts may vary by plan and may change as the service evolves. Usage records are tied to your account and active API keys.",
    ],
  },
  {
    title: "Model outputs",
    body: [
      "AI model outputs can be incomplete, inaccurate, or unsuitable for your use case. You are responsible for reviewing outputs before relying on them.",
      "Dwipa routes requests to available providers but does not guarantee that every model, response, latency target, or output will always be available.",
    ],
  },
  {
    title: "Service changes",
    body: [
      "Dwipa may update, suspend, limit, or discontinue features to improve reliability, comply with law, manage abuse, or maintain provider relationships.",
      "We may suspend or terminate access if usage creates risk, violates these terms, or harms Dwipa, providers, users, or third parties.",
    ],
  },
  {
    title: "Updates and contact",
    body: [
      "Dwipa may update these terms from time to time. Continued use of the service after updates means you accept the revised terms.",
      "For terms questions, contact Dwipa through the official website at dwipa.my.id.",
    ],
  },
] as const;

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="mt-7 max-w-[360px] text-[11px] leading-[1.78] text-[#68645c] sm:text-[12px]">
              These terms explain how developers can use Dwipa accounts, API keys, credits, billing, and AI model routing.
            </p>
            <p className="mt-5 text-[8px] uppercase tracking-[0.16em] text-[#8a847a] sm:text-[9px]">
              Last updated: April 26, 2026
            </p>
          </div>

          <div className="space-y-3">
            {termsSections.map((section, index) => (
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

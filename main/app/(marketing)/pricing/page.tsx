import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";
import { type PublicPlan, webApi } from "@/lib/web-api";

export const metadata: Metadata = {
  title: "Dwipa Pricing - Typographic Grid",
  description:
    "Explore Dwipa pricing tiers with transparent developer credits, predictable limits, and metered billing for every model.",
};

const noteLinks = [
  { label: "Docs", href: "/docs" },
  { label: "Status", href: "#allocation-note" },
] as const;

const heroSummary =
  "Transparent allocation, fixed operational limits, and predictable billing across every Dwipa tier. Select the tier that maps cleanly to your infrastructure needs.";

const noteBody =
  "Usage is counted per active API key. Rotating keys does not clear quotas, and full rate-limit metrics remain documented in the Dwipa API reference.";

const heroStats = [
  { label: "Billing model", value: "Credits + metered" },
  { label: "Routing", value: "One endpoint" },
  { label: "Activation", value: "Per workspace" },
] as const;

const fallbackPricingPlans = [
  {
    slug: "free",
    name: "Free",
    priceLabel: "Rp 0",
    periodLabel: "/ MONTH",
    description: "$2 credit every 24 hours.",
    ctaLabel: "INITIALIZE",
    highlighted: false,
    billingType: "free",
    entitlements: [
      { label: "Starting credit", value: "$2 balance" },
      { label: "Top up", value: "Add funds by manual payment" },
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    priceLabel: "Rp 50.000",
    periodLabel: "/ MONTH",
    description: "Recurring credit windows for active product teams shipping against one stable API.",
    ctaLabel: "UPGRADE NOW",
    highlighted: true,
    billingType: "recurring",
    entitlements: [
      { label: "Allocation", value: "$10 credit / 12 hours" },
      { label: "Priority", value: "High" },
    ],
  },
  {
    slug: "payg",
    name: "Pay as you go",
    priceLabel: "Usage Based",
    periodLabel: "",
    description: "Direct metered throughput with discounted routing across every model.",
    ctaLabel: "CONFIGURE BILLING",
    highlighted: false,
    billingType: "metered",
    entitlements: [
      { label: "Benefit", value: "50% off all models" },
      { label: "Limits", value: "Uncapped" },
    ],
  },
] satisfies PublicPlan[];

const isExternalLink = (href: string) => href.startsWith("https://");
const isHashLink = (href: string) => href.startsWith("#");

function SiteLink({ label, href, className = "transition-colors hover:text-black" }: { label: string; href: string; className?: string }) {
  if (isExternalLink(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }

  if (isHashLink(href)) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function PricingCard({
  slug,
  name,
  priceLabel,
  periodLabel,
  description,
  entitlements,
  ctaLabel,
  highlighted,
  billingType,
}: PublicPlan) {
  const href =
    slug === "pro"
      ? "/settings/billing?checkout=pro"
      : billingType === "metered"
        ? "/settings/billing?checkout=add-funds"
        : "/sign-up";
  const tier = slug === "free" ? "TIER_0" : slug === "pro" ? "TIER_1" : slug.toUpperCase();
  const kicker = highlighted ? "Recommended" : billingType === "metered" ? "Scale" : "Entry";

  return (
    <article
      className={`flex min-h-[500px] flex-col justify-between bg-[#fbfaf7] px-5 py-5 sm:px-6 sm:py-6 lg:min-h-[560px] ${
        highlighted ? "bg-[#f3eee6]" : ""
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-4 border-b border-[#d9d2c7] pb-4">
          <div>
            <p className="text-[8px] uppercase tracking-[0.16em] text-[#6e6a63] sm:text-[9px]">{tier}</p>
            <h2 className="mt-4 text-[28px] leading-[0.94] tracking-[-0.08em] sm:text-[34px]">
              {name}
            </h2>
          </div>
          <span className="pt-1 text-[10px] text-[#8a847a] sm:text-[11px]">↗</span>
        </div>

        <p className="mt-3 text-[8px] uppercase tracking-[0.16em] text-[#9a9488] sm:text-[9px]">
          {kicker}
        </p>

        <div className="mt-10 border-b border-[#d9d2c7] pb-10">
          <p className="text-[9px] uppercase tracking-[0.18em] text-[#7a746b] sm:text-[10px]">Cost</p>
          <div className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-1">
            <p className="text-[34px] leading-none tracking-[-0.08em] sm:text-[46px] lg:text-[52px]">
              {priceLabel}
            </p>
            {periodLabel ? (
              <p className="pb-1 text-[8px] uppercase tracking-[0.16em] text-[#8a847a] sm:text-[9px]">
                {periodLabel}
              </p>
            ) : null}
          </div>
        </div>

        <p className="mt-4 max-w-[220px] text-[10px] leading-[1.6] text-[#8a847a] sm:text-[11px]">
          {description}
        </p>

        <dl className="mt-8 space-y-5">
          {entitlements.map((detail) => (
            <div
              key={detail.label}
              className="flex items-start justify-between gap-6 border-b border-[#ebe5db] pb-4"
            >
              <dt className="text-[9px] uppercase tracking-[0.16em] text-[#6e6a63] sm:text-[10px]">
                {detail.label}
              </dt>
              <dd className="text-right text-[12px] leading-[1.45] tracking-[-0.02em] text-black sm:text-[13px]">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <Link
        href={href}
        aria-label={`${ctaLabel} for ${name}`}
        className={`mt-10 flex min-h-[48px] items-center justify-center border px-4 text-[8px] uppercase tracking-[0.16em] sm:text-[9px] ${
          highlighted ? "border-black bg-black text-white" : "border-[#9f988c] bg-transparent text-black"
        }`}
      >
        {ctaLabel}
      </Link>
    </article>
  );
}

async function getPricingPlans() {
  try {
    const response = await webApi.getPublicPlans({ cache: "no-store" });
    return response.plans.length > 0 ? response.plans : fallbackPricingPlans;
  } catch {
    return fallbackPricingPlans;
  }
}

export default async function PricingPage() {
  const pricingPlans = await getPricingPlans();

  return (
    <main className="min-h-screen bg-[#f7f3eb] pb-6 pt-[6px] text-[#111111]">
      <SiteHeader />

      <PageContainer>
        <div className="w-full border-t border-[#bdb7ab]" />

        <section className="pb-12 pt-10 sm:pb-14 sm:pt-12 lg:pb-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
            <div>
              <p className="text-[8px] uppercase tracking-[0.18em] text-[#6e6a63] sm:text-[9px]">Pricing</p>
              <h1 className="mt-5 max-w-[440px] text-[42px] font-semibold leading-[0.84] tracking-[-0.085em] sm:text-[60px] lg:text-[68px] xl:text-[78px]">
                Priced Logically
              </h1>
            </div>

            <div className="flex flex-col gap-8 lg:pt-10 xl:pt-14">
              <p className="max-w-[470px] text-[12px] leading-[1.78] text-[#68645c] sm:text-[13px]">
                {heroSummary}
              </p>

              <dl className="grid gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div key={item.label} className="bg-[#fbfaf7] px-4 py-4 sm:px-5 sm:py-5">
                    <dt className="text-[8px] uppercase tracking-[0.16em] text-[#7a746b] sm:text-[9px]">
                      {item.label}
                    </dt>
                    <dd className="mt-3 text-[13px] leading-[1.25] tracking-[-0.03em] text-black sm:text-[14px]">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="pb-12 sm:pb-14 lg:pb-16">
          <div className="border-t border-[#bdb7ab] pt-4 sm:pt-5">
            <div className="grid gap-3 lg:grid-cols-3">
              {pricingPlans.map((plan) => (
                <PricingCard key={plan.name} {...plan} />
              ))}
            </div>
          </div>
        </section>

        <section id="allocation-note" className="pb-10 sm:pb-12 lg:pb-14">
          <div className="border border-[#a59e92] bg-[#fbfaf7] px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-[240px]">
                <p className="flex items-center gap-2 text-[8px] uppercase tracking-[0.16em] text-[#6e6a63] sm:text-[9px]">
                  <span className="flex h-4 w-4 items-center justify-center border border-[#c9c4ba] text-[7px] text-[#5f5a53]">
                    i
                  </span>
                  Allocation note
                </p>
                <h2 className="mt-4 text-[24px] leading-[0.94] tracking-[-0.06em] sm:text-[28px]">
                  Credits operate on fixed routing windows.
                </h2>
              </div>

              <div className="max-w-[620px] lg:pt-1">
                <p className="text-[11px] leading-[1.78] text-[#68645c] sm:text-[12px]">{noteBody}</p>
                <div className="mt-6 flex flex-wrap gap-4 text-[8px] uppercase tracking-[0.16em] text-black sm:text-[9px]">
                  {noteLinks.map((link) => (
                    <SiteLink key={link.label} label={link.label} href={link.href} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </PageContainer>
    </main>
  );
}

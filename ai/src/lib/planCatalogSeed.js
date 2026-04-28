/**
 * Plan catalog seed data.
 *
 * Mirrors the structure of modelCatalogSeed.js so consumers can import plain
 * objects and decide how to persist them (raw SQL or Prisma).
 */

const PLANS = [
  {
    slug: "free",
    name: "Free",
    billingType: "quota",
    includedCreditUsd: 2.0,
    windowHours: 24,
    discountPercent: 0,
    priceCurrency: "IDR",
    priceMinor: 0,
    periodLabel: "24 hours",
    description: "$2 credit every 24 hours",
    ctaLabel: "Get Started",
    highlighted: false,
    isActive: true,
    sortOrder: 0,
    entitlements: [
      { label: "Access to all models", value: "" },
      { label: "Credit", value: "$2 / 24h" },
      { label: "Support", value: "Community" },
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    billingType: "subscription",
    includedCreditUsd: 10.0,
    windowHours: 12,
    discountPercent: 0,
    priceCurrency: "IDR",
    priceMinor: 50000,
    periodLabel: "month",
    description: "$10 credit every 12 hours",
    ctaLabel: "Upgrade to Pro",
    highlighted: true,
    isActive: true,
    sortOrder: 1,
    entitlements: [
      { label: "Access to all models", value: "" },
      { label: "Credit", value: "$10 / 12h" },
      { label: "Support", value: "Priority" },
    ],
  },
  {
    slug: "payg",
    name: "Pay as you go",
    billingType: "usage",
    includedCreditUsd: 0,
    windowHours: null,
    discountPercent: 50,
    priceCurrency: "IDR",
    priceMinor: 0,
    periodLabel: "one-time",
    description: "Manual top-ups with 50% discount on every model",
    ctaLabel: "Add Credit",
    highlighted: false,
    isActive: true,
    sortOrder: 2,
    entitlements: [
      { label: "Access to all models", value: "" },
      { label: "Discount", value: "50% on all models" },
      { label: "Support", value: "Community" },
    ],
  },
];

export function buildPlanCatalogSeedRows() {
  return PLANS.map((plan) => ({
    slug: plan.slug,
    name: plan.name,
    billingType: plan.billingType,
    includedCreditUsd: plan.includedCreditUsd,
    windowHours: plan.windowHours,
    discountPercent: plan.discountPercent,
    priceCurrency: plan.priceCurrency,
    priceMinor: plan.priceMinor,
    periodLabel: plan.periodLabel,
    description: plan.description,
    ctaLabel: plan.ctaLabel,
    highlighted: plan.highlighted,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    entitlements: plan.entitlements.map((e, i) => ({
      label: e.label,
      value: e.value,
      sortOrder: i,
    })),
  }));
}

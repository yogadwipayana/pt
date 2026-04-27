import type { Metadata } from "next";
import { headers } from "next/headers";

import { webApi } from "@/lib/web-api";

import { SettingsBillingPanel } from "./settings-billing-panel";

export const metadata: Metadata = {
  title: "Billing - Dwipa Settings",
  description:
    "Review your Dwipa subscription, stored payment method, credits, and invoice history.",
};

async function getBilling() {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    return await webApi.getBilling({
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });
  } catch {
    return null;
  }
}

type SettingsBillingPageProps = {
  searchParams?: Promise<{
    checkout?: string | string[];
  }>;
};

function parseCheckoutIntent(checkout: string | string[] | undefined) {
  const value = Array.isArray(checkout) ? checkout[0] : checkout;
  return value === "pro" || value === "add-funds" ? value : null;
}

export default async function SettingsBillingPage({ searchParams }: SettingsBillingPageProps) {
  const billing = await getBilling();
  const params = searchParams ? await searchParams : undefined;

  return <SettingsBillingPanel initialBilling={billing} initialCheckoutIntent={parseCheckoutIntent(params?.checkout)} />;
}

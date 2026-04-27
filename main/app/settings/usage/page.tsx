import type { Metadata } from "next";
import { headers } from "next/headers";

import { usageMeters, usageSection } from "@/content/account";
import { type UsageMeter, webApi } from "@/lib/web-api";
import { SettingsUsageMeters } from "./settings-usage-meters";

export const metadata: Metadata = {
  title: "Usage - Dwipa Settings",
  description:
    "Monitor Dwipa cloud usage, active session consumption, and weekly resource limits.",
};

function getFallbackUsageMeters() {
  return usageMeters.map((meter) => ({
    id: meter.label,
    label: meter.label,
    description: meter.description,
    valueDisplay: meter.value,
    totalDisplay: meter.total,
    progressPercent: meter.progress,
    resetsAt: null,
    countdownText: meter.countdown ?? null,
  })) satisfies UsageMeter[];
}

async function getUsageData() {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    const usage = await webApi.getUsage({
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });

    return {
      meters: usage.meters.length > 0 ? usage.meters : getFallbackUsageMeters(),
      canUpgrade: usage.canUpgrade,
    };
  } catch {
    return {
      meters: getFallbackUsageMeters(),
      canUpgrade: true,
    };
  }
}

export default async function SettingsUsagePage() {
  const { meters, canUpgrade } = await getUsageData();

  return (
    <section>
      <div>
        <h2 className="text-[28px] leading-[0.96] tracking-[-0.045em] text-black sm:text-[34px]">
          {usageSection.title}
        </h2>
        <p className="mt-3 max-w-[460px] text-[12px] leading-[1.6] text-[#8a847a] sm:text-[13px]">
          {usageSection.description}
        </p>
      </div>

      <SettingsUsageMeters meters={meters} />

      {canUpgrade ? (
        <button
          type="button"
          className="mt-6 flex min-h-[44px] w-full items-center justify-center bg-black px-4 text-[8px] uppercase tracking-[0.16em] text-white sm:mt-7 sm:text-[9px]"
        >
          {usageSection.upgradeLabel}
        </button>
      ) : null}
    </section>
  );
}

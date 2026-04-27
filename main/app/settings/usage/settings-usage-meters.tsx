"use client";

import { useEffect, useState } from "react";

import type { UsageMeter } from "@/lib/web-api";

function parseUsageTimestamp(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized);
  const candidate = hasTimezone ? normalized : `${normalized}Z`;
  return new Date(candidate).getTime();
}

function parseWindowHours(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;

    const match = value.match(/(\d+)\s*(?:hours?|h)\b/i);
    if (match) {
      const hours = Number(match[1]);
      if (Number.isFinite(hours) && hours > 0) {
        return hours;
      }
    }
  }

  return null;
}

function formatDuration(target: string, now: number, windowHours?: number | null) {
  const targetTime = parseUsageTimestamp(target);

  if (!Number.isFinite(targetTime)) {
    return null;
  }

  let remainingMs = targetTime - now;

  if (remainingMs <= 0 && windowHours && windowHours > 0) {
    const windowMs = windowHours * 60 * 60 * 1000;
    const elapsedWindows = Math.floor((now - targetTime) / windowMs) + 1;
    remainingMs = targetTime + elapsedWindows * windowMs - now;
  }

  if (remainingMs <= 0) {
    return "Resetting now";
  }

  // If the target is unreasonably far in the future relative to the plan window,
  // the backend sentinel (timer hasn't started yet) is in effect. Fall back to
  // the static description so the UI doesn't show a bogus multi-year countdown.
  if (windowHours && windowHours > 0) {
    const maxReasonableMs = windowHours * 2 * 60 * 60 * 1000;
    if (remainingMs > maxReasonableMs) {
      return null;
    }
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [
    days > 0 ? `${days}d` : null,
    days > 0 || hours > 0 ? `${hours}h` : null,
    `${minutes}m`,
    `${seconds}s`,
  ].filter(Boolean);

  return `Resets in ${parts.join(" ")}`;
}

function MeterCountdown({
  description,
  resetsAt,
  fallbackText,
}: {
  description: string;
  resetsAt: string | null;
  fallbackText: string | null;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!resetsAt) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setNow(Date.now());
    });

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(intervalId);
    };
  }, [resetsAt]);

  const windowHours = parseWindowHours(description, fallbackText);
  const countdown =
    resetsAt && now !== null ? formatDuration(resetsAt, now, windowHours) ?? fallbackText : fallbackText;

  if (!countdown) {
    return null;
  }

  return <p className="mt-2 text-[10px] leading-[1.45] text-[#8a847a] sm:text-[11px]">{countdown}</p>;
}

export function SettingsUsageMeters({ meters }: { meters: UsageMeter[] }) {
  return (
    <div className="mt-6 space-y-3 sm:mt-7 sm:space-y-4">
      {meters.map((meter) => {
        const isBalanceOnlyMeter =
          meter.id === "credit-balance" && meter.resetsAt === null && meter.countdownText === null;

        return (
          <article
            key={meter.id}
            className="border border-[#b8b1a5] bg-[#fbfaf7] px-4 py-4 sm:px-5 sm:py-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-[#5f5a53] sm:text-[10px]">
                  {meter.label}
                </p>
                <p className="mt-2 text-[11px] leading-[1.55] text-[#8a847a] sm:text-[12px]">
                  {meter.description}
                </p>
              </div>

              <div className="text-right">
                <p className="whitespace-nowrap text-[11px] tracking-[-0.01em] text-[#4f4a43] sm:text-[13px]">
                  {isBalanceOnlyMeter ? meter.valueDisplay : `${meter.valueDisplay} / ${meter.totalDisplay}`}
                </p>
                <MeterCountdown
                  description={meter.description}
                  resetsAt={meter.resetsAt}
                  fallbackText={meter.countdownText}
                />
              </div>
            </div>

            {isBalanceOnlyMeter ? null : (
              <div className="mt-5 h-[6px] border border-[#8f887d] bg-[#f1ece5] p-[1px]">
                <div className="h-full bg-black" style={{ width: `${meter.progressPercent}%` }} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

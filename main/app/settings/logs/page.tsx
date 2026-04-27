import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { logsSection } from "@/content/account";
import { type UsageRequestSummary, webApi } from "@/lib/web-api";

export const metadata: Metadata = {
  title: "Logs - Dwipa Settings",
  description: "Review Dwipa API request history, token usage, and charged credit.",
};

const PAGE_SIZE = 10;

type LogsPageData = {
  items: UsageRequestSummary[];
  nextCursor: string | null;
};

async function getLogs(cursor: string | null): Promise<LogsPageData> {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    const response = await webApi.getUsageRequests(
      { limit: PAGE_SIZE, cursor, hasTokens: true },
      {
        cache: "no-store",
        headers: cookie ? { cookie } : undefined,
      },
    );

    return response;
  } catch {
    return { items: [], nextCursor: null };
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTokens(value: number) {
  return `${new Intl.NumberFormat("en").format(value || 0)} tok`;
}

function usageType(log: UsageRequestSummary) {
  if (!log.charge) return "Unpriced";
  return log.charge.countedTowardQuotaUsd > 0 ? "Credits" : "Metered";
}

function planType(log: UsageRequestSummary) {
  const planSlug = log.charge?.planSlug;
  if (planSlug === "payg") return "Payg";
  if (planSlug === "pro") return "Pro";
  if (planSlug === "free") return "Free";
  return "Unknown";
}

function modelLabel(log: UsageRequestSummary) {
  return log.model || "Unknown model";
}

function LogsEmptyState() {
  return (
    <div className="border border-[#b8b1a5] bg-[#fbfaf7] px-5 py-10 text-center">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#5f5a53]">{logsSection.emptyTitle}</p>
      <p className="mx-auto mt-2 max-w-[360px] text-[11px] leading-[1.55] text-[#8a847a]">
        {logsSection.emptyDescription}
      </p>
    </div>
  );
}

function LogsMobileList({ logs }: { logs: UsageRequestSummary[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {logs.map((log) => (
        <article key={log.id} className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-[13px] leading-[1.25] text-black">{modelLabel(log)}</p>
              <p className="mt-1 text-[10px] text-[#7a746b]">{log.status}</p>
            </div>
            <p className="shrink-0 text-right text-[10px] text-[#7a746b]">{formatDate(log.createdAt)}</p>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[10px]">
            <div>
              <dt className="uppercase tracking-[0.12em] text-[#8a847a]">Key</dt>
              <dd className="mt-1 truncate text-[#37322d]">{log.appLabel || "API key"}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.12em] text-[#8a847a]">Cost</dt>
              <dd className="mt-1 text-[#37322d]">{log.costDisplay}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.12em] text-[#8a847a]">Input</dt>
              <dd className="mt-1 text-[#37322d]">{formatTokens(log.inputTokens)}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.12em] text-[#8a847a]">Output</dt>
              <dd className="mt-1 text-[#37322d]">{formatTokens(log.outputTokens)}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.12em] text-[#8a847a]">Type</dt>
              <dd className="mt-1 text-[#37322d]">{planType(log)}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.12em] text-[#8a847a]">Status</dt>
              <dd className="mt-1 text-[#37322d]">{log.status}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function LogsTable({ logs }: { logs: UsageRequestSummary[] }) {
  return (
    <div className="hidden overflow-x-auto border border-[#b8b1a5] bg-[#fbfaf7] md:block">
      <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-[11px] leading-[1.35]">
        <colgroup>
          <col className="w-[19%]" />
          <col className="w-[14%]" />
          <col className="w-[10%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[#d8d0c3] bg-[#f2eee7] text-[9px] uppercase tracking-[0.12em] text-[#7a746b]">
            <th className="py-3 pl-5 pr-3 text-left font-medium">Date</th>
            <th className="py-3 pl-3 pr-1 text-left font-medium">Model</th>
            <th className="py-3 pl-1 pr-3 text-left font-medium">Key</th>
            <th className="px-3 py-3 text-left font-medium">Input</th>
            <th className="px-3 py-3 text-left font-medium">Output</th>
            <th className="px-3 py-3 text-left font-medium">Cost</th>
            <th className="px-3 py-3 text-left font-medium">Type</th>
            <th className="py-3 pl-3 pr-5 text-left font-medium">Usage type</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-[#e1dbd1] last:border-b-0">
              <td className="whitespace-nowrap py-4 pl-5 pr-3 text-left text-[#37322d]">
                {formatDate(log.createdAt)}
              </td>
              <td className="py-4 pl-3 pr-1 text-left">
                <span className="block truncate text-[#6370ff] underline underline-offset-2">{modelLabel(log)}</span>
              </td>
              <td className="py-4 pl-1 pr-3 text-left">
                <span className="block truncate text-[#6370ff] underline underline-offset-2">
                  {log.appLabel || "API key"}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-left text-[#37322d]">{formatTokens(log.inputTokens)}</td>
              <td className="whitespace-nowrap px-3 py-4 text-left text-[#37322d]">{formatTokens(log.outputTokens)}</td>
              <td className="whitespace-nowrap px-3 py-4 text-left text-[#111111]">{log.costDisplay}</td>
              <td className="whitespace-nowrap px-3 py-4 text-left text-[#37322d]">{planType(log)}</td>
              <td className="whitespace-nowrap py-4 pl-3 pr-5 text-left text-[#37322d]">{usageType(log)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildPageHref(cursor: string | null, previousCursors: string[]) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (previousCursors.length > 0) params.set("prev", previousCursors.join(","));
  const query = params.toString();
  return `/settings/logs${query ? `?${query}` : ""}`;
}

function PaginationControls({
  cursor,
  nextCursor,
  previousCursors,
}: {
  cursor: string | null;
  nextCursor: string | null;
  previousCursors: string[];
}) {
  if (!cursor && !nextCursor) return null;

  const previousCursor = previousCursors.at(-1) || null;
  const remainingPrevious = previousCursors.slice(0, -1);
  const nextPrevious = cursor ? [...previousCursors, cursor] : [""];

  return (
    <nav className="mt-5 flex items-center justify-between gap-4 text-[9px] uppercase tracking-[0.14em]">
      {cursor ? (
        <Link
          href={buildPageHref(previousCursor, remainingPrevious)}
          className="border border-[#b8b1a5] px-4 py-3 text-[#37322d] hover:border-black hover:text-black"
        >
          Previous
        </Link>
      ) : (
        <span className="border border-transparent px-4 py-3 text-[#b8b1a5]">Previous</span>
      )}

      <span className="text-[#8a847a]">{PAGE_SIZE} per page</span>

      {nextCursor ? (
        <Link
          href={buildPageHref(nextCursor, nextPrevious)}
          className="border border-[#b8b1a5] px-4 py-3 text-[#37322d] hover:border-black hover:text-black"
        >
          Next
        </Link>
      ) : (
        <span className="border border-transparent px-4 py-3 text-[#b8b1a5]">Next</span>
      )}
    </nav>
  );
}

type SettingsLogsPageProps = {
  searchParams?: Promise<{
    cursor?: string | string[];
    prev?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || null;
}

export default async function SettingsLogsPage({ searchParams }: SettingsLogsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const cursor = firstParam(params?.cursor);
  const previousCursors = (firstParam(params?.prev) || "").split(",").filter((value) => value !== "");
  const { items: logs, nextCursor } = await getLogs(cursor);

  return (
    <section>
      <div>
        <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">{logsSection.title}</h2>
        <p className="mt-2 max-w-[420px] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
          {logsSection.description}
        </p>
      </div>

      <div className="mt-6 sm:mt-7">
        {logs.length > 0 ? (
          <>
            <LogsMobileList logs={logs} />
            <LogsTable logs={logs} />
            <PaginationControls cursor={cursor} nextCursor={nextCursor} previousCursors={previousCursors} />
          </>
        ) : (
          <LogsEmptyState />
        )}
      </div>
    </section>
  );
}

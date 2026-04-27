import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { adminCopy, formatAdminDate } from "@/content/admin";
import { webApi } from "@/lib/web-api";

import { AdminChart } from "../components/admin-chart";
import { AdminMobileList, AdminTable } from "../components/admin-table";
import { AdminEmptyState } from "../components/empty-state";
import { StatusPill } from "../components/status-pill";

export const metadata: Metadata = { title: "Admin Usage - Dwipa", description: "Review Dwipa API usage across users." };

const PAGE_SIZE = 10;

async function getUsage(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    return await webApi.getAdminUsageRequests(
      {
        limit: PAGE_SIZE,
        userId: stringParam(searchParams.userId),
        status: stringParam(searchParams.status),
        provider: stringParam(searchParams.provider),
        model: stringParam(searchParams.model),
        from: stringParam(searchParams.from),
        to: stringParam(searchParams.to),
        cursor: stringParam(searchParams.cursor),
        hasTokens: "true",
      },
      { cache: "no-store", headers: cookie ? { cookie } : undefined },
    );
  } catch {
    return { items: [], nextCursor: null, summary: {}, charts: { requests: [], tokens: [], cost: [] } };
  }
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildUsagePageHref(
  params: Record<string, string | string[] | undefined>,
  cursor: string | null,
  previousCursors: string[],
) {
  const search = new URLSearchParams();

  for (const key of ["userId", "status", "provider", "model", "from", "to"]) {
    const value = stringParam(params[key]);
    if (value) search.set(key, value);
  }

  if (cursor) search.set("cursor", cursor);
  if (previousCursors.length > 0) search.set("prev", previousCursors.join(","));

  const query = search.toString();
  return `/admin/usage${query ? `?${query}` : ""}`;
}

function userKeyLabel(item: { userEmail?: string | null; appLabel?: string | null }) {
  if (item.userEmail && item.appLabel) return `${item.userEmail}/${item.appLabel}`;
  return item.userEmail || item.appLabel || "API key";
}

function PaginationControls({
  params,
  cursor,
  nextCursor,
  previousCursors,
}: {
  params: Record<string, string | string[] | undefined>;
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
          href={buildUsagePageHref(params, previousCursor, remainingPrevious)}
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
          href={buildUsagePageHref(params, nextCursor, nextPrevious)}
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

export default async function AdminUsagePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = await searchParams;
  const usage = await getUsage(resolvedSearchParams);
  const cursor = stringParam(resolvedSearchParams.cursor) || null;
  const previousCursors = (stringParam(resolvedSearchParams.prev) || "").split(",").filter((value) => value !== "");

  return (
    <section>
      <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">{adminCopy.usageTitle}</h2>
      <p className="mt-2 max-w-[520px] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">{adminCopy.usageDescription}</p>

      <form className="mt-6 grid gap-3 border border-[#d8d0c3] bg-[#fbfaf7] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input name="userId" defaultValue={stringParam(resolvedSearchParams.userId) || ""} placeholder="User id" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
        <input name="provider" defaultValue={stringParam(resolvedSearchParams.provider) || ""} placeholder="Provider" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
        <input name="model" defaultValue={stringParam(resolvedSearchParams.model) || ""} placeholder="Model" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
        <select name="status" defaultValue={stringParam(resolvedSearchParams.status) || ""} className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]">
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="rate_limited">Rate limited</option>
          <option value="payment_required">Payment required</option>
        </select>
        <input name="from" defaultValue={stringParam(resolvedSearchParams.from) || ""} placeholder="From ISO date" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
        <input name="to" defaultValue={stringParam(resolvedSearchParams.to) || ""} placeholder="To ISO date" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
        <button type="submit" className="min-h-[44px] rounded-none bg-black px-4 text-[8px] uppercase tracking-[0.16em] text-white sm:text-[9px]">
          Apply filters
        </button>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">Requests</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(usage.summary.requests ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">Input tokens</p><p className="mt-2 text-[18px] leading-none tracking-[-0.04em] text-black">{String(usage.summary.inputTokens ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">Output tokens</p><p className="mt-2 text-[18px] leading-none tracking-[-0.04em] text-black">{String(usage.summary.outputTokens ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">Charged cost</p><p className="mt-2 text-[18px] leading-none tracking-[-0.04em] text-black">{String(usage.summary.chargedCost ?? "-")}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">Failed</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(usage.summary.failedRequests ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">Avg latency</p><p className="mt-2 text-[18px] leading-none tracking-[-0.04em] text-black">{String(usage.summary.averageLatency ?? "-")}</p></article>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <AdminChart title="Requests" points={usage.charts.requests} />
        <AdminChart title="Tokens" points={usage.charts.tokens} />
        <AdminChart title="Cost" points={usage.charts.cost} />
      </div>

      <div className="mt-6">
        {usage.items.length === 0 ? (
          <AdminEmptyState title="No usage logs" description="Request metadata will appear here after API traffic is recorded." />
        ) : (
          <>
            <AdminTable>
              <table className="min-w-[900px] w-full border-collapse text-left text-[12px] leading-[1.45] text-[#37322d]">
                <thead className="border-b border-[#d8d0c3] bg-[#f7f5f2] text-[10px] uppercase tracking-[0.14em] text-[#5f5a53]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-normal">Model</th>
                    <th scope="col" className="px-4 py-3 font-normal">User / Key</th>
                    <th scope="col" className="px-4 py-3 font-normal">Status</th>
                    <th scope="col" className="px-4 py-3 font-normal">Cost</th>
                    <th scope="col" className="px-4 py-3 font-normal">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.items.map((item) => (
                    <tr key={item.id} className="border-b border-[#e4ddd2] last:border-b-0 hover:bg-[#f7f5f2]">
                      <td className="px-4 py-3 text-[13px] text-black">{item.model}</td>
                      <td className="px-4 py-3 text-[11px] text-[#7a746b]">{userKeyLabel(item)}</td>
                      <td className="px-4 py-3 text-[10px]"><StatusPill status={item.status} /></td>
                      <td className="px-4 py-3 text-black">{item.chargedCostDisplay || item.costDisplay}</td>
                      <td className="px-4 py-3">{formatAdminDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTable>

            <AdminMobileList>
              {usage.items.map((item) => (
                <article key={item.id} className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-[13px] text-black">{item.model}</p>
                      <p className="mt-1 text-[10px] text-[#7a746b]">{userKeyLabel(item)}</p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                  <p className="mt-3 text-[10px] text-[#7a746b]">
                    {formatAdminDate(item.createdAt)} • {item.chargedCostDisplay || item.costDisplay}
                  </p>
                </article>
              ))}
            </AdminMobileList>
          </>
        )}

        <PaginationControls
          params={resolvedSearchParams}
          cursor={cursor}
          nextCursor={usage.nextCursor}
          previousCursors={previousCursors}
        />
      </div>
    </section>
  );
}

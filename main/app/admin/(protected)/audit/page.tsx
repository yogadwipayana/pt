import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { adminCopy, formatAdminDate } from "@/content/admin";
import { webApi } from "@/lib/web-api";

import { AdminMobileList, AdminTable } from "../components/admin-table";
import { AdminEmptyState } from "../components/empty-state";
import { CursorPaginationControls } from "../components/pagination-controls";
import { AdminAuditFilterModal } from "./admin-audit-filter-modal";

export const metadata: Metadata = { title: "Admin Audit - Dwipa", description: "Review Dwipa admin audit events." };
const PAGE_SIZE = 10;

async function getAuditEvents(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    return await webApi.getAdminAuditEvents({
      limit: PAGE_SIZE,
      targetType: stringParam(searchParams.targetType),
      targetId: stringParam(searchParams.targetId),
      actorEmail: stringParam(searchParams.actorEmail),
      action: stringParam(searchParams.action),
      date: stringParam(searchParams.date),
      group: stringParam(searchParams.group),
      cursor: stringParam(searchParams.cursor),
    }, { cache: "no-store", headers: cookie ? { cookie } : undefined });
  } catch {
    return { items: [], nextCursor: null, summary: {} };
  }
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = await searchParams;
  const events = await getAuditEvents(resolvedSearchParams);
  const actorEmail = stringParam(resolvedSearchParams.actorEmail) || "";
  const action = stringParam(resolvedSearchParams.action) || "";
  const targetType = stringParam(resolvedSearchParams.targetType) || "";
  const targetId = stringParam(resolvedSearchParams.targetId) || "";
  const date = stringParam(resolvedSearchParams.date) || "";
  const group = stringParam(resolvedSearchParams.group) || "";
  const summaryCards = [
    {
      id: "today",
      label: "Events today",
      value: events.summary.eventsToday,
      href: "/admin/audit?date=today",
      active: date === "today" && !group,
    },
    {
      id: "approvals",
      label: "Payment approvals",
      value: events.summary.paymentApprovalsToday,
      href: "/admin/audit?date=today&group=payment_approvals",
      active: date === "today" && group === "payment_approvals",
    },
    {
      id: "rejections",
      label: "Payment rejections",
      value: events.summary.paymentRejectionsToday,
      href: "/admin/audit?date=today&group=payment_rejections",
      active: date === "today" && group === "payment_rejections",
    },
    {
      id: "catalog",
      label: "Catalog changes",
      value: events.summary.catalogChangesToday,
      href: "/admin/audit?date=today&group=catalog",
      active: date === "today" && group === "catalog",
    },
  ];

  return (
    <section>
      <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">{adminCopy.auditTitle}</h2>
      <p className="mt-2 max-w-[520px] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">{adminCopy.auditDescription}</p>

      <AdminAuditFilterModal>
        <form className="grid gap-3 p-5 sm:grid-cols-2" method="get">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="group" value={group} />
          <input name="actorEmail" defaultValue={actorEmail} placeholder="Actor email" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
          <input name="action" defaultValue={action} placeholder="Action" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
          <input name="targetType" defaultValue={targetType} placeholder="Target type" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
          <input name="targetId" defaultValue={targetId} placeholder="Target id" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
          <button type="submit" className="min-h-[44px] rounded-none bg-black px-4 text-[10px] uppercase tracking-[0.14em] text-white">Apply filters</button>
        </form>
      </AdminAuditFilterModal>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className={`block border bg-[#fbfaf7] p-4 transition-colors hover:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${card.active ? "border-black" : "border-[#b8b1a5]"}`}
            aria-label={`Filter audit events by ${card.label}`}
          >
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">{card.label}</p>
            <p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(card.value ?? 0)}</p>
            <p className="mt-4 text-[8px] uppercase tracking-[0.14em] text-[#6f695f]">{card.active ? "Selected" : "Open"}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {events.items.length === 0 ? (
          <AdminEmptyState title="No audit events" description="Admin mutation events will appear here." />
        ) : (
          <>
            <AdminTable>
              <table className="min-w-[980px] w-full border-collapse text-left text-[12px] leading-[1.45] text-[#37322d]">
                <thead className="border-b border-[#d8d0c3] bg-[#f7f5f2] text-[10px] uppercase tracking-[0.14em] text-[#5f5a53]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-normal">Action</th>
                    <th scope="col" className="px-4 py-3 font-normal">Actor</th>
                    <th scope="col" className="px-4 py-3 font-normal">Target</th>
                    <th scope="col" className="px-4 py-3 font-normal">Summary</th>
                    <th scope="col" className="px-4 py-3 font-normal">Metadata</th>
                    <th scope="col" className="px-4 py-3 font-normal">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {events.items.map((event) => (
                    <tr key={event.id} className="border-b border-[#e4ddd2] align-top last:border-b-0 hover:bg-[#f7f5f2]">
                      <td className="px-4 py-3 text-[13px] text-black">{event.action}</td>
                      <td className="px-4 py-3 text-[11px] text-[#7a746b]">{event.actorAdminEmail}</td>
                      <td className="px-4 py-3"><p>{event.targetType}</p><p className="mt-1 max-w-[180px] truncate text-[11px] text-[#7a746b]">{event.targetId}</p></td>
                      <td className="max-w-[300px] px-4 py-3">{event.summary}</td>
                      <td className="px-4 py-3">
                        {event.metadata ? (
                          <details>
                            <summary className="cursor-pointer text-[10px] uppercase tracking-[0.12em] text-[#4f4a43]">View</summary>
                            <pre className="mt-2 max-w-[280px] overflow-x-auto border border-[#d8d0c3] bg-[#f7f5f2] p-3 text-[10px] leading-[1.5] text-[#37322d]">
                              {JSON.stringify(event.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatAdminDate(event.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTable>

            <AdminMobileList>
              {events.items.map((event) => (
                <article key={event.id} className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-[13px] text-black">{event.action}</p>
                      <p className="mt-1 text-[10px] text-[#7a746b]">{event.actorAdminEmail}</p>
                    </div>
                    <p className="text-[10px] text-[#7a746b]">{formatAdminDate(event.createdAt)}</p>
                  </div>
                  <p className="mt-3 text-[10px] text-[#37322d]">{event.summary}</p>
                  <p className="mt-2 text-[10px] text-[#7a746b]">{event.targetType}: {event.targetId}</p>
                  {event.metadata ? (
                    <pre className="mt-3 overflow-x-auto border border-[#d8d0c3] bg-[#f7f5f2] p-3 text-[10px] leading-[1.5] text-[#37322d]">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  ) : null}
                </article>
              ))}
            </AdminMobileList>
          </>
        )}
      </div>

      <CursorPaginationControls
        basePath="/admin/audit"
        params={resolvedSearchParams}
        nextCursor={events.nextCursor}
        pageSize={PAGE_SIZE}
      />
    </section>
  );
}

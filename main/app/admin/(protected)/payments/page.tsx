import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { adminCopy, formatAdminDate, formatMinorCurrency } from "@/content/admin";
import { webApi } from "@/lib/web-api";

import { AdminMobileList, AdminTable } from "../components/admin-table";
import { AdminEmptyState } from "../components/empty-state";
import { CursorPaginationControls } from "../components/pagination-controls";
import { StatusPill } from "../components/status-pill";

export const metadata: Metadata = { title: "Admin Payments - Dwipa", description: "Review Dwipa manual payments." };
const PAGE_SIZE = 10;

async function getPayments(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    return await webApi.getAdminPayments({
      limit: PAGE_SIZE,
      q: stringParam(searchParams.q),
      status: stringParam(searchParams.status),
      purpose: stringParam(searchParams.purpose),
      queue: stringParam(searchParams.queue),
      cursor: stringParam(searchParams.cursor)
    }, { cache: "no-store", headers: cookie ? { cookie } : undefined });
  } catch (error) {
    console.error("Failed to load admin payments.", error);
    return { items: [], nextCursor: null, summary: {} };
  }
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = await searchParams;
  const payments = await getPayments(resolvedSearchParams);
  const q = stringParam(resolvedSearchParams.q) || "";
  const status = stringParam(resolvedSearchParams.status) || "";
  const purpose = stringParam(resolvedSearchParams.purpose) || "";
  const queue = stringParam(resolvedSearchParams.queue) || "";
  const summaryCards = [
    {
      id: "pending-transfer",
      label: "Pending transfer",
      value: payments.summary.pendingTransfer,
      href: "/admin/payments?status=pending_transfer",
      active: status === "pending_transfer",
      valueClassName: "text-[24px]",
    },
    {
      id: "under-review",
      label: "Under review",
      value: payments.summary.underReview,
      href: "/admin/payments?status=under_review",
      active: status === "under_review",
      valueClassName: "text-[24px]",
    },
    {
      id: "submitted",
      label: "Submitted",
      value: payments.summary.submitted,
      href: "/admin/payments?status=submitted",
      active: status === "submitted",
      valueClassName: "text-[24px]",
    },
    {
      id: "pending-amount",
      label: "Pending amount",
      value: payments.summary.pendingAmount || payments.summary.totalAmountSubmitted || "-",
      href: "/admin/payments?queue=review",
      active: queue === "review" && !status,
      valueClassName: "text-[18px]",
    },
  ];

  return (
    <section>
      <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">{adminCopy.paymentsTitle}</h2>
      <p className="mt-2 max-w-[520px] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">{adminCopy.paymentsDescription}</p>
      <form className="mt-6 grid gap-3 border border-[#d8d0c3] bg-[#fbfaf7] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input name="q" defaultValue={q} placeholder="Search reference or email" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
        <select name="status" defaultValue={status} className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]">
          <option value="">All statuses</option>
          <option value="pending_transfer">Pending transfer</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
        <select name="purpose" defaultValue={purpose} className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]">
          <option value="">All purposes</option>
          <option value="add_funds">Add funds</option>
          <option value="upgrade_plan">Upgrade plan</option>
        </select>
        <button type="submit" className="min-h-[44px] rounded-none bg-black px-4 text-[8px] uppercase tracking-[0.16em] text-white sm:text-[9px]">
          Apply filters
        </button>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className={`block border bg-[#fbfaf7] p-4 transition-colors hover:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${card.active ? "border-black" : "border-[#b8b1a5]"}`}
            aria-label={`Filter payments by ${card.label}`}
          >
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">{card.label}</p>
            <p className={`mt-2 leading-none tracking-[-0.05em] text-black ${card.valueClassName}`}>{String(card.value ?? 0)}</p>
            <p className="mt-4 text-[8px] uppercase tracking-[0.14em] text-[#6f695f]">{card.active ? "Selected" : "Open"}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {payments.items.length === 0 ? (
          <AdminEmptyState title="No payments need review" description="Pending transfer and submitted manual payments will appear here." />
        ) : (
          <>
            <AdminTable>
              <table className="min-w-[900px] w-full border-collapse text-left text-[12px] leading-[1.45] text-[#37322d]">
                <thead className="border-b border-[#d8d0c3] bg-[#f7f5f2] text-[10px] uppercase tracking-[0.14em] text-[#5f5a53]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-normal">Reference</th>
                    <th scope="col" className="px-4 py-3 font-normal">User</th>
                    <th scope="col" className="px-4 py-3 font-normal">Amount</th>
                    <th scope="col" className="px-4 py-3 font-normal">Purpose</th>
                    <th scope="col" className="px-4 py-3 font-normal">STATUS</th>
                    <th scope="col" className="px-4 py-3 font-normal">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.items.map((payment) => (
                    <tr key={payment.id} className="border-b border-[#e4ddd2] last:border-b-0 hover:bg-[#f7f5f2]">
                      <td className="px-4 py-3 text-[13px] text-black">
                        <Link href={`/admin/payments/${payment.id}`} className="underline-offset-4 hover:underline">
                          {payment.referenceCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#7a746b]">{payment.userEmail}</td>
                      <td className="px-4 py-3 text-black">{formatMinorCurrency(payment.amountMinor, payment.currency)}</td>
                      <td className="px-4 py-3">{payment.purpose}</td>
                      <td className="px-4 py-3 text-[10px]"><StatusPill status={payment.status} /></td>
                      <td className="px-4 py-3">{formatAdminDate(payment.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTable>

            <AdminMobileList>
              {payments.items.map((payment) => (
                <Link key={payment.id} href={`/admin/payments/${payment.id}`} className="block border border-[#b8b1a5] bg-[#fbfaf7] p-4 hover:border-black">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[13px] text-black">{payment.referenceCode}</p>
                      <p className="mt-1 text-[10px] text-[#7a746b]">{payment.userEmail}</p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-[10px] text-[#37322d]">
                    <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Amount</dt><dd className="mt-1">{formatMinorCurrency(payment.amountMinor, payment.currency)}</dd></div>
                    <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Purpose</dt><dd className="mt-1">{payment.purpose}</dd></div>
                    <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">STATUS</dt><dd className="mt-1"><StatusPill status={payment.status} /></dd></div>
                    <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Created</dt><dd className="mt-1">{formatAdminDate(payment.createdAt)}</dd></div>
                  </dl>
                </Link>
              ))}
            </AdminMobileList>
          </>
        )}
      </div>

      <CursorPaginationControls
        basePath="/admin/payments"
        params={resolvedSearchParams}
        nextCursor={payments.nextCursor}
        pageSize={PAGE_SIZE}
      />
    </section>
  );
}

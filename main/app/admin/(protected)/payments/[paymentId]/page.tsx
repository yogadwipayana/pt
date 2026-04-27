import type { Metadata } from "next";
import { headers } from "next/headers";

import { adminCopy, formatAdminDate, formatMinorCurrency } from "@/content/admin";
import { webApi } from "@/lib/web-api";

import { AdminEmptyState } from "../../components/empty-state";
import { StatusPill } from "../../components/status-pill";
import { AdminPaymentActions } from "../admin-payment-actions";

export const metadata: Metadata = { title: "Admin Payment Detail - Dwipa", description: "Review a Dwipa manual payment." };

type PageProps = { params: Promise<{ paymentId: string }> };

async function getPayment(paymentId: string) {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    return await webApi.getAdminPayment(paymentId, { cache: "no-store", headers: cookie ? { cookie } : undefined });
  } catch {
    return { payment: null, paymentId };
  }
}

export default async function AdminPaymentDetailPage({ params }: PageProps) {
  const { paymentId } = await params;
  const { payment } = await getPayment(paymentId);

  return (
    <section>
      <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">{adminCopy.paymentDetailTitle}</h2>
      <div className="mt-6">
        {!payment ? (
          <AdminEmptyState title="Payment not found" description="This payment is unavailable or has not been returned by the admin API yet." />
        ) : (
          <div className="space-y-4">
            <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[22px] leading-none tracking-[-0.04em] text-black">{payment.referenceCode}</p>
                  <p className="mt-2 text-[10px] text-[#7a746b]">{payment.user.email}</p>
                  <p className="mt-2 text-[18px] leading-none tracking-[-0.04em] text-black">{formatMinorCurrency(payment.amountMinor, payment.currency)}</p>
                </div>
                <StatusPill status={payment.status} />
              </div>
              <dl className="mt-4 grid gap-3 text-[10px] text-[#37322d] sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Purpose</dt><dd className="mt-1">{payment.purpose}</dd></div>
                <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Submitted</dt><dd className="mt-1">{formatAdminDate(payment.submittedAt)}</dd></div>
                <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Transferred</dt><dd className="mt-1">{formatAdminDate(payment.transferredAt)}</dd></div>
                <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Created</dt><dd className="mt-1">{formatAdminDate(payment.createdAt)}</dd></div>
              </dl>
            </article>

            <div className="grid gap-4 lg:grid-cols-2">
              <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
                <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">Payment submission</p>
                <dl className="mt-4 grid gap-3 text-[10px] text-[#37322d] sm:grid-cols-2">
                  <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Sender name</dt><dd className="mt-1">{payment.senderName || "-"}</dd></div>
                  <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Sender reference</dt><dd className="mt-1">{payment.senderReference || "-"}</dd></div>
                  <div className="sm:col-span-2"><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Notes</dt><dd className="mt-1">{payment.notes || "-"}</dd></div>
                  <div className="sm:col-span-2"><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Reject reason</dt><dd className="mt-1">{payment.rejectionReason || "-"}</dd></div>
                </dl>
              </article>

              <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
                <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">Destination snapshot</p>
                {payment.destination ? (
                  <dl className="mt-4 grid gap-3 text-[10px] text-[#37322d] sm:grid-cols-2">
                    <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Provider</dt><dd className="mt-1">{payment.destination.provider}</dd></div>
                    <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Display name</dt><dd className="mt-1">{payment.destination.displayName}</dd></div>
                    <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Account number</dt><dd className="mt-1">{payment.destination.accountNumber}</dd></div>
                    <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Account holder</dt><dd className="mt-1">{payment.destination.accountHolderName}</dd></div>
                    <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Active</dt><dd className="mt-1">{payment.destination.isActive ? "Active" : "Inactive"}</dd></div>
                    <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Updated</dt><dd className="mt-1">{formatAdminDate(payment.destination.updatedAt)}</dd></div>
                  </dl>
                ) : (
                  <p className="mt-4 text-[10px] text-[#7a746b]">No destination snapshot available.</p>
                )}
              </article>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
                <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">User context</p>
                <dl className="mt-4 grid gap-3 text-[10px] text-[#37322d] sm:grid-cols-2">
                  <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">User id</dt><dd className="mt-1">{payment.user.id}</dd></div>
                  <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Email</dt><dd className="mt-1">{payment.user.email}</dd></div>
                  <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Name</dt><dd className="mt-1">{payment.user.name || "-"}</dd></div>
                  <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Current plan</dt><dd className="mt-1">{payment.user.planSlug}</dd></div>
                  <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Status</dt><dd className="mt-1">{payment.user.status || "-"}</dd></div>
                </dl>
              </article>

              <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
                <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">Fulfillment preview</p>
                <div className="mt-4 space-y-2 text-[10px] text-[#37322d]">
                  {payment.purpose === "add_funds" ? (
                    <p>Approving this payment adds {formatMinorCurrency(payment.amountMinor, payment.currency)} to the user&apos;s credit flow.</p>
                  ) : (
                    <p>Approving this payment moves the user to plan <span className="text-black">{payment.planSlug || "-"}</span>.</p>
                  )}
                  <p>Approved at: {formatAdminDate(payment.approvedAt)}</p>
                  <p>Rejected at: {formatAdminDate(payment.rejectedAt)}</p>
                </div>
              </article>
            </div>

            <AdminPaymentActions paymentId={payment.id} status={payment.status} />
          </div>
        )}
      </div>
    </section>
  );
}

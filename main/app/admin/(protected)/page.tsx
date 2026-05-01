import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { adminCopy, formatAdminDate, formatMinorCurrency } from "@/content/admin";
import { webApi } from "@/lib/web-api";

import { AdminChart } from "./components/admin-chart";

export const metadata: Metadata = {
  title: "Admin Overview - Dwipa",
  description: "Dwipa admin operational overview.",
};

const metricLinks: Record<string, string> = {
  "active-users": "/admin/users",
  "approved-revenue": "/admin/payments",
  failed: "/admin/usage",
  payments: "/admin/payments",
  "pending-payments": "/admin/payments",
  requests: "/admin/usage",
  revenue: "/admin/payments",
  "submitted-today": "/admin/payments",
  users: "/admin/users",
};

async function getOverview() {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    return await webApi.getAdminOverview({ cache: "no-store", headers: cookie ? { cookie } : undefined });
  } catch {
    return { metrics: [], workQueue: { payments: [], users: [], requests: [] }, charts: { requests: [], revenue: [], errors: [] } };
  }
}

export default async function AdminOverviewPage() {
  const overview = await getOverview();

  return (
    <section>
      <div>
        <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">{adminCopy.overviewTitle}</h2>
        <p className="mt-2 max-w-[520px] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">{adminCopy.overviewDescription}</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {overview.metrics.map((metric) => {
          const href = metricLinks[metric.id];
          const content = (
            <>
              <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">{metric.label}</p>
              <p className="mt-2 text-[26px] leading-none tracking-[-0.05em] text-black">{metric.value}</p>
              <p className="mt-2 text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">{metric.description}</p>
              {href ? (
                <p className="mt-4 text-[8px] uppercase tracking-[0.14em] text-[#6f695f] group-hover:text-black sm:text-[9px]">
                  Open
                </p>
              ) : null}
            </>
          );

          return href ? (
            <Link
              key={metric.id}
              href={href}
              aria-label={`Open ${metric.label}`}
              className="group block border border-[#b8b1a5] bg-[#fbfaf7] p-4 transition-colors hover:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              {content}
            </Link>
          ) : (
            <article key={metric.id} className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
              {content}
            </article>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <AdminChart title="API requests" points={overview.charts.requests} />
        <AdminChart title="Approved revenue" points={overview.charts.revenue} />
        <AdminChart title="Failed requests" points={overview.charts.errors} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">Needs review</p>
            <Link href="/admin/payments" className="text-[9px] uppercase tracking-[0.14em] text-[#37322d] underline underline-offset-4">
              Review payments
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {overview.workQueue.payments.length === 0 ? (
              <p className="text-[10px] text-[#7a746b]">No pending work.</p>
            ) : (
              overview.workQueue.payments.map((payment) => (
                <Link key={payment.id} href={`/admin/payments/${payment.id}`} className="block border border-[#d8d0c3] p-3 hover:border-black">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] text-black">{payment.referenceCode}</p>
                      <p className="mt-1 text-[10px] text-[#7a746b]">{payment.userEmail}</p>
                    </div>
                    <p className="text-[10px] text-[#37322d]">{formatMinorCurrency(payment.amountMinor, payment.currency)}</p>
                  </div>
                  <p className="mt-2 text-[10px] text-[#7a746b]">{payment.status} • {formatAdminDate(payment.submittedAt || payment.createdAt)}</p>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">Recent activity</p>
              <Link href="/admin/usage" className="text-[9px] uppercase tracking-[0.14em] text-[#37322d] underline underline-offset-4">
                View usage
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {overview.workQueue.requests.slice(0, 3).map((request) => (
                <div key={request.id} className="border border-[#d8d0c3] p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] text-black">{request.model}</p>
                      <p className="mt-1 text-[10px] text-[#7a746b]">{request.userEmail || request.appLabel || "API key"}</p>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">{request.status}</p>
                  </div>
                  <p className="mt-2 text-[10px] text-[#7a746b]">{formatAdminDate(request.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">Quick links</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { href: "/admin/payments", label: "Review payments" },
                { href: "/admin/users", label: "Search users" },
                { href: "/admin/usage", label: "View usage logs" },
                { href: "/admin/models", label: "Manage models" },
                { href: "/admin/plans", label: "Manage plans" },
                { href: "/admin/audit", label: "View audit log" },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="border border-[#d8d0c3] px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-[#37322d] hover:border-black hover:text-black">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

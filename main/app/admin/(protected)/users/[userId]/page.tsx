import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { adminCopy, formatAdminDate } from "@/content/admin";
import { webApi } from "@/lib/web-api";

import { AdminChart } from "../../components/admin-chart";
import { AdminEmptyState } from "../../components/empty-state";
import { AdminUserActions } from "../admin-user-actions";

export const metadata: Metadata = { title: "Admin User Detail - Dwipa", description: "Inspect a Dwipa user." };

type PageProps = { params: Promise<{ userId: string }> };

type DetailField = {
  label: string;
  value: string;
};

function normalizeAdminUser(user: Awaited<ReturnType<typeof webApi.getAdminUser>>["user"]) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    name: user.name || "",
    apiKeys: Array.isArray(user.apiKeys) ? user.apiKeys : [],
    recentUsage: Array.isArray(user.recentUsage) ? user.recentUsage : [],
    recentPayments: Array.isArray(user.recentPayments) ? user.recentPayments : [],
  };
}

async function getUser(userId: string) {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    const response = await webApi.getAdminUser(userId, { cache: "no-store", headers: cookie ? { cookie } : undefined });
    return { ...response, user: normalizeAdminUser(response.user) };
  } catch {
    return { user: null, userId };
  }
}

function buildProfileFields(user: NonNullable<Awaited<ReturnType<typeof getUser>>["user"]>) {
  const fields: DetailField[] = [];

  if (user.name) fields.push({ label: "Full name", value: user.name });
  if (user.profile?.username) fields.push({ label: "Username", value: user.profile.username });
  if (user.createdAt) fields.push({ label: "Created", value: formatAdminDate(user.createdAt) });
  if (user.lastSeenAt) fields.push({ label: "Last seen", value: formatAdminDate(user.lastSeenAt) });
  if (user.profile?.company) fields.push({ label: "Company", value: user.profile.company });
  if (user.profile?.timezone) fields.push({ label: "Timezone", value: user.profile.timezone });

  return fields;
}

function buildBillingFields(user: NonNullable<Awaited<ReturnType<typeof getUser>>["user"]>) {
  const fields: DetailField[] = [];

  if (user.planSlug) fields.push({ label: "Plan", value: user.planSlug });
  if (user.subscription?.status) fields.push({ label: "Subscription status", value: user.subscription.status });
  if (user.subscription) fields.push({ label: "Auto renew", value: user.subscription.autoRenew ? "On" : "Off" });
  if (user.subscription?.renewsAt) fields.push({ label: "Renews at", value: formatAdminDate(user.subscription.renewsAt) });
  if (user.creditBalanceDisplay) fields.push({ label: "Credit balance", value: user.creditBalanceDisplay });

  return fields;
}

function DetailSection({ title, fields }: { title: string; fields: DetailField[] }) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
      <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">{title}</p>
      <dl className="mt-4 grid gap-3 text-[10px] text-[#37322d] sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="uppercase tracking-[0.12em] text-[#8a847a]">{field.label}</dt>
            <dd className="mt-1">{field.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { userId } = await params;
  const { user } = await getUser(userId);

  if (!user) {
    return (
      <section>
        <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">User detail</h2>
        <div className="mt-6">
          <AdminEmptyState title="User not found" description="This user is unavailable or has not been returned by the admin API yet." />
        </div>
        <p className="sr-only">{adminCopy.usersDescription}</p>
      </section>
    );
  }

  const profileFields = buildProfileFields(user);
  const billingFields = buildBillingFields(user);
  const usagePoints = Array.isArray(user.charts?.usage) ? user.charts.usage : [];
  const recentUsage = user.recentUsage.slice(0, 5);
  const recentPayments = user.recentPayments.slice(0, 5);

  return (
    <section>
      <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">User detail</h2>
      <div className="mt-6 space-y-4">
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
          <p className="text-[20px] leading-none tracking-[-0.04em] text-black">{user.email}</p>
          <p className="mt-2 text-[10px] text-[#7a746b]">{user.id}</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">{`${user.status || "active"} / ${user.planSlug}`}</p>
        </article>

        {usagePoints.length > 0 ? <AdminChart title="User usage" points={usagePoints} /> : null}

        {profileFields.length > 0 || billingFields.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailSection title="Profile" fields={profileFields} />
            <DetailSection title="Plan and billing" fields={billingFields} />
          </div>
        ) : null}

        {user.apiKeys.length > 0 || recentUsage.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {user.apiKeys.length > 0 ? (
              <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">API keys</p>
                  <p className="text-[9px] uppercase tracking-[0.14em] text-[#7a746b]">{user.apiKeys.length} keys</p>
                </div>
                <div className="mt-4 space-y-3">
                  {user.apiKeys.map((key) => (
                    <div key={key.id} className="border border-[#d8d0c3] p-3">
                      <p className="text-[12px] text-black">{key.label}</p>
                      <p className="mt-1 text-[10px] text-[#7a746b]">{key.maskedKey}</p>
                      <p className="mt-2 text-[10px] text-[#7a746b]">{`${key.usageMode || "both"} / last used ${formatAdminDate(key.lastUsedAt)}`}</p>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {recentUsage.length > 0 ? (
              <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">Recent usage</p>
                  <Link href={`/admin/usage?userId=${encodeURIComponent(user.id)}`} className="text-[9px] uppercase tracking-[0.14em] text-[#37322d] underline underline-offset-4">
                    View all
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {recentUsage.map((request) => (
                    <div key={request.id} className="border border-[#d8d0c3] p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[12px] text-black">{request.model}</p>
                          <p className="mt-1 text-[10px] text-[#7a746b]">{request.provider}</p>
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">{request.status}</p>
                      </div>
                      <p className="mt-2 text-[10px] text-[#7a746b]">{`${request.chargedCostDisplay || request.costDisplay} / ${formatAdminDate(request.createdAt)}`}</p>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}
          </div>
        ) : null}

        {recentPayments.length > 0 ? (
          <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">Recent payments</p>
              <Link href={`/admin/payments?q=${encodeURIComponent(user.email)}`} className="text-[9px] uppercase tracking-[0.14em] text-[#37322d] underline underline-offset-4">
                View payments
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="border border-[#d8d0c3] p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] text-black">{payment.referenceCode}</p>
                      <p className="mt-1 text-[10px] text-[#7a746b]">{payment.purpose}</p>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">{payment.status}</p>
                  </div>
                  <p className="mt-2 text-[10px] text-[#7a746b]">{`${payment.amountDisplay || "-"} / ${formatAdminDate(payment.createdAt)}`}</p>
                </div>
              ))}
            </div>
          </article>
        ) : null}

        <AdminUserActions
          userId={user.id}
          currentPlanSlug={user.planSlug}
          currentEmail={user.email}
          currentName={user.name}
          currentStatus={user.status || "active"}
        />
      </div>
      <p className="sr-only">{adminCopy.usersDescription}</p>
    </section>
  );
}

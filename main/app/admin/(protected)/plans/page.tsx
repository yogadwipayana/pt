import type { Metadata } from "next";
import { headers } from "next/headers";

import { adminCopy } from "@/content/admin";
import { webApi } from "@/lib/web-api";

import { AdminMobileList, AdminTable } from "../components/admin-table";
import { AdminEmptyState } from "../components/empty-state";
import { AdminPlanManager } from "./admin-plan-manager";

export const metadata: Metadata = { title: "Admin Plans - Dwipa", description: "Manage Dwipa pricing plans." };

async function getPlans() {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    return await webApi.getAdminPlans({ cache: "no-store", headers: cookie ? { cookie } : undefined });
  } catch {
    return { plans: [] };
  }
}

export default async function AdminPlansPage() {
  const { plans } = await getPlans();

  return (
    <section>
      <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">{adminCopy.plansTitle}</h2>
      <p className="mt-2 max-w-[520px] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">{adminCopy.plansDescription}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">Free policy</p><p className="mt-2 text-[11px] leading-[1.6] text-[#37322d]">$0 starting balance; credits added through manual top-ups.</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">Pro policy</p><p className="mt-2 text-[11px] leading-[1.6] text-[#37322d]">$10 credit every 12 hours; Rp 50.000/month.</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">PayG policy</p><p className="mt-2 text-[11px] leading-[1.6] text-[#37322d]">50% discount for every model.</p></article>
      </div>

      <div className="mt-6">
        {plans.length === 0 ? (
          <AdminEmptyState />
        ) : (
          <>
            <AdminTable>
              <table className="min-w-[900px] w-full border-collapse text-left text-[12px] leading-[1.45] text-[#37322d]">
                <thead className="border-b border-[#d8d0c3] bg-[#f7f5f2] text-[10px] uppercase tracking-[0.14em] text-[#5f5a53]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-normal">Plan</th>
                    <th scope="col" className="px-4 py-3 font-normal">Billing</th>
                    <th scope="col" className="px-4 py-3 font-normal">Price</th>
                    <th scope="col" className="px-4 py-3 font-normal">Credit</th>
                    <th scope="col" className="px-4 py-3 font-normal">Discount</th>
                    <th scope="col" className="px-4 py-3 font-normal">Status</th>
                    <th scope="col" className="px-4 py-3 font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <AdminPlanManager key={plan.id} plan={plan} />
                  ))}
                </tbody>
              </table>
            </AdminTable>

            <AdminMobileList>
              {plans.map((plan) => (
                <AdminPlanManager key={plan.id} plan={plan} mobile />
              ))}
            </AdminMobileList>
          </>
        )}
      </div>
    </section>
  );
}

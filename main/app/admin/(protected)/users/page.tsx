import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { adminCopy, formatAdminDate } from "@/content/admin";
import { webApi } from "@/lib/web-api";

import { AdminMobileList, AdminTable } from "../components/admin-table";
import { AdminEmptyState } from "../components/empty-state";
import { CursorPaginationControls } from "../components/pagination-controls";

export const metadata: Metadata = { title: "Admin Users - Dwipa", description: "Search and inspect Dwipa users." };
const PAGE_SIZE = 10;

async function getUsers(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    return await webApi.getAdminUsers({
      limit: PAGE_SIZE,
      q: stringParam(searchParams.q),
      plan: stringParam(searchParams.plan),
      status: stringParam(searchParams.status),
      cursor: stringParam(searchParams.cursor)
    }, { cache: "no-store", headers: cookie ? { cookie } : undefined });
  } catch {
    return { items: [], nextCursor: null, summary: {} };
  }
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = await searchParams;
  const users = await getUsers(resolvedSearchParams);
  return (
    <section>
      <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">{adminCopy.usersTitle}</h2>
      <p className="mt-2 max-w-[520px] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">{adminCopy.usersDescription}</p>
      <form className="mt-6 grid gap-3 border border-[#d8d0c3] bg-[#fbfaf7] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input name="q" defaultValue={stringParam(resolvedSearchParams.q) || ""} placeholder="Search email or name" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
        <select name="plan" defaultValue={stringParam(resolvedSearchParams.plan) || ""} className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]">
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="payg">Pay as you go</option>
        </select>
        <select name="status" defaultValue={stringParam(resolvedSearchParams.status) || ""} className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="deleted">Deleted</option>
        </select>
        <button type="submit" className="min-h-[44px] rounded-none bg-black px-4 text-[8px] uppercase tracking-[0.16em] text-white sm:text-[9px]">Apply filters</button>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">Total users</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(users.summary.totalUsers ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">New today</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(users.summary.newUsersToday ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">Active 24h</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(users.summary.activeUsers24h ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">Pro users</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(users.summary.proUsers ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53]">PayG users</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(users.summary.paygUsers ?? 0)}</p></article>
      </div>

      <div className="mt-6">
        {users.items.length === 0 ? <AdminEmptyState /> : (
          <>
            <AdminTable>
              <table className="min-w-[900px] w-full border-collapse text-left text-[12px] leading-[1.45] text-[#37322d]">
                <thead className="border-b border-[#d8d0c3] bg-[#f7f5f2] text-[10px] uppercase tracking-[0.14em] text-[#5f5a53]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-normal">User</th>
                    <th scope="col" className="px-4 py-3 font-normal">Name / ID</th>
                    <th scope="col" className="px-4 py-3 font-normal">Plan</th>
                    <th scope="col" className="px-4 py-3 font-normal">Status</th>
                    <th scope="col" className="px-4 py-3 font-normal">Balance</th>
                    <th scope="col" className="px-4 py-3 font-normal">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.items.map((user) => (
                    <tr key={user.id} className="border-b border-[#e4ddd2] last:border-b-0 hover:bg-[#f7f5f2]">
                      <td className="px-4 py-3 text-[13px] text-black">
                        <Link href={`/admin/users/${user.id}`} className="underline-offset-4 hover:underline">
                          {user.email}
                        </Link>
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-[11px] text-[#7a746b]">{user.name || user.id}</td>
                      <td className="px-4 py-3 uppercase tracking-[0.08em] text-[#4f4a43]">{user.planSlug}</td>
                      <td className="px-4 py-3 uppercase tracking-[0.08em] text-[#7a746b]">{user.status || "active"}</td>
                      <td className="px-4 py-3 text-black">{user.creditBalanceDisplay}</td>
                      <td className="px-4 py-3">{formatAdminDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTable>

            <AdminMobileList>
              {users.items.map((user) => (
                <Link key={user.id} href={`/admin/users/${user.id}`} className="block border border-[#b8b1a5] bg-[#fbfaf7] p-4 hover:border-black">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><p className="truncate text-[13px] text-black">{user.email}</p><p className="mt-1 text-[10px] text-[#7a746b]">{user.name || user.id}</p></div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#4f4a43]">{user.planSlug}</p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[#7a746b]">{user.status || "active"}</p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-[10px]"><div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Balance</dt><dd className="mt-1">{user.creditBalanceDisplay}</dd></div><div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Created</dt><dd className="mt-1">{formatAdminDate(user.createdAt)}</dd></div></dl>
                </Link>
              ))}
            </AdminMobileList>
          </>
        )}
      </div>

      <CursorPaginationControls
        basePath="/admin/users"
        params={resolvedSearchParams}
        nextCursor={users.nextCursor}
        pageSize={PAGE_SIZE}
      />
    </section>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";

import { adminCopy } from "@/content/admin";
import { webApi } from "@/lib/web-api";

import { AdminMobileList, AdminTable } from "../components/admin-table";
import { AdminEmptyState } from "../components/empty-state";
import { OffsetPaginationControls } from "../components/pagination-controls";
import { AdminModelFilterModal } from "./admin-model-filter-modal";
import { AdminModelListItem } from "./admin-model-list-item";
import { AdminModelManager } from "./admin-model-manager";

export const metadata: Metadata = { title: "Admin Models - Dwipa", description: "Manage Dwipa model catalog." };
const PAGE_SIZE = 10;

async function getModels(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    return await webApi.getAdminModels({
      q: stringParam(searchParams.q),
      provider: stringParam(searchParams.provider),
      visibility: stringParam(searchParams.visibility),
      accessState: stringParam(searchParams.accessState),
    }, { cache: "no-store", headers: cookie ? { cookie } : undefined });
  } catch {
    return { items: [], nextCursor: null, summary: {} };
  }
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageParam(value: string | string[] | undefined) {
  const page = Number(stringParam(value) || 1);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

export default async function AdminModelsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = await searchParams;
  const models = await getModels(resolvedSearchParams);
  const totalPages = Math.max(1, Math.ceil(models.items.length / PAGE_SIZE));
  const currentPage = Math.min(pageParam(resolvedSearchParams.page), totalPages);
  const paginatedItems = models.items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <section>
      <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">{adminCopy.modelsTitle}</h2>
      <p className="mt-2 max-w-[520px] text-[12px] leading-[1.6] text-[#8a847a]">{adminCopy.modelsDescription}</p>

      <AdminModelFilterModal>
        <form className="grid gap-3 p-5 sm:grid-cols-2" method="get">
          <input name="q" defaultValue={stringParam(resolvedSearchParams.q) || ""} placeholder="Search display name or model id" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px] sm:col-span-2" />
          <input name="provider" defaultValue={stringParam(resolvedSearchParams.provider) || ""} placeholder="Provider" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
          <select name="visibility" defaultValue={stringParam(resolvedSearchParams.visibility) || ""} className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]">
            <option value="">All visibility</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </select>
          <select name="accessState" defaultValue={stringParam(resolvedSearchParams.accessState) || ""} className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]">
            <option value="">All access</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>

          <button type="submit" className="min-h-[44px] rounded-none bg-black px-4 text-[10px] uppercase tracking-[0.14em] text-white">Apply filters</button>
        </form>
      </AdminModelFilterModal>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">Total models</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(models.summary.totalModels ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">Visible</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(models.summary.visibleModels ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">Hidden</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(models.summary.hiddenModels ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">Providers</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(models.summary.providersCount ?? 0)}</p></article>
        <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">Missing pricing</p><p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(models.summary.missingPricing ?? 0)}</p></article>
      </div>

      <div className="mt-6">
        <AdminModelManager mode="create" />
      </div>

      <div className="mt-6">
        {models.items.length === 0 ? (
          <AdminEmptyState />
        ) : (
          <div className="space-y-4">
            <AdminTable>
              <table className="min-w-[900px] w-full border-collapse text-left text-[12px] leading-[1.45] text-[#37322d]">
                <thead className="border-b border-[#d8d0c3] bg-[#f7f5f2] text-[10px] uppercase tracking-[0.14em] text-[#5f5a53]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-normal">Model</th>
                    <th scope="col" className="px-4 py-3 font-normal">Provider</th>
                    <th scope="col" className="px-4 py-3 font-normal">Status</th>
                    <th scope="col" className="px-4 py-3 font-normal">Updated</th>
                    <th scope="col" className="px-4 py-3 font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((model) => (
                    <AdminModelListItem key={model.id} model={model} />
                  ))}
                </tbody>
              </table>
            </AdminTable>

            <AdminMobileList>
              {paginatedItems.map((model) => (
                <AdminModelListItem key={model.id} model={model} mobile />
              ))}
            </AdminMobileList>
          </div>
        )}
      </div>

      <OffsetPaginationControls
        basePath="/admin/models"
        params={resolvedSearchParams}
        page={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={models.items.length}
        totalPages={totalPages}
      />
    </section>
  );
}

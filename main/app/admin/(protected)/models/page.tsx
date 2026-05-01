import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

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
      pricing: stringParam(searchParams.pricing),
      sort: stringParam(searchParams.sort),
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
  const q = stringParam(resolvedSearchParams.q) || "";
  const provider = stringParam(resolvedSearchParams.provider) || "";
  const visibility = stringParam(resolvedSearchParams.visibility) || "";
  const accessState = stringParam(resolvedSearchParams.accessState) || "";
  const pricing = stringParam(resolvedSearchParams.pricing) || "";
  const sort = stringParam(resolvedSearchParams.sort) || "";
  const totalPages = Math.max(1, Math.ceil(models.items.length / PAGE_SIZE));
  const currentPage = Math.min(pageParam(resolvedSearchParams.page), totalPages);
  const paginatedItems = models.items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const summaryCards = [
    {
      id: "total",
      label: "Total models",
      value: models.summary.totalModels,
      href: "/admin/models",
      active: !q && !provider && !visibility && !accessState && !pricing && !sort,
    },
    {
      id: "visible",
      label: "Visible",
      value: models.summary.visibleModels,
      href: "/admin/models?visibility=visible",
      active: visibility === "visible",
    },
    {
      id: "hidden",
      label: "Hidden",
      value: models.summary.hiddenModels,
      href: "/admin/models?visibility=hidden",
      active: visibility === "hidden",
    },
    {
      id: "providers",
      label: "Providers",
      value: models.summary.providersCount,
      href: "/admin/models?sort=provider",
      active: sort === "provider",
    },
    {
      id: "missing-pricing",
      label: "Missing pricing",
      value: models.summary.missingPricing,
      href: "/admin/models?pricing=missing",
      active: pricing === "missing",
    },
  ];

  return (
    <section>
      <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">{adminCopy.modelsTitle}</h2>
      <p className="mt-2 max-w-[520px] text-[12px] leading-[1.6] text-[#8a847a]">{adminCopy.modelsDescription}</p>

      <AdminModelFilterModal>
        <form className="grid gap-3 p-5 sm:grid-cols-2" method="get">
          <input type="hidden" name="pricing" value={pricing} />
          <input type="hidden" name="sort" value={sort} />
          <input name="q" defaultValue={q} placeholder="Search display name or model id" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px] sm:col-span-2" />
          <input name="provider" defaultValue={provider} placeholder="Provider" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
          <select name="visibility" defaultValue={visibility} className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]">
            <option value="">All visibility</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </select>
          <select name="accessState" defaultValue={accessState} className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]">
            <option value="">All access</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>

          <button type="submit" className="min-h-[44px] rounded-none bg-black px-4 text-[10px] uppercase tracking-[0.14em] text-white">Apply filters</button>
        </form>
      </AdminModelFilterModal>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className={`block border bg-[#fbfaf7] p-4 transition-colors hover:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${card.active ? "border-black" : "border-[#b8b1a5]"}`}
            aria-label={`Filter models by ${card.label}`}
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">{card.label}</p>
            <p className="mt-2 text-[24px] leading-none tracking-[-0.05em] text-black">{String(card.value ?? 0)}</p>
            <p className="mt-4 text-[8px] uppercase tracking-[0.14em] text-[#6f695f]">{card.active ? "Selected" : "Open"}</p>
          </Link>
        ))}
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

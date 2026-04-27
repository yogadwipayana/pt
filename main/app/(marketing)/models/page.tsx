import type { Metadata } from "next";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";
import { modelDirectory } from "@/content/models";
import { webApi } from "@/lib/web-api";

import { ModelsCatalog } from "./models-catalog";

export const metadata: Metadata = {
  title: "Dwipa Models - API Directory",
  description:
    "Browse Dwipa's API directory of frontier and open models with unified pricing, latency, and context window details.",
};

async function getModels() {
  try {
    const response = await webApi.getPublicModels({ cache: "no-store" });
    return response.items.length > 0 ? response.items : modelDirectory;
  } catch {
    return modelDirectory;
  }
}

export default async function ModelsPage() {
  const models = await getModels();

  return (
    <main className="min-h-screen bg-[#f7f3eb] pb-6 pt-[6px] text-[#111111]">
      <SiteHeader />

      <PageContainer>
        <section className="border-t border-[#bdb7ab] pb-4 pt-5 sm:pb-5 sm:pt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[12px] uppercase tracking-[0.12em] text-[#7b7469]">
                API Directory // v1 // {models.length} models
              </p>
              <h1 className="mt-2 text-[28px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[36px] lg:text-[42px]">
                MODEL DIRECTORY
              </h1>
            </div>
          </div>
        </section>

        <ModelsCatalog items={models} />
      </PageContainer>
    </main>
  );
}

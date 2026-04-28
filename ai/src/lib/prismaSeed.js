import { createRequire } from 'module'
import { prisma } from "../db.js";
import { buildModelCatalogSeedRows } from "./modelCatalogSeed.js";
import { buildPlanCatalogSeedRows } from "./planCatalogSeed.js";

const require = createRequire(import.meta.url)
const { Prisma } = require("../generated/prisma/index.js");

/**
 * Seed ModelCatalog using Prisma Client (Neon adapter).
 * Mirrors the behavior of dbSeedAdminModelCatalog from adminPostgres.js:
 * - Upserts existing rows by modelId or slug
 * - Deletes rows whose modelId is no longer in the seed source
 */
export async function prismaSeedModelCatalog(dryRun = false) {
  const rows = buildModelCatalogSeedRows();
  const sourceModelIds = new Set(rows.map((r) => r.modelId).filter(Boolean));

  let inserted = 0;
  let updated = 0;
  let deleted = 0;

  for (const row of rows) {
    if (!row.slug || !row.name || !row.provider || !row.providerCode || !row.modelId) {
      continue;
    }

    const existing = await prisma.modelCatalog.findFirst({
      where: {
        OR: [{ modelId: row.modelId }, { slug: row.slug }],
      },
    });

    const data = {
      slug: row.slug,
      name: row.name,
      provider: row.provider,
      providerCode: row.providerCode,
      modelId: row.modelId,
      summary: row.summary || "",
      contextWindow: row.contextWindow ?? null,
      inputPriceUsdPer1M: row.inputPriceUsdPer1M != null
        ? new Prisma.Decimal(row.inputPriceUsdPer1M)
        : null,
      outputPriceUsdPer1M: row.outputPriceUsdPer1M != null
        ? new Prisma.Decimal(row.outputPriceUsdPer1M)
        : null,
      latencyMs: row.latencyMs ?? null,
      category: row.category || "general",
      isActive: row.isActive !== false,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : 0,
    };

    if (dryRun) {
      console.log("[dry-run]", existing ? "update" : "insert", row.modelId);
      existing ? (updated += 1) : (inserted += 1);
      continue;
    }

    if (existing) {
      await prisma.modelCatalog.update({
        where: { id: existing.id },
        data: { ...data, updatedAt: new Date() },
      });
      updated += 1;
    } else {
      await prisma.modelCatalog.create({
        data: { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() },
      });
      inserted += 1;
    }
  }

  // Remove rows whose modelId is not in the source
  const orphaned = await prisma.modelCatalog.findMany({
    where: {
      modelId: { notIn: Array.from(sourceModelIds) },
    },
    select: { id: true, modelId: true },
  });

  for (const row of orphaned) {
    if (dryRun) {
      console.log("[dry-run] delete", row.modelId);
      deleted += 1;
      continue;
    }
    await prisma.modelCatalog.delete({ where: { id: row.id } });
    deleted += 1;
  }

  return { inserted, updated, deleted, total: rows.length };
}

/**
 * Seed PlanCatalog and PlanEntitlement using Prisma Client.
 * - Upserts plans by slug
 * - Replaces entitlements so the catalog stays in sync with seed source
 */
export async function prismaSeedPlanCatalog(dryRun = false) {
  const rows = buildPlanCatalogSeedRows();
  const sourceSlugs = new Set(rows.map((r) => r.slug));

  let inserted = 0;
  let updated = 0;
  let entitlementsInserted = 0;
  let entitlementsDeleted = 0;

  for (const row of rows) {
    if (!row.slug || !row.name || !row.billingType) {
      continue;
    }

    const existing = await prisma.planCatalog.findUnique({
      where: { slug: row.slug },
    });

    const planData = {
      slug: row.slug,
      name: row.name,
      billingType: row.billingType,
      includedCreditUsd: new Prisma.Decimal(row.includedCreditUsd ?? 0),
      windowHours: row.windowHours ?? null,
      discountPercent: new Prisma.Decimal(row.discountPercent ?? 0),
      priceCurrency: row.priceCurrency || "IDR",
      priceMinor: Number.isFinite(Number(row.priceMinor)) ? Number(row.priceMinor) : 0,
      periodLabel: row.periodLabel || "",
      description: row.description || "",
      ctaLabel: row.ctaLabel || "",
      highlighted: row.highlighted === true,
      isActive: row.isActive !== false,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : 0,
    };

    if (dryRun) {
      console.log("[dry-run] plan", existing ? "update" : "insert", row.slug);
      existing ? (updated += 1) : (inserted += 1);

      const entitlements = row.entitlements || [];
      console.log(
        "[dry-run] plan entitlements",
        row.slug,
        `delete all, insert ${entitlements.length}`
      );
      entitlementsDeleted += entitlements.length;
      entitlementsInserted += entitlements.length;
      continue;
    }

    let planId;
    if (existing) {
      await prisma.planCatalog.update({
        where: { id: existing.id },
        data: { ...planData, updatedAt: new Date() },
      });
      planId = existing.id;
      updated += 1;
    } else {
      planId = crypto.randomUUID();
      await prisma.planCatalog.create({
        data: { id: planId, ...planData, createdAt: new Date(), updatedAt: new Date() },
      });
      inserted += 1;
    }

    // Sync entitlements: delete existing, insert fresh
    const deleteResult = await prisma.planEntitlement.deleteMany({
      where: { planId },
    });
    entitlementsDeleted += deleteResult.count;

    const entitlements = row.entitlements || [];
    for (const e of entitlements) {
      await prisma.planEntitlement.create({
        data: {
          id: crypto.randomUUID(),
          planId,
          label: e.label,
          value: e.value,
          sortOrder: Number.isFinite(Number(e.sortOrder)) ? Number(e.sortOrder) : 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      entitlementsInserted += 1;
    }
  }

  // Remove plans whose slug is no longer in the seed source
  const orphaned = await prisma.planCatalog.findMany({
    where: { slug: { notIn: Array.from(sourceSlugs) } },
    select: { id: true, slug: true },
  });

  let plansDeleted = 0;
  for (const row of orphaned) {
    if (dryRun) {
      console.log("[dry-run] plan delete", row.slug);
      plansDeleted += 1;
      continue;
    }
    await prisma.planEntitlement.deleteMany({ where: { planId: row.id } });
    await prisma.planCatalog.delete({ where: { id: row.id } });
    plansDeleted += 1;
  }

  return {
    inserted,
    updated,
    deleted: plansDeleted,
    entitlementsInserted,
    entitlementsDeleted,
    total: rows.length,
  };
}

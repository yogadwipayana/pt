import { createRequire } from 'module'
import { prisma } from "../db.js";
import { buildModelCatalogSeedRows } from "./modelCatalogSeed.js";

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

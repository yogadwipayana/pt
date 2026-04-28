import { prismaSeedModelCatalog } from "../src/lib/prismaSeed.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run") || process.env.SEED_DRY_RUN === "1";

  if (dryRun) {
    console.log("[seed-model-catalog-prisma] Dry run mode enabled.");
  }

  const result = await prismaSeedModelCatalog(dryRun);
  console.log(JSON.stringify(result, null, 2));

  if (!dryRun) {
    const { prisma } = await import("../src/db.js");
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed-model-catalog-prisma] failed:", error?.message || error);
  process.exitCode = 1;
});

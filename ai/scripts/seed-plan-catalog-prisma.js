import { prismaSeedPlanCatalog } from "../src/lib/prismaSeed.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run") || process.env.SEED_DRY_RUN === "1";

  if (dryRun) {
    console.log("[seed-plan-catalog-prisma] Dry run mode enabled.");
  }

  const result = await prismaSeedPlanCatalog(dryRun);
  console.log(JSON.stringify(result, null, 2));

  if (!dryRun) {
    const { prisma } = await import("../src/db.js");
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed-plan-catalog-prisma] failed:", error?.message || error);
  process.exitCode = 1;
});

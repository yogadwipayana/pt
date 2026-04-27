import { dbSeedAdminModelCatalog } from "../src/lib/adminPostgres.js";
import { buildModelCatalogSeedRows } from "../src/lib/modelCatalogSeed.js";

async function main() {
  const rows = buildModelCatalogSeedRows();
  const dryRun = process.argv.includes("--dry-run") || process.env.SEED_DRY_RUN === "1";

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      total: rows.length,
      sample: rows.slice(0, 5),
    }, null, 2));
    return;
  }

  const result = await dbSeedAdminModelCatalog(rows);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[seed-model-catalog] failed:", error?.message || error);
  process.exitCode = 1;
});

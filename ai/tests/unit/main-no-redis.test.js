import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");
const mainRoot = join(repoRoot, "main");
const forbiddenPatterns = [/adminRedis/, /@upstash\/redis/, /UPSTASH_REDIS/, /ADMIN_CACHE/, /env\.REDIS/];

function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) collectFiles(path, files);
    if (stat.isFile()) files.push(path);
  }
  return files;
}

describe("main Redis boundary", () => {
  it("does not use backend Redis helpers or env vars", () => {
    const offenders = collectFiles(mainRoot).filter((file) => {
      const content = readFileSync(file, "utf8");
      return forbiddenPatterns.some((pattern) => pattern.test(content));
    });

    expect(offenders).toEqual([]);
  });
});

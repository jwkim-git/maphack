import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "apps", "extension", "dist");

const requiredFiles = [
  path.join(distRoot, "manifest.json"),
  path.join(distRoot, "src", "entrypoints", "background", "index.js"),
  path.join(distRoot, "src", "entrypoints", "content", "main.js"),
  path.join(distRoot, "src", "entrypoints", "content", "isolated.js")
];

async function main() {
  const missing = [];

  for (const filePath of requiredFiles) {
    try {
      await access(filePath);
    } catch {
      missing.push(filePath);
    }
  }

  if (missing.length > 0) {
    console.error("verify:extension failed. missing files:");
    for (const item of missing) {
      console.error(`- ${path.relative(repoRoot, item)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("verify:extension passed");
}

main().catch((error) => {
  console.error("verify:extension failed");
  console.error(error);
  process.exitCode = 1;
});

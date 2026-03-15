import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const extensionRoot = path.join(repoRoot, "apps", "extension");
const entryRoot = path.join(extensionRoot, "src", "entrypoints");
const distRoot = path.join(extensionRoot, "dist");
const distEntryRoot = path.join(distRoot, "src", "entrypoints");

const buildTargets = [
  {
    entry: path.join(entryRoot, "background", "index.ts"),
    outfile: path.join(distEntryRoot, "background", "index.js")
  },
  {
    entry: path.join(entryRoot, "content", "main.ts"),
    outfile: path.join(distEntryRoot, "content", "main.js")
  },
  {
    entry: path.join(entryRoot, "content", "isolated.ts"),
    outfile: path.join(distEntryRoot, "content", "isolated.js")
  }
];

async function copyPublicAssets() {
  const publicRoot = path.join(extensionRoot, "public");
  const distPublicRoot = path.join(distRoot, "public");

  try {
    await cp(publicRoot, distPublicRoot, { recursive: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";

    if (code !== "ENOENT") {
      throw error;
    }
  }
}

async function buildEntrypoints() {
  await Promise.all(
    buildTargets.map((target) =>
      build({
        entryPoints: [target.entry],
        outfile: target.outfile,
        bundle: true,
        format: "iife",
        target: "es2020",
        platform: "browser",
        legalComments: "none",
        logLevel: "silent"
      })
    )
  );
}

async function main() {
  await rm(distRoot, { recursive: true, force: true });

  await mkdir(path.join(distEntryRoot, "background"), { recursive: true });
  await mkdir(path.join(distEntryRoot, "content"), { recursive: true });

  await buildEntrypoints();
  await cp(path.join(extensionRoot, "manifest.json"), path.join(distRoot, "manifest.json"));
  await copyPublicAssets();

  console.log("build:extension completed");
}

main().catch((error) => {
  console.error("build:extension failed");
  console.error(error);
  process.exitCode = 1;
});

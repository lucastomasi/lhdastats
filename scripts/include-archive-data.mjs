#!/usr/bin/env node
/**
 * Copy data/*.json into every Vercel serverless bundle so runtime
 * readFileSync can find ~40k donations without inlining them in JS.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "data");
const functionsDir = join(root, ".vercel/output/functions");

if (!existsSync(join(src, "donations.json"))) {
  console.error("[archive-data] missing", join(src, "donations.json"));
  process.exit(1);
}
if (!existsSync(functionsDir)) {
  console.log("[archive-data] no Vercel function output — skip");
  process.exit(0);
}

const funcs = readdirSync(functionsDir).filter((name) => {
  const path = join(functionsDir, name);
  return name.endsWith(".func") && statSync(path).isDirectory();
});

if (funcs.length === 0) {
  console.log("[archive-data] no *.func directories — skip");
  process.exit(0);
}

for (const name of funcs) {
  const dest = join(functionsDir, name, "data");
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  const json = join(dest, "donations.json");
  if (!existsSync(json)) {
    console.error("[archive-data] copy failed for", dest);
    process.exit(1);
  }
  console.log("[archive-data] copied data/ into", join(name, "data"));
}
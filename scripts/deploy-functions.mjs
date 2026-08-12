/* Deploy Supabase Edge Functions through the Management API.
   The deploy endpoint accepts ONE bundled file per function, so the
   provider-agnostic core (_shared/payment.ts) is inlined into the entry
   at deploy time — the repo keeps the clean split as the single source
   of truth.

   Usage: node scripts/deploy-functions.mjs <PAT>
   Deploys: pay-checkout (verify_jwt) and pay-webhook (no JWT). */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REF = "ndrusywvceojsoirhkhl";
const PAT = process.argv[2];
if (!PAT) {
  console.error("Usage: node scripts/deploy-functions.mjs <PAT>");
  process.exit(1);
}

const SHARED = readFileSync(join(root, "supabase/functions/_shared/payment.ts"), "utf8");

const FUNCTIONS = [
  { slug: "pay-checkout", dir: "pay-checkout", verifyJwt: true },
  { slug: "pay-webhook", dir: "pay-webhook", verifyJwt: false },
  { slug: "pay-cancel", dir: "pay-cancel", verifyJwt: true }
];

function inline(indexSrc) {
  /* swap the shared-module import for its contents */
  const marker = /import\s*\{[^}]*\}\s*from\s*"\.\.\/_shared\/payment\.ts";\s*/;
  const has = marker.test(indexSrc);
  if (!has) throw new Error("no _shared import found in " + indexSrc.slice(0, 120));
  const imports = indexSrc.match(marker)[0];
  const named = imports.match(/\{([^}]*)\}/)[1].split(",").map(s => s.trim()).filter(Boolean);
  return indexSrc.replace(marker, SHARED + "\n") + "\n/* (inlined exports: " + named.join(", ") + ") */\n";
}

async function deploy(fn) {
  const src = readFileSync(join(root, "supabase/functions", fn.dir, "index.ts"), "utf8");
  const bundled = inline(src);
  const fd = new FormData();
  fd.append("metadata", JSON.stringify({ entrypoint_path: "index.ts", name: fn.slug, verify_jwt: fn.verifyJwt }));
  fd.append("file", new Blob([bundled], { type: "text/typescript" }), "index.ts");
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=${fn.slug}`, {
    method: "POST",
    headers: { Authorization: "Bearer " + PAT },
    body: fd
  });
  const text = await res.text();
  console.log(`${fn.slug}: ${res.status} ${text.slice(0, 140)}`);
  return res.ok;
}

const results = await Promise.all(FUNCTIONS.map(deploy));
process.exit(results.every(Boolean) ? 0 : 1);

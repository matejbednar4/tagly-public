/**
 * Generates tagly-backend/src/utils/INDEX.md and tagly-backend/src/constants/INDEX.md —
 * a queryable manifest of every util/constant (exports + one-line purpose),
 * so new code can check "does this already exist?" before adding a duplicate.
 *
 * Run:  yarn gen:index   (from tagly-backend/)
 * Re-run after adding/removing/renaming any util or constant.
 */
import fs from "fs";
import path from "path";

const SRC = path.resolve(import.meta.dirname, "..", "src");

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

function describe(src) {
  const block = src.match(/\/\*\*([\s\S]*?)\*\//);
  if (block) {
    const line = block[1]
      .split("\n")
      .map((l) => l.replace(/^\s*\*?\s?/, "").trim())
      .find((l) => l.length > 0 && !l.startsWith("@"));
    if (line) return line;
  }
  const c = src.match(/^[ \t]*\/\/[ \t]?(.+)$/m);
  if (c && !/eslint|prettier|@ts-/.test(c[1])) return c[1].trim();
  return "—";
}

function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(
    /export\s+(?:default\s+)?(?:const|let|var|async function|function|type|interface|enum|class)\s+([A-Za-z0-9_]+)/g,
  ))
    names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g))
    for (const part of m[1].split(",")) {
      const seg = part.trim();
      if (!seg) continue;
      const bits = seg.split(/\s+as\s+/);
      const name = bits[bits.length - 1].replace(/^type\s+/, "").trim();
      if (name && name !== "default") names.add(name);
    }
  return [...names];
}

function clip(s, n) {
  s = s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function gen(rootRel, title, note) {
  const root = path.join(SRC, rootRel);
  const files = walk(root).sort();
  const groups = new Map();
  for (const f of files) {
    const rel = path.relative(root, f);
    const top = rel.includes(path.sep) ? rel.split(path.sep)[0] + "/" : "(root)";
    const row = {
      exports: exportsOf(fs.readFileSync(f, "utf8")).join(", ") || "—",
      file: rel.split(path.sep).join("/"),
      purpose: clip(describe(fs.readFileSync(f, "utf8")), 90),
    };
    (groups.get(top) ?? groups.set(top, []).get(top)).push(row);
  }
  let md = `# ${title} — index\n\n> ${note}\n> **Auto-generated** by \`yarn gen:index\` (tagly-backend/scripts/genIndex.mjs). Do not edit by hand; re-run after changes.\n\n`;
  for (const [g, rows] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    md += `## ${g}\n\n| Exports | File | Purpose |\n| --- | --- | --- |\n`;
    for (const r of rows.sort((a, b) => a.file.localeCompare(b.file)))
      md += `| \`${clip(r.exports, 70)}\` | ${r.file} | ${r.purpose} |\n`;
    md += "\n";
  }
  fs.writeFileSync(path.join(root, "INDEX.md"), md);
  return files.length;
}

const u = gen(
  "utils",
  "backend utils",
  "Every util, grouped by domain (the lifecycle buckets were collapsed on 2026-09-01 — one version, one tree). Check here before adding a util; put new ones in the matching domain folder.",
);
const c = gen(
  "constants",
  "backend constants",
  "Every constant/tunable, grouped by domain. Check here before adding a constant; put new ones in the matching domain folder.",
);
console.log(`Wrote utils/INDEX.md (${u} files) + constants/INDEX.md (${c} files)`);

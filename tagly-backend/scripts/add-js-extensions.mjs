// scripts/add-js-extensions.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src");
const exts = [".ts", ".tsx"]; // source extensions you compile from
const terminalExts = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".node"];

function isRelative(p) {
  return p.startsWith("./") || p.startsWith("../");
}

function hasTerminalExt(p) {
  return terminalExts.some((e) => p.endsWith(e));
}

function findSourceTarget(spec, fromFileDir) {
  // spec is relative & extensionless -> try file.ts, file.tsx, and folder/index.ts/tsx
  const abs = path.resolve(fromFileDir, spec);
  for (const e of exts) {
    if (fs.existsSync(abs + e)) return spec + ".js";
  }
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    for (const e of exts) {
      if (fs.existsSync(path.join(abs, "index" + e))) {
        return spec.endsWith("/") ? spec + "index.js" : spec + "/index.js";
      }
    }
  }
  return null; // leave it alone
}

function rewrite(file) {
  const dir = path.dirname(file);
  let src = fs.readFileSync(file, "utf8");
  let changed = false;

  // handle both `from "x"` and `from 'x'`
  src = src.replace(
    /(import[\s\S]*?from\s*['"])([^'"]+)(['"])/g,
    (_, a, spec, z) => {
      if (!isRelative(spec) || hasTerminalExt(spec)) return a + spec + z;
      const replacement = findSourceTarget(spec, dir);
      if (!replacement) return a + spec + z;
      changed = true;
      return a + replacement + z;
    }
  );

  // bare side-effect imports: `import "./foo"`
  src = src.replace(
    /(import\s*['"])([^'"]+)(['"])/g,
    (_, a, spec, z) => {
      if (!isRelative(spec) || hasTerminalExt(spec)) return a + spec + z;
      const replacement = findSourceTarget(spec, dir);
      if (!replacement) return a + spec + z;
      changed = true;
      return a + replacement + z;
    }
  );

  if (changed) fs.writeFileSync(file, src);
}

function walk(d) {
  for (const name of fs.readdirSync(d)) {
    const p = path.join(d, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) rewrite(p);
  }
}

walk(ROOT);
console.log("Added .js to relative imports where needed");
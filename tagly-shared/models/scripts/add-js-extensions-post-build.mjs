import fg from "fast-glob";
import fs from "node:fs/promises";

const files = await fg("dist/**/*.{js,mjs}", { dot: true });

const RE = /(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g;

for (const file of files) {
  const src = await fs.readFile(file, "utf8");
  const out = src.replace(RE, (_m, a, p, z) =>
    /\.(mjs|cjs|js|json)$/.test(p) ? a + p + z : a + p + ".js" + z
  );
  if (out !== src) await fs.writeFile(file, out, "utf8");
}
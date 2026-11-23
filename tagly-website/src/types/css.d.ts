// Ambient declaration so TypeScript accepts global CSS side-effect imports
// (e.g. `import "../globals.css"`) under moduleResolution: "bundler".
// This is editor-only typing; Next.js handles the actual CSS bundling.
declare module "*.css";

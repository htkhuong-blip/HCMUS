import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  out = resolve(root, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(resolve(root, "public"), out, { recursive: true });
mkdirSync(resolve(out, "vendor"), { recursive: true });
cpSync(resolve(root, "node_modules/leaflet/dist"), resolve(out, "vendor"), {
  recursive: true,
});
cpSync(resolve(root, "shared/report.js"), resolve(out, "demo/report.js"));
cpSync(resolve(root, "docs/templates"), resolve(out, "templates"), {
  recursive: true,
});
mkdirSync(resolve(out, "guides"), { recursive: true });
for (const ext of ["md", "docx", "pdf"])
  cpSync(
    resolve(root, `docs/thuyet-minh-thuc-hien.${ext}`),
    resolve(out, `guides/thuyet-minh-thuc-hien.${ext}`),
  );
await build({
  stdin: { contents: "export {default} from 'qrcode';", resolveDir: root },
  bundle: true,
  platform: "browser",
  format: "esm",
  minify: true,
  outfile: resolve(out, "vendor/qr-module.js"),
});
let html = readFileSync(resolve(out, "index.html"), "utf8")
  .replaceAll('href="/', 'href="./')
  .replaceAll('src="/', 'src="./');
html = html.replace(
  '<main id="app">',
  '<aside class="demo-banner"><b>DEMO MIỄN PHÍ</b> · Dữ liệu minh họa, lưu riêng trong trình duyệt của bạn. Không phải hệ thống dùng chung hoặc hồ sơ đã kiểm chứng.</aside><main id="app">',
);
html = html.replace(
  '<script src="./vendor/leaflet.js">',
  '<script src="./demo-config.js"></script><script src="./vendor/leaflet.js">',
);
writeFileSync(resolve(out, "index.html"), html);
writeFileSync(resolve(out, "404.html"), html);
writeFileSync(resolve(out, "demo-config.js"), "window.HERITAGE_DEMO = true;\n");
writeFileSync(resolve(out, ".nojekyll"), "");
mkdirSync(resolve(out, "demo/images"), { recursive: true });
for (let n = 1; n <= 3; n++)
  writeFileSync(
    resolve(out, `demo/images/site-${n}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420"><rect width="720" height="420" fill="#e9eee6"/><circle cx="560" cy="95" r="45" fill="#d5b37a"/><path d="M0 330Q180 220 360 330T720 320V420H0Z" fill="#b3c9ba"/><path d="M160 285L360 135L560 285Z" fill="#245b4b"/><path d="M215 280H505V355H215Z" fill="#f7f5ee"/><rect x="330" y="285" width="60" height="70" fill="#245b4b"/><text x="360" y="395" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#245b4b">HERITAGEKIT · DEMO ${n}</text></svg>`,
  );
writeFileSync(
  resolve(out, "demo-manifest.json"),
  JSON.stringify({
    mode: "browser-demo",
    version: 1,
    built_at: new Date().toISOString(),
  }),
);
console.log(
  "Built GitHub Pages demo in dist/ (no server or credentials included).",
);

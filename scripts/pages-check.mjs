import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const server = spawn(process.execPath, ["scripts/preview-pages.mjs"], {
  env: { ...process.env, PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  const base = await new Promise((resolve, reject) => {
    let out = "";
    server.stdout.on("data", (b) => {
      out += b;
      const m = /port (\d+)/.exec(out);
      if (m) resolve("http://127.0.0.1:" + m[1] + "/HCMUS/");
    });
    server.once("exit", () => reject(Error("Preview failed")));
    setTimeout(() => reject(Error("Startup timeout")), 5000).unref();
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
  });
  const page = await context.newPage();
  const errors = [],
    apiRequests = [],
    badResponses = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.includes("/api/")) apiRequests.push(r.url());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(base))
      badResponses.push([r.status(), r.url()]);
  });
  const fill = (name, value) => page.locator(`[name="${name}"]`).fill(value);
  const role = async (value) => {
    await page.locator("#login").click();
    await page.locator(`[data-role="${value}"]`).click();
    await page
      .locator(value === "guest" ? "#results" : ".tool-links")
      .waitFor();
  };
  const module = async (value) => {
    await page.locator(`[data-module="${value}"]`).first().click();
    await page.locator(".workspace-heading").waitFor();
  };
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator("#results .card").first().waitFor();
  assert.equal(await page.locator("#results .card").count(), 3);
  assert.ok(await page.locator(".demo-banner").isVisible());
  await page.locator('[data-view="1"]').click();
  await page.locator("#qr-share").click();
  await page.waitForFunction(
    () => document.querySelector("#qr-panel img")?.naturalWidth > 0,
  );
  assert.ok(
    await page.locator(".media img").evaluate((img) => img.naturalWidth > 0),
  );
  await page.locator("#explore").click();
  await page.locator("#public-products").click();
  await page
    .getByRole("heading", { name: "Sản phẩm số di sản", exact: true })
    .waitFor();
  assert.equal(await page.locator("article.card").count(), 5);
  await role("admin");
  await page.locator("#toolkit").click();
  await module("tasks");
  await page.locator("#add-entry").click();
  await fill("title", "Nhiệm vụ mới trên Pages");
  await fill("unit", "Nhóm thử");
  await fill("progress", "50");
  await page.locator("#save-entry").click();
  await page
    .getByRole("heading", { name: "Nhiệm vụ mới trên Pages", exact: true })
    .waitFor();
  await module("worklogs");
  await page.locator("#add-entry").click();
  await fill("member", "TV01");
  await fill("unit", "Nhóm thử");
  await fill("hours", "8");
  await fill("description", "Thử bộ công cụ trong trình duyệt");
  await page.locator("#save-entry").click();
  await page.getByRole("heading", { name: "TV01", exact: true }).waitFor();
  await role("editor");
  await page.locator("#new").click();
  await fill("title", "Hồ sơ mới trên Pages");
  await fill("location", "Địa điểm minh họa");
  await fill("author", "Nhóm demo");
  await fill("content", "Nội dung minh họa");
  await fill("source", "Nguồn mô phỏng");
  await fill("rights", "Chỉ dùng demo");
  await page.locator("#add-media").click();
  await page.locator("[data-upload]").setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGd0AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .locator("[data-upload-status]")
    .filter({ hasText: "Đã tải" })
    .waitFor();
  await page.locator('[data-field="source"]').fill("Nguồn thử");
  await page.locator('[data-field="rights"]').fill("Quyền demo");
  await page.locator("#save-heritage").click();
  const card = page
    .getByRole("heading", { name: "Hồ sơ mới trên Pages", exact: true })
    .locator("..");
  const id = await card.locator("[data-view]").getAttribute("data-view");
  await card.locator("[data-view]").click();
  await page.locator("#submit").click();
  await page.getByText("Chờ kiểm chứng", { exact: true }).waitFor();
  await role("reviewer");
  await page.locator(`[data-view="${id}"]`).click();
  await fill("note", "Đã kiểm tra trong luồng demo");
  await page.locator("#review button").click();
  await page.getByText("Đã công bố", { exact: true }).waitFor();
  assert.ok(
    await page.locator(".media img").evaluate((img) => img.naturalWidth > 0),
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "Hồ sơ mới trên Pages", exact: true })
    .waitFor();
  await page.locator("#explore").click();
  await page.locator("#results").waitFor();
  assert.equal(await page.locator("#results .card").count(), 4);
  await role("admin");
  await page.locator("#toolkit").click();
  await module("settings");
  const event = page.waitForEvent("download");
  await page.locator("#export-demo").click();
  const download = await event;
  assert.equal(download.suggestedFilename(), "heritagekit-demo.json");
  const exportData = await page.evaluate(async () => {
    const { demoApi } = await import("./demo/adapter.js");
    return demoApi("/backup");
  });
  assert.equal(exportData.heritage.length, 4);
  assert.equal(exportData.files.length, 1);
  const rejection = await page.evaluate(async () => {
    const { demoApi } = await import("./demo/adapter.js");
    const state = await demoApi("/backup");
    state.heritage[0].media = [{ type: "image", url: "javascript:alert(1)" }];
    try {
      await demoApi("/demo/import", "POST", state);
      return false;
    } catch {
      return (await demoApi("/backup")).heritage.length === 4;
    }
  });
  assert.ok(rejection);
  page.once("dialog", (d) => d.accept());
  await page.locator("#reset-demo").click();
  await page.getByRole("heading", { name: "Tổng quan triển khai" }).waitFor();
  await module("settings");
  page.once("dialog", (d) => d.accept());
  await page.locator("#import-demo").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exportData)),
  });
  await page
    .locator("#demo-import-status")
    .filter({ hasText: "Đã nhập" })
    .waitFor();
  await page.locator("#explore").click();
  await page.locator("#results .card").first().waitFor();
  assert.equal(await page.locator("#results .card").count(), 4);
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await freshPage.goto(base);
  await freshPage.locator("#results").waitFor();
  assert.equal(await freshPage.locator("#results .card").count(), 3);
  await fresh.close();
  await role("admin");
  await page.locator("#toolkit").click();
  await module("report");
  const csvEvent = page.waitForEvent("download");
  await page.locator("#csv-report").click();
  assert.match((await csvEvent).suggestedFilename(), /\.csv$/);
  await module("guide");
  const word = await page.request.get(
    base + "guides/thuyet-minh-thuc-hien.docx",
  );
  assert.equal(word.status(), 200);
  const survey = await page.request.get(base + "templates/phieu-khao-sat.csv");
  assert.equal(survey.status(), 200);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of [
    "overview",
    "tasks",
    "worklogs",
    "products",
    "evidence",
    "trials",
    "budget",
    "guide",
    "settings",
  ]) {
    await module(name);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      name + " overflow",
    );
  }
  await page.locator("#explore").click();
  mkdirSync("playwright-artifacts", { recursive: true });
  await page.screenshot({
    path: "playwright-artifacts/pages-demo-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.screenshot({
    path: "playwright-artifacts/pages-demo-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(apiRequests, []);
  assert.deepEqual(badResponses, []);
  console.log(
    "Pages PASS: /HCMUS/ subpath, sample catalog, browser-only roles/CRUD/upload/review, IndexedDB persistence, fresh-device isolation, safe import/export/reset, QR, CSV, documents, desktop/mobile; no API requests or broken local assets.",
  );
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill();
    await once(server, "exit");
  }
}

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "heritage-ui-"));
const server = spawn(process.execPath, ["server.js"], {
  env: {
    ...process.env,
    DB_PATH: join(dir, "test.sqlite"),
    PORT: "0",
    ADMIN_PASSWORD: "ui-test-password-long",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
const errors = [];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGd0AAAAASUVORK5CYII=",
  "base64",
);
try {
  const base = await new Promise((resolve, reject) => {
    let out = "";
    server.stdout.on("data", (b) => {
      out += b;
      const m = /cổng (\d+)/.exec(out);
      if (m) resolve("http://127.0.0.1:" + m[1]);
    });
    server.once("exit", () => reject(Error("Startup failed")));
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
  page.on("pageerror", (e) => errors.push(e.message));
  const go = async (module) => {
    await page.locator(`[data-module="${module}"]`).first().click();
    await page.locator(".workspace-heading").waitFor();
  };
  const fill = async (name, value) =>
    page.locator(`[name="${name}"]`).fill(value);
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Gìn giữ ký ức. Lan tỏa giá trị." })
    .waitFor();
  await page.locator("#login").click();
  await fill("email", "admin@heritagekit.local");
  await fill("password", "ui-test-password-long");
  await page.locator("#login-form button").click();
  await page.locator("#new").waitFor();
  const u = await page.request.post(base + "/api/users", {
    data: {
      name: "Chuyên gia UI",
      email: "reviewer@example.test",
      password: "review-test-password",
      role: "reviewer",
    },
  });
  assert.equal(u.status(), 201);
  await page.locator("#toolkit").click();
  await page.getByRole("heading", { name: "Tổng quan triển khai" }).waitFor();
  await go("tasks");
  await page.locator("#add-entry").click();
  await fill("title", "Khảo sát di sản thử");
  await fill("unit", "Đoàn khoa thử");
  await fill("progress", "50");
  await page.locator("#save-entry").click();
  await page
    .getByRole("heading", { name: "Khảo sát di sản thử", exact: true })
    .waitFor();
  await go("worklogs");
  await page.locator("#add-entry").click();
  await fill("member", "Thành viên thử");
  await fill("unit", "Đoàn khoa thử");
  await fill("hours", "8");
  await fill("description", "Khảo sát nguồn và đối chiếu tư liệu");
  await page
    .locator('[name="task_id"]')
    .selectOption({ label: "Khảo sát di sản thử" });
  await page.locator("#save-entry").click();
  await page
    .getByRole("heading", { name: "Thành viên thử", exact: true })
    .waitFor();
  await go("budget");
  await page.locator("#add-entry").click();
  await fill("title", "In ấn thử nghiệm");
  await fill("unit", "Bộ");
  await fill("quantity", "2");
  await fill("unit_cost", "50000");
  await fill("funding", "Nguồn lực thử");
  await page.locator("#save-entry").click();
  await page
    .getByRole("heading", { name: "In ấn thử nghiệm", exact: true })
    .waitFor();
  await page.locator('[data-module="dossiers"]').click();
  await page.locator("#new").click();
  await fill("title", "Di sản kiểm thử giao diện");
  await fill("location", "Địa điểm thử nghiệm");
  await fill("author", "Nhóm kiểm thử");
  await fill("summary", "Hồ sơ thử, không phải dữ liệu thực");
  await fill("content", "Nội dung thử để kiểm tra luồng duyệt");
  await fill("source", "Nguồn thử nghiệm");
  await fill("rights", "Chỉ dùng kiểm thử");
  await fill("lat", "10.78");
  await fill("lng", "106.69");
  await page.locator("#add-media").click();
  await page
    .locator("[data-upload]")
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
  await page
    .locator("[data-upload-status]")
    .filter({ hasText: "Đã tải" })
    .waitFor();
  await page.locator('[data-field="source"]').fill("Nguồn ảnh thử");
  await page.locator('[data-field="rights"]').fill("Dùng kiểm thử");
  await page.locator("#add-timeline").click();
  await page.locator('[data-field="year"]').fill("2026");
  await page.locator('[data-field="text"]').fill("Số hóa thử nghiệm");
  await page.locator("#save-heritage").click();
  await page.locator('[data-view="1"]').click();
  await page.locator("#submit").click();
  await page.getByText("Chờ kiểm chứng", { exact: true }).waitFor();
  const reviewerContext = await browser.newContext();
  const rp = await reviewerContext.newPage();
  rp.on("pageerror", (e) => errors.push(e.message));
  await rp.goto(base);
  await rp.locator("#login").click();
  await rp.locator('[name="email"]').fill("reviewer@example.test");
  await rp.locator('[name="password"]').fill("review-test-password");
  await rp.locator("#login-form button").click();
  await rp.locator('[data-view="1"]').click();
  await rp
    .locator('[name="note"]')
    .fill("Đã kiểm tra nội dung và quyền trong bài thử");
  await rp.locator("#review button").click();
  await rp.getByText("Đã công bố", { exact: true }).waitFor();
  await page.locator("#manage").click();
  await page.locator('[data-view="1"]').click();
  await page.locator("#qr-share").click();
  await page.locator("#qr-panel img").waitFor({ state: "visible" });
  assert.ok(
    await page
      .locator("#qr-panel img")
      .evaluate((el) => el.complete && el.naturalWidth > 0),
  );
  await page.locator("#toolkit").click();
  await go("products");
  await page.locator("#add-entry").click();
  await fill("title", "Tài liệu giáo dục thử");
  await fill("description", "Sản phẩm dùng thử độc lập");
  await fill("url", "https://example.org/heritage-guide");
  await fill("source", "Nguồn thử");
  await fill("rights", "Quyền dùng thử");
  await page.locator("#save-entry").click();
  await page.locator("[data-submit]").click();
  await page.getByText("Chờ kiểm tra", { exact: true }).waitFor();
  await rp.locator("#toolkit").click();
  await rp.locator('[data-module="products"]').click();
  await rp.locator("[data-review]").click();
  await rp.locator('[name="note"]').fill("Đạt kiểm tra trong bài thử");
  await rp.locator("#review-entry button").click();
  await rp.getByText("Đã công bố", { exact: true }).waitFor();
  await go("evidence");
  await page.locator("#add-entry").click();
  await fill("title", "Văn bản phối hợp thử");
  await fill("issuer", "Đơn vị thử");
  await page.locator('[name="heritage_id"]').selectOption("1");
  await page.locator("#entry-upload").setInputFiles({
    name: "evidence.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nTesting\n%%EOF"),
  });
  await page.locator("#upload-result").filter({ hasText: "Đã tải" }).waitFor();
  await page.locator("#save-entry").click();
  await page.locator("[data-submit]").click();
  await page.getByText("Chờ kiểm tra", { exact: true }).waitFor();
  await go("trials");
  await page.locator("#add-entry").click();
  await fill("title", "Đợt dùng thử giao diện");
  await fill("audience", "Sinh viên thử");
  await page.locator('[name="status"]').selectOption("completed");
  await fill("summary", "Giao diện đáp ứng các thao tác cơ bản");
  await page.locator("#add-participant").click();
  await page.locator('[data-field="name"]').fill("SV01");
  await page.locator('[data-field="comment"]').fill("Dễ tìm hồ sơ");
  await page.locator("#save-entry").click();
  await page
    .getByRole("heading", { name: "Đợt dùng thử giao diện", exact: true })
    .waitFor();
  await go("report");
  await page.getByRole("heading", { name: "Báo cáo & nghiệm thu" }).waitFor();
  const download = page.waitForEvent("download");
  await page.locator("#csv-report").click();
  assert.match((await download).suggestedFilename(), /\.csv$/);
  mkdirSync("playwright-artifacts", { recursive: true });
  await page.screenshot({
    path: "playwright-artifacts/report-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const module of [
    "overview",
    "tasks",
    "worklogs",
    "budget",
    "products",
    "evidence",
    "trials",
    "guide",
    "settings",
  ]) {
    await go(module);
    const dimensions = await page.evaluate(() => ({
      screen: innerWidth,
      width: document.documentElement.scrollWidth,
    }));
    assert.ok(
      dimensions.width <= dimensions.screen + 1,
      `${module}: horizontal overflow ${JSON.stringify(dimensions)}`,
    );
  }
  await go("overview");
  await page.screenshot({
    path: "playwright-artifacts/toolkit-mobile.png",
    fullPage: true,
  });
  await page.locator("#explore").click();
  await page.locator('[data-view="1"]').click();
  await page.locator("#qr-share").click();
  await page.screenshot({
    path: "playwright-artifacts/heritage-mobile.png",
    fullPage: true,
  });
  const anonymous = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await anonymous.goto(base);
  await anonymous.locator("#public-products").click();
  await anonymous
    .getByRole("heading", { name: "Tài liệu giáo dục thử", exact: true })
    .waitFor();
  await anonymous.locator("#explore").click();
  await anonymous.locator("#map-explore").click();
  await anonymous
    .locator('.leaflet-overlay-pane path:not([d="M0 0"])')
    .first()
    .waitFor();
  assert.ok(await anonymous.locator(".leaflet-marker-icon").count());
  const doc = await anonymous.request.get(
    base + "/guides/thuyet-minh-thuc-hien.docx",
  );
  assert.equal(doc.status(), 200);
  assert.match(doc.headers()["content-type"], /wordprocessingml/);
  const pdf = await anonymous.request.get(
    base + "/guides/thuyet-minh-thuc-hien.pdf",
  );
  assert.equal(pdf.status(), 200);
  assert.ok((await pdf.body()).subarray(0, 5).toString() === "%PDF-");
  for (const file of [
    "phoi-hop.md",
    "ban-giao.md",
    "nghiem-thu.md",
    "kiem-tra-ky-thuat.csv",
    "phieu-khao-sat.csv",
    "phan-cong.csv",
  ])
    assert.equal(
      (await anonymous.request.get(base + "/templates/" + file)).status(),
      200,
    );
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log(
    "UI PASS: desktop/mobile, forms, file uploads, independent review, product publication, QR, survey, CSV, public catalog; no uncaught browser errors.",
  );
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill();
    await once(server, "exit");
  }
  rmSync(dir, { recursive: true, force: true });
}

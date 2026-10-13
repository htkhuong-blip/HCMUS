import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { promisify } from "node:util";
const exec = promisify(execFile);
test("expanded toolkit", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "heritage-kit-"));
  let server, cookie, base, reviewer, file, heritage, product;
  const env = {
    ...process.env,
    DB_PATH: join(dir, "db.sqlite"),
    UPLOAD_DIR: join(dir, "uploads"),
    BACKUP_DIR: join(dir, "backups"),
    PORT: "0",
    ADMIN_PASSWORD: "test-password-long",
  };
  async function start() {
    server = spawn(process.execPath, ["server.js"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    base = await new Promise((resolve, reject) => {
      server.stdout.on("data", (b) => {
        output += b;
        const m = /cổng (\d+)/.exec(output);
        if (m) resolve("http://127.0.0.1:" + m[1]);
      });
      server.on("exit", () => reject(Error("Server exited")));
      setTimeout(() => reject(Error("Startup timeout")), 5000).unref();
    });
  }
  async function stop() {
    if (server && server.exitCode === null) {
      server.kill();
      await once(server, "exit");
    }
  }
  async function req(path, method = "GET", data, auth = cookie) {
    const r = await fetch(base + "/api" + path, {
      method,
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(auth ? { Cookie: auth } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return {
      status: r.status,
      data: r.headers.get("content-type")?.includes("application/json")
        ? await r.json()
        : await r.text(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const h = {
    title: "Di sản kiểm thử",
    category: "Di tích lịch sử",
    location: "Địa điểm thử",
    summary: "Không dùng làm hồ sơ nghiệm thu",
    content: "Tư liệu thử",
    source: "Nguồn thử",
    author: "Nhóm thử",
    rights: "Dùng kiểm thử",
    media: [],
    timeline: [],
    lat: 10.78,
    lng: 106.69,
  };
  try {
    await start();
    cookie = (
      await req("/login", "POST", {
        email: "admin@heritagekit.local",
        password: "test-password-long",
      })
    ).cookie;
    await req("/users", "POST", {
      name: "Chuyên gia",
      email: "reviewer@example.test",
      role: "reviewer",
      password: "review-password-long",
    });
    reviewer = (
      await req("/login", "POST", {
        email: "reviewer@example.test",
        password: "review-password-long",
      })
    ).cookie;
    await t.test(
      "uploads: identity, type validation, private access and publication",
      async () => {
        assert.equal(
          (
            await req("/uploads", "POST", {
              name: "bad.html",
              base64: Buffer.from("<html>bad</html>").toString("base64"),
            })
          ).status,
          400,
        );
        assert.equal(
          (await req("/uploads", "POST", { name: "empty.png", base64: "a===" }))
            .status,
          400,
        );
        const pdf = Buffer.from("%PDF-1.4\nTest document\n%%EOF");
        assert.equal(
          (
            await req(
              "/uploads",
              "POST",
              { name: "test.pdf", base64: pdf.toString("base64") },
              "",
            )
          ).status,
          401,
        );
        file = (
          await req("/uploads", "POST", {
            name: "test.pdf",
            base64: pdf.toString("base64"),
          })
        ).data;
        assert.equal((await fetch(base + file.url)).status, 404);
        assert.equal(
          (await fetch(base + file.url, { headers: { Cookie: cookie } }))
            .status,
          200,
        );
        heritage = (
          await req("/heritage", "POST", {
            ...h,
            media: [
              {
                type: "document",
                url: file.url,
                title: "PDF thử",
                source: "Nguồn",
                rights: "Cho phép",
              },
            ],
          })
        ).data;
        assert.equal(
          (await req(`/heritage/${heritage.id}/submit`, "POST", {})).status,
          200,
        );
        assert.equal(
          (
            await req(
              `/heritage/${heritage.id}/review`,
              "POST",
              { status: "published", note: "Đã đối chiếu" },
              reviewer,
            )
          ).status,
          200,
        );
        const download = await fetch(base + file.url);
        assert.equal(download.status, 200);
        assert.match(download.headers.get("content-disposition"), /attachment/);
        const range = await fetch(base + file.url, {
          headers: { Range: "bytes=0-4" },
        });
        assert.equal(range.status, 206);
        assert.equal(await range.text(), "%PDF-");
        assert.equal(
          (await fetch(base + file.url, { headers: { Range: "bytes=99999-" } }))
            .status,
          416,
        );
        const qr = await req(
          "/qr?heritage=" + heritage.id,
          "GET",
          undefined,
          "",
        );
        assert.equal(qr.status, 200);
        assert.match(qr.data, /<svg/);
      },
    );
    await t.test(
      "products: linked publication, duplicate protection and independent reviewer",
      async () => {
        const data = {
          title: "Sản phẩm thử",
          type: "Tài liệu giáo dục",
          heritage_id: heritage.id,
          description: "Tài liệu độc lập",
          url: file.url,
          source: "Nguồn thử",
          rights: "Dùng thử",
        };
        product = (await req("/products", "POST", data)).data;
        assert.ok(product.id);
        assert.equal((await req("/products", "POST", data)).status, 409);
        const duplicate = (
          await req("/uploads", "POST", {
            name: "copy.pdf",
            base64: Buffer.from("%PDF-1.4\nTest document\n%%EOF").toString(
              "base64",
            ),
          })
        ).data;
        assert.equal(
          (await req("/products", "POST", { ...data, url: duplicate.url }))
            .status,
          409,
        );
        const external = {
          ...data,
          title: "External test",
          url: "https://example.org/path?b=2&a=1#chapter",
        };
        assert.equal((await req("/products", "POST", external)).status, 201);
        assert.equal(
          (
            await req("/products", "POST", {
              ...external,
              url: "https://example.org/path?a=1&b=2#other",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await req("/products", "POST", {
              ...data,
              url: "javascript:alert(1)",
            })
          ).status,
          400,
        );
        assert.equal(
          (await req(`/products/${product.id}/submit`, "POST", {})).status,
          200,
        );
        assert.equal(
          (
            await req(`/products/${product.id}/review`, "POST", {
              status: "published",
              note: "Tự duyệt",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await req(
              `/products/${product.id}/review`,
              "POST",
              { status: "published", note: "Đạt kiểm tra" },
              reviewer,
            )
          ).status,
          200,
        );
        assert.equal(
          (await req("/products/public", "GET", undefined, "")).data.length,
          1,
        );
        assert.equal(
          (await req(`/products/${product.id}`, "DELETE", {})).status,
          409,
        );
      },
    );
    await t.test(
      "tasks, worklogs and surveys enforce meaningful completion",
      async () => {
        const task = (
          await req("/tasks", "POST", {
            title: "Khảo sát",
            unit: "Đoàn khoa",
            assignee_id: 1,
            stage: "Khảo sát",
            due: "2027-05-30",
            progress: 50,
            description: "Khảo sát tư liệu",
          })
        ).data;
        assert.equal(task.status, "active");
        assert.equal(
          (
            await req("/tasks", "POST", {
              title: "Sai ngày",
              unit: "Đoàn",
              stage: "Khảo sát",
              due: "2027-02-30",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await req("/tasks", "POST", {
              title: "Sai ngày",
              unit: "Đoàn",
              stage: "Khảo sát",
              due: "abc",
            })
          ).status,
          400,
        );
        const work = {
          member: "Người thử",
          unit: "Đoàn khoa",
          date: "2026-10-13",
          hours: 8,
          task_id: task.id,
          description: "Thu thập tư liệu và ghi nguồn",
        };
        assert.equal(
          (await req("/worklogs", "POST", { ...work, hours: 25 })).status,
          400,
        );
        assert.equal((await req("/worklogs", "POST", work)).status, 201);
        assert.equal(
          (await req("/worklogs", "POST", { ...work, hours: 17 })).status,
          400,
        );
        assert.equal(
          (await req(`/tasks/${task.id}`, "DELETE", {})).status,
          409,
        );
        const trial = {
          title: "Dùng thử",
          date: "2027-03-01",
          audience: "Sinh viên",
          status: "completed",
          summary: "Cần cải thiện tìm kiếm",
          participants: [
            {
              name: "SV01",
              unit: "Khoa CNTT",
              clarity: 4,
              usability: 3,
              usefulness: 5,
              comment: "Có ích",
            },
          ],
        };
        assert.equal(
          (await req("/trials", "POST", { ...trial, participants: [] })).status,
          400,
        );
        assert.equal(
          (await req("/trials", "POST", { ...trial, summary: "" })).status,
          400,
        );
        assert.equal(
          (
            await req("/trials", "POST", {
              ...trial,
              participants: [{ ...trial.participants[0], clarity: 6 }],
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await req("/trials", "POST", {
              ...trial,
              participants: [trial.participants[0], trial.participants[0]],
            })
          ).status,
          400,
        );
        assert.equal((await req("/trials", "POST", trial)).status, 201);
        assert.equal(
          (await req("/worklogs", "POST", work, reviewer)).status,
          403,
        );
      },
    );
    await t.test(
      "budget records separate estimates and spending with validation",
      async () => {
        const b = {
          title: "In ấn thử nghiệm",
          unit: "Bộ",
          quantity: 3,
          unit_cost: 50000,
          funding: "Nguồn lực thử",
          classification: "estimate",
          date: "2026-10-13",
          url: "",
          note: "Dự toán thử",
        };
        assert.equal((await req("/budget", "POST", b)).status, 201);
        assert.equal(
          (
            await req("/budget", "POST", {
              ...b,
              classification: "spent",
              quantity: 2,
            })
          ).status,
          201,
        );
        assert.equal(
          (await req("/budget", "POST", { ...b, unit_cost: -1 })).status,
          400,
        );
        assert.equal(
          (await req("/budget", "POST", { ...b, quantity: 0 })).status,
          400,
        );
        const r = (await req("/report")).data;
        assert.equal(r.summary.estimated_budget, 150000);
        assert.equal(r.summary.spent_budget, 100000);
        assert.equal((await req("/budget", "POST", b, reviewer)).status, 403);
        assert.equal((await req("/budget", "GET", undefined, "")).status, 401);
        assert.equal(
          (await req("/heritage", "POST", { ...h, media: [null] })).status,
          400,
        );
        assert.equal(
          (
            await req("/trials", "POST", {
              title: "Bad",
              date: "2026-10-13",
              audience: "Test",
              participants: [null],
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "evidence review, report targets and public/private boundaries",
      async () => {
        const data = {
          title: "Văn bản phối hợp thử",
          kind_code: "cooperation",
          heritage_id: heritage.id,
          issuer: "Đơn vị thử",
          date: "2026-10-13",
          url: file.url,
          note: "Dữ liệu thử",
        };
        const evidence = (await req("/evidence", "POST", data)).data;
        assert.equal(
          (await req(`/evidence/${evidence.id}/submit`, "POST", {})).status,
          200,
        );
        assert.equal(
          (
            await req(`/evidence/${evidence.id}/review`, "POST", {
              status: "approved",
              note: "Tự kiểm tra",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await req(
              `/evidence/${evidence.id}/review`,
              "POST",
              { status: "approved", note: "Đã đọc" },
              reviewer,
            )
          ).status,
          200,
        );
        const report = (await req("/report")).data;
        assert.equal(report.summary.hours, 8);
        assert.equal(report.summary.workdays, 1);
        assert.equal(report.summary.usefulness, 5);
        assert.equal(report.summary.survey_responses, 1);
        const indicator = report.indicators.find((i) => i.id === "heritage");
        assert.equal(indicator.current, 1);
        assert.equal(indicator.met, false);
        assert.equal(
          report.indicators.find((i) => i.id === "products").met,
          false,
        );
        assert.equal((await req("/report", "GET", undefined, "")).status, 401);
        assert.equal(
          (await req("/evidence", "GET", undefined, "")).status,
          401,
        );
        assert.equal((await req("/audit")).status, 200);
        assert.equal(
          (await req("/audit", "GET", undefined, reviewer)).status,
          403,
        );
        const archive = (await req("/backup")).data;
        assert.equal(archive.version, 2);
        assert.equal(archive.files.length, 2);
        assert.ok(archive.entries.length >= 5);
      },
    );
    await t.test(
      "content changes hide linked products, QR and attached files",
      async () => {
        assert.equal(
          (
            await req(`/heritage/${heritage.id}`, "PUT", {
              ...h,
              media: [
                {
                  type: "document",
                  url: file.url,
                  title: "PDF",
                  source: "Nguồn",
                  rights: "Dùng thử",
                },
              ],
            })
          ).status,
          200,
        );
        assert.equal(
          (await req("/products/public", "GET", undefined, "")).data.length,
          0,
        );
        assert.equal(
          (await req("/qr?heritage=" + heritage.id, "GET", undefined, ""))
            .status,
          404,
        );
        assert.equal((await fetch(base + file.url)).status, 404);
      },
    );
    await t.test(
      "full snapshot restores accounts, entries and file bytes; checks integrity",
      async () => {
        const snapshot = join(dir, "snapshot");
        await exec(
          process.execPath,
          ["scripts/snapshot.mjs", "backup", snapshot],
          { env },
        );
        const denied = await exec(
          process.execPath,
          ["scripts/snapshot.mjs", "restore", snapshot, "--confirm"],
          { env },
        ).then(
          () => null,
          (e) => e,
        );
        assert.ok(denied);
        assert.match(denied.stderr, /dừng máy chủ/);
        await stop();
        const manifest = JSON.parse(
          readFileSync(join(snapshot, "manifest.json"), "utf8"),
        );
        assert.equal(manifest.files.length, 2);
        const original = readFileSync(join(snapshot, "uploads", file.id));
        writeFileSync(join(snapshot, "uploads", file.id), "tampered");
        const bad = await exec(
          process.execPath,
          ["scripts/snapshot.mjs", "restore", snapshot, "--confirm"],
          { env },
        ).then(
          () => null,
          (e) => e,
        );
        assert.ok(bad);
        assert.match(bad.stderr, /checksum/);
        writeFileSync(join(snapshot, "uploads", file.id), original);
        await exec(
          process.execPath,
          ["scripts/snapshot.mjs", "restore", snapshot, "--confirm"],
          { env },
        );
        await start();
        cookie = (
          await req("/login", "POST", {
            email: "admin@heritagekit.local",
            password: "test-password-long",
          })
        ).cookie;
        assert.equal((await req("/products")).data.length, 2);
        assert.equal((await req("/trials")).data.length, 1);
        assert.equal(
          (await fetch(base + file.url, { headers: { Cookie: cookie } }))
            .status,
          200,
        );
      },
    );
    await t.test("password change and JSON/CSRF protections", async () => {
      assert.equal(
        (
          await req("/password", "POST", {
            current: "wrong",
            password: "new-test-password",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await req("/password", "POST", {
            current: "test-password-long",
            password: "new-test-password",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await req("/login", "POST", {
            email: "admin@heritagekit.local",
            password: "test-password-long",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await req("/login", "POST", {
            email: "admin@heritagekit.local",
            password: "new-test-password",
          })
        ).status,
        200,
      );
      const forbidden = await fetch(base + "/api/tasks", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Origin: "https://evil.test",
        },
        body: "{}",
      });
      assert.equal(forbidden.status, 403);
      const invalid = await fetch(base + "/api/tasks", {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: "null",
      });
      assert.equal(invalid.status, 400);
    });
  } finally {
    await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

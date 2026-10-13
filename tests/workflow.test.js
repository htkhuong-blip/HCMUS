import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
test("workflow: permissions, review, publication, feedback, backup, persistence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "heritage-test-"));
  let server;
  async function start() {
    server = spawn(process.execPath, ["server.js"], {
      env: {
        ...process.env,
        DB_PATH: join(dir, "db.sqlite"),
        PORT: "0",
        ADMIN_PASSWORD: "test-password-long",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const port = await new Promise((resolve, reject) => {
      server.stdout.on("data", (b) => {
        output += b;
        const m = /cổng (\d+)/.exec(output);
        if (m) resolve(m[1]);
      });
      server.on("exit", () => reject(Error("Server exited")));
      setTimeout(() => reject(Error("Startup timeout")), 5000).unref();
    });
    return "http://127.0.0.1:" + port;
  }
  try {
    let base = await start();
    let cookie = "";
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
        data: await r.json(),
        cookie: r.headers.get("set-cookie")?.split(";")[0],
      };
    }
    assert.equal((await fetch(base)).status, 200);
    assert.deepEqual((await req("/health")).data, {
      status: "ok",
      version: "0.2.0",
    });
    assert.equal((await req("/heritage")).data.length, 0);
    assert.equal((await req("/heritage", "POST", {})).status, 401);
    const login = await req("/login", "POST", {
      email: "admin@heritagekit.local",
      password: "test-password-long",
    });
    assert.equal(login.status, 200);
    cookie = login.cookie;
    assert.equal(
      (
        await req("/users", "POST", {
          email: "reviewer@example.test",
          name: "Chuyên gia",
          role: "reviewer",
          password: "review-password-long",
        })
      ).status,
      201,
    );
    const b = {
      title: "Hồ sơ kiểm thử",
      category: "Di tích lịch sử",
      location: "Địa điểm thử",
      summary: "Minh họa",
      content: "Nội dung thử nghiệm",
      source: "Nguồn thử",
      author: "Nhóm thử",
      rights: "Cho phép kiểm thử",
      media: [],
      timeline: [{ year: "2026", text: "Thử nghiệm" }],
      lat: 10.7,
      lng: 106.7,
    };
    const created = await req("/heritage", "POST", b);
    assert.equal(created.status, 201);
    const id = created.data.id;
    assert.equal((await req("/heritage", "GET", undefined, "")).data.length, 0);
    assert.equal(
      (await req(`/heritage/${id}`, "GET", undefined, "")).status,
      404,
    );
    assert.equal((await req(`/heritage/${id}/submit`, "POST", {})).status, 200);
    assert.equal(
      (
        await req(`/heritage/${id}/review`, "POST", {
          status: "published",
          note: "Tự duyệt",
        })
      ).status,
      403,
    );
    const reviewer = (
      await req("/login", "POST", {
        email: "reviewer@example.test",
        password: "review-password-long",
      })
    ).cookie;
    assert.equal((await req("/heritage", "POST", b, reviewer)).status, 403);
    assert.equal(
      (
        await req(
          `/heritage/${id}/review`,
          "POST",
          { status: "published", note: "Đã kiểm tra trong bài thử" },
          reviewer,
        )
      ).status,
      200,
    );
    assert.equal((await req("/heritage", "GET", undefined, "")).data.length, 1);
    assert.equal(
      (await req(`/heritage/${id}`, "GET", undefined, "")).status,
      200,
    );
    assert.equal(
      (
        await req(
          `/heritage/${id}/feedback`,
          "POST",
          { rating: 7, comment: "Sai" },
          "",
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          `/heritage/${id}/feedback`,
          "POST",
          { rating: 5, comment: "Dễ dùng" },
          "",
        )
      ).status,
      201,
    );
    const stats = (await req("/stats")).data;
    assert.equal(stats.published, 1);
    assert.equal(stats.feedback.length, 1);
    assert.equal(stats.views, 1);
    assert.equal(
      (await req("/backup", "GET", undefined, reviewer)).status,
      403,
    );
    assert.equal((await req("/backup")).data.heritage.length, 1);
    assert.equal(
      (
        await req(`/heritage/${id}`, "PUT", {
          ...b,
          media: [{ type: "image", url: "javascript:alert(1)" }],
        })
      ).status,
      400,
    );
    assert.equal((await req(`/heritage/${id}`, "PUT", b)).status, 200);
    assert.equal((await req("/heritage", "GET", undefined, "")).data.length, 0);
    server.kill();
    await once(server, "exit");
    base = await start();
    cookie = (
      await req("/login", "POST", {
        email: "admin@heritagekit.local",
        password: "test-password-long",
      })
    ).cookie;
    assert.equal((await req("/heritage")).data.length, 1);
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await once(server, "exit");
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

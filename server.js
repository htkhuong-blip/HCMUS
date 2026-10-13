import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  setupFeatures,
  handleFeatures,
  validMediaUrl,
  entries,
  projectReport,
} from "./features.js";
const root = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || resolve(root, "data/heritage.db");
mkdirSync(dirname(dbPath), { recursive: true });
const lockPath = dbPath + ".pid";
if (existsSync(lockPath)) {
  const pid = Number(readFileSync(lockPath, "utf8"));
  if (Number.isSafeInteger(pid) && pid > 0) {
    let active = true;
    try {
      process.kill(pid, 0);
    } catch (e) {
      if (e.code === "ESRCH") active = false;
      else throw e;
    }
    if (active)
      throw Error("Một tiến trình HeritageKit khác đang dùng cơ sở dữ liệu.");
  }
  unlinkSync(lockPath);
}
writeFileSync(lockPath, String(process.pid), { flag: "wx", mode: 0o600 });
process.on("exit", () => {
  if (
    existsSync(lockPath) &&
    readFileSync(lockPath, "utf8") === String(process.pid)
  )
    unlinkSync(lockPath);
});
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,name TEXT,role TEXT,salt TEXT,hash TEXT);
CREATE TABLE IF NOT EXISTS heritage(id INTEGER PRIMARY KEY,title TEXT,category TEXT,location TEXT,summary TEXT,content TEXT,source TEXT,author TEXT,rights TEXT,media TEXT DEFAULT '[]',timeline TEXT DEFAULT '[]',lat REAL,lng REAL,status TEXT DEFAULT 'draft',reviewer TEXT DEFAULT '',review_note TEXT DEFAULT '',created_by INTEGER,updated_at TEXT,views INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY,heritage_id INTEGER REFERENCES heritage(id),name TEXT,rating INTEGER,comment TEXT,created_at TEXT);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,user_id INTEGER,action TEXT,heritage_id INTEGER,created_at TEXT);`);
const hash = (password, salt) => scryptSync(password, salt, 64).toString("hex");
if (!db.prepare("SELECT id FROM users LIMIT 1").get()) {
  const password =
    process.env.ADMIN_PASSWORD || randomBytes(15).toString("base64url");
  if (password.length < 12)
    throw Error("ADMIN_PASSWORD cần ít nhất 12 ký tự khi khởi tạo.");
  const salt = randomBytes(16).toString("hex");
  db.prepare(
    "INSERT INTO users(email,name,role,salt,hash) VALUES(?,?,?,?,?)",
  ).run(
    process.env.ADMIN_EMAIL || "admin@heritagekit.local",
    "Quản trị viên",
    "admin",
    salt,
    hash(password, salt),
  );
  if (!process.env.ADMIN_PASSWORD)
    console.log(
      `Mật khẩu quản trị khởi tạo (chỉ hiển thị lần đầu): ${password}`,
    );
}
const uploadDir = process.env.UPLOAD_DIR || resolve(dirname(dbPath), "uploads");
setupFeatures(db, uploadDir);
const sessions = new Map();
const attempts = new Map();
function limit(key, max, windowMs) {
  const time = Date.now();
  let a = attempts.get(key);
  if (!a || a.until < time) {
    a = { count: 0, until: time + windowMs };
    attempts.set(key, a);
  }
  if (++a.count > max) fail(429, "Quá nhiều yêu cầu. Vui lòng thử lại sau.");
  if (attempts.size > 10000)
    for (const [k, v] of attempts) if (v.until < time) attempts.delete(k);
}
const now = () => new Date().toISOString();
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
});
const decode = (r) =>
  r
    ? { ...r, media: JSON.parse(r.media), timeline: JSON.parse(r.timeline) }
    : null;
const audit = (u, action, id) =>
  db
    .prepare(
      "INSERT INTO audit(user_id,action,heritage_id,created_at) VALUES(?,?,?,?)",
    )
    .run(u.id, action, id, now());
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
async function body(req, max = 1024 * 1024) {
  let chunks = [],
    size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) fail(413, "Dữ liệu quá lớn");
    chunks.push(c);
  }
  let b = Buffer.concat(chunks).toString("utf8");
  try {
    const data = JSON.parse(b || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data))
      fail(400, "Cần một đối tượng JSON");
    return data;
  } catch {
    fail(400, "JSON không hợp lệ");
  }
}
function fields(b) {
  const keys = [
    "title",
    "category",
    "location",
    "summary",
    "content",
    "source",
    "author",
    "rights",
  ];
  const v = Object.fromEntries(keys.map((k) => [k, String(b[k] || "").trim()]));
  if (!v.title || !v.category || !v.location)
    fail(400, "Cần nhập tên, loại hình và địa điểm");
  if (Object.values(v).some((x) => x.length > 50000))
    fail(400, "Nội dung quá dài");
  for (const key of ["media", "timeline"])
    if (!Array.isArray(b[key] || []) || (b[key] || []).length > 100)
      fail(400, "Danh sách tư liệu không hợp lệ");
  v.media = JSON.stringify(
    (b.media || []).map((m) => {
      if (
        !m ||
        typeof m !== "object" ||
        Array.isArray(m) ||
        !["image", "audio", "video", "document"].includes(m.type) ||
        !validMediaUrl(db, m.url)
      )
        fail(
          400,
          "Tư liệu cần loại hợp lệ và đường dẫn HTTPS hoặc tệp đã tải lên",
        );
      return {
        type: m.type,
        url: m.url,
        title: String(m.title || ""),
        source: String(m.source || ""),
        rights: String(m.rights || ""),
      };
    }),
  );
  v.timeline = JSON.stringify(
    (b.timeline || []).map((t) => {
      if (!t || typeof t !== "object" || Array.isArray(t))
        fail(400, "Dấu mốc không hợp lệ");
      return { year: String(t.year || ""), text: String(t.text || "") };
    }),
  );
  for (const k of ["lat", "lng"]) {
    v[k] = b[k] == null || b[k] === "" ? null : Number(b[k]);
    if (
      v[k] !== null &&
      (!Number.isFinite(v[k]) || Math.abs(v[k]) > (k === "lat" ? 90 : 180))
    )
      fail(400, "Tọa độ không hợp lệ");
  }
  return v;
}
const server = http.createServer(async (req, res) => {
  const send = (status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  try {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
    const publicUrl =
      process.env.PUBLIC_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      `http://${req.headers.host}`;
    const configuredOrigin = new URL(publicUrl).origin;
    const token = /\bhk_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    const session = sessions.get(token);
    if (session && session.expires < Date.now()) sessions.delete(token);
    const user =
      session && session.expires > Date.now()
        ? db.prepare("SELECT * FROM users WHERE id=?").get(session.id)
        : null;
    const auth = (roles = ["admin", "editor", "reviewer"]) => {
      if (!user) fail(401, "Vui lòng đăng nhập");
      if (!roles.includes(user.role)) fail(403, "Bạn không có quyền thực hiện");
      return user;
    };
    if (path.startsWith("/api/") && !["GET", "HEAD"].includes(req.method)) {
      if (req.headers.origin && req.headers.origin !== configuredOrigin)
        fail(403, "Nguồn yêu cầu không hợp lệ");
      if (!req.headers["content-type"]?.startsWith("application/json"))
        fail(415, "Yêu cầu application/json");
    }
    if (path === "/api/health" && req.method === "GET") {
      db.prepare("SELECT 1").get();
      return send(200, { status: "ok", version: "0.2.0" });
    }
    if (path === "/api/login" && req.method === "POST") {
      limit("login:" + req.socket.remoteAddress, 20, 15 * 60000);
      const b = await body(req),
        u = db
          .prepare("SELECT * FROM users WHERE email=?")
          .get(String(b.email || ""));
      if (
        !u ||
        !timingSafeEqual(
          Buffer.from(u.hash, "hex"),
          Buffer.from(hash(String(b.password || ""), u.salt), "hex"),
        )
      )
        fail(401, "Email hoặc mật khẩu không đúng");
      const t = randomBytes(32).toString("hex");
      sessions.set(t, { id: u.id, expires: Date.now() + 8 * 3600000 });
      res.setHeader(
        "Set-Cookie",
        `hk_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${req.socket.encrypted || configuredOrigin.startsWith("https:") ? "; Secure" : ""}`,
      );
      return send(200, publicUser(u));
    }
    if (path === "/api/logout" && req.method === "POST") {
      sessions.delete(token);
      res.setHeader(
        "Set-Cookie",
        "hk_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      );
      return send(200, { ok: true });
    }
    if (path === "/api/me" && req.method === "GET")
      return send(200, user ? publicUser(user) : null);
    if (path === "/api/users" && req.method === "GET") {
      auth();
      return send(
        200,
        db.prepare("SELECT id,email,name,role FROM users ORDER BY name").all(),
      );
    }
    if (path === "/api/password" && req.method === "POST") {
      auth();
      const b = await body(req);
      if (
        !timingSafeEqual(
          Buffer.from(user.hash, "hex"),
          Buffer.from(hash(String(b.current || ""), user.salt), "hex"),
        )
      )
        fail(401, "Mật khẩu hiện tại không đúng");
      if (String(b.password || "").length < 12)
        fail(400, "Mật khẩu mới cần ít nhất 12 ký tự");
      const salt = randomBytes(16).toString("hex");
      db.prepare("UPDATE users SET salt=?,hash=? WHERE id=?").run(
        salt,
        hash(b.password, salt),
        user.id,
      );
      for (const [t, s] of sessions)
        if (s.id === user.id && t !== token) sessions.delete(t);
      audit(user, "password-change", null);
      return send(200, { ok: true });
    }
    if (
      await handleFeatures({
        db,
        uploadDir,
        user,
        auth,
        body,
        fail,
        send,
        path,
        url,
        req,
        res,
        audit,
        publicUrl: configuredOrigin,
      })
    )
      return;
    if (path === "/api/users" && req.method === "POST") {
      auth(["admin"]);
      const b = await body(req);
      if (
        !["admin", "editor", "reviewer"].includes(b.role) ||
        !b.email ||
        !b.name ||
        String(b.password || "").length < 12
      )
        fail(400, "Nhập email, tên, vai trò và mật khẩu ít nhất 12 ký tự");
      const salt = randomBytes(16).toString("hex");
      try {
        db.prepare(
          "INSERT INTO users(email,name,role,salt,hash) VALUES(?,?,?,?,?)",
        ).run(b.email, b.name, b.role, salt, hash(b.password, salt));
      } catch {
        fail(409, "Email đã tồn tại");
      }
      return send(201, { ok: true });
    }
    if (path === "/api/heritage" && req.method === "GET") {
      const q = String(url.searchParams.get("q") || "").toLowerCase(),
        category = url.searchParams.get("category");
      const rows = db
        .prepare(
          `SELECT * FROM heritage ${user ? "" : "WHERE status='published'"} ORDER BY updated_at DESC`,
        )
        .all()
        .map(decode)
        .filter(
          (r) =>
            (!q ||
              `${r.title} ${r.location} ${r.summary}`
                .toLowerCase()
                .includes(q)) &&
            (!category || r.category === category),
        );
      return send(200, rows);
    }
    if (path === "/api/heritage" && req.method === "POST") {
      auth(["admin", "editor"]);
      const v = fields(await body(req));
      const keys = Object.keys(v);
      const r = db
        .prepare(
          `INSERT INTO heritage(${keys.join(",")},created_by,updated_at) VALUES(${keys.map(() => "?").join(",")},?,?)`,
        )
        .run(...Object.values(v), user.id, now());
      audit(user, "create", Number(r.lastInsertRowid));
      return send(
        201,
        decode(
          db
            .prepare("SELECT * FROM heritage WHERE id=?")
            .get(r.lastInsertRowid),
        ),
      );
    }
    const match =
      /^\/api\/heritage\/(\d+)(?:\/(submit|review|feedback))?$/.exec(path);
    if (match) {
      const id = Number(match[1]),
        action = match[2];
      const r = db.prepare("SELECT * FROM heritage WHERE id=?").get(id);
      if (!r || (!user && r.status !== "published"))
        fail(404, "Không tìm thấy hồ sơ");
      if (!action && req.method === "GET") {
        if (r.status === "published")
          db.prepare("UPDATE heritage SET views=views+1 WHERE id=?").run(id);
        return send(200, decode(r));
      }
      if (!action && req.method === "PUT") {
        auth(["admin", "editor"]);
        if (user.role !== "admin" && r.created_by !== user.id)
          fail(403, "Chỉ được sửa hồ sơ do bạn tạo");
        const v = fields(await body(req));
        db.prepare(
          `UPDATE heritage SET ${Object.keys(v)
            .map((k) => k + "=?")
            .join(
              ",",
            )},status='draft',reviewer='',review_note='',updated_at=? WHERE id=?`,
        ).run(...Object.values(v), now(), id);
        audit(user, "edit", id);
        return send(200, { ok: true });
      }
      if (action === "submit" && req.method === "POST") {
        auth(["admin", "editor"]);
        if (user.role !== "admin" && r.created_by !== user.id)
          fail(403, "Chỉ được gửi hồ sơ do bạn tạo");
        if (!["draft", "rejected"].includes(r.status))
          fail(409, "Hồ sơ không ở trạng thái có thể gửi duyệt");
        if (
          !r.source ||
          !r.author ||
          !r.rights ||
          !r.content ||
          JSON.parse(r.media).some((m) => !m.source || !m.rights)
        )
          fail(
            400,
            "Cần nội dung, nguồn, tác giả và quyền sử dụng cho hồ sơ và từng tư liệu",
          );
        db.prepare(
          "UPDATE heritage SET status='pending',updated_at=? WHERE id=?",
        ).run(now(), id);
        audit(user, "submit", id);
        return send(200, { ok: true });
      }
      if (action === "review" && req.method === "POST") {
        auth(["admin", "reviewer"]);
        if (r.status !== "pending") fail(409, "Hồ sơ chưa chờ duyệt");
        if (r.created_by === user.id)
          fail(403, "Người nhập không được tự duyệt hồ sơ");
        const b = await body(req);
        if (
          !["published", "rejected"].includes(b.status) ||
          !String(b.note || "").trim()
        )
          fail(400, "Cần kết quả và ghi chú kiểm chứng");
        db.prepare(
          "UPDATE heritage SET status=?,reviewer=?,review_note=?,updated_at=? WHERE id=?",
        ).run(b.status, user.name, b.note, now(), id);
        audit(user, b.status, id);
        return send(200, { ok: true });
      }
      if (action === "feedback" && req.method === "POST") {
        limit("feedback:" + req.socket.remoteAddress, 30, 3600000);
        if (r.status !== "published")
          fail(400, "Chỉ nhận phản hồi cho hồ sơ đã công bố");
        const b = await body(req);
        if (
          !Number.isInteger(b.rating) ||
          b.rating < 1 ||
          b.rating > 5 ||
          !String(b.comment || "").trim() ||
          String(b.comment).length > 3000
        )
          fail(400, "Nhập đánh giá 1–5 và nhận xét tối đa 3000 ký tự");
        db.prepare(
          "INSERT INTO feedback(heritage_id,name,rating,comment,created_at) VALUES(?,?,?,?,?)",
        ).run(
          id,
          String(b.name || "Ẩn danh").slice(0, 100),
          b.rating,
          b.comment,
          now(),
        );
        return send(201, { ok: true });
      }
    }
    if (path === "/api/stats" && req.method === "GET") {
      auth();
      return send(200, {
        total: db.prepare("SELECT COUNT(*) n FROM heritage").get().n,
        published: db
          .prepare("SELECT COUNT(*) n FROM heritage WHERE status='published'")
          .get().n,
        pending: db
          .prepare("SELECT COUNT(*) n FROM heritage WHERE status='pending'")
          .get().n,
        views: db.prepare("SELECT COALESCE(SUM(views),0) n FROM heritage").get()
          .n,
        feedback: db
          .prepare(
            "SELECT f.*,h.title FROM feedback f JOIN heritage h ON h.id=f.heritage_id ORDER BY f.id DESC",
          )
          .all(),
      });
    }
    if (path === "/api/backup" && req.method === "GET") {
      auth(["admin"]);
      return send(200, {
        version: 2,
        exported_at: now(),
        entries: db
          .prepare("SELECT * FROM entries")
          .all()
          .map((r) => ({ ...r, data: JSON.parse(r.data) })),
        files: db.prepare("SELECT * FROM files").all(),
        report: projectReport(db),
        heritage: db.prepare("SELECT * FROM heritage").all().map(decode),
        feedback: db.prepare("SELECT * FROM feedback").all(),
        audit: db.prepare("SELECT * FROM audit").all(),
      });
    }
    if (path.startsWith("/api/")) fail(404, "Không tìm thấy chức năng");
    if (req.method !== "GET") fail(405, "Phương thức không hỗ trợ");
    if (path === "/map/region.geojson") {
      res.writeHead(200, {
        "Content-Type": "application/geo+json",
        "Cache-Control": "public, max-age=3600",
      });
      res.end(readFileSync(resolve(root, "public/map/region.geojson")));
      return;
    }
    const guides = {
      "thuyet-minh-thuc-hien.md": "text/markdown; charset=utf-8",
      "thuyet-minh-thuc-hien.docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "thuyet-minh-thuc-hien.pdf": "application/pdf",
    };
    if (path.startsWith("/guides/")) {
      const name = path.slice(8);
      if (!guides[name]) fail(404, "Không tìm thấy hướng dẫn");
      res.writeHead(200, {
        "Content-Type": guides[name],
        "Content-Disposition": `attachment; filename="${name}"`,
        "X-Content-Type-Options": "nosniff",
      });
      res.end(readFileSync(resolve(root, "docs", name)));
      return;
    }
    const templates = [
      "phoi-hop.md",
      "ban-giao.md",
      "nghiem-thu.md",
      "kiem-tra-ky-thuat.csv",
      "phieu-khao-sat.csv",
      "phan-cong.csv",
    ];
    if (path.startsWith("/templates/")) {
      const name = path.slice(11);
      if (!templates.includes(name)) fail(404, "Không tìm thấy biểu mẫu");
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "X-Content-Type-Options": "nosniff",
      });
      res.end(readFileSync(resolve(root, "docs/templates", name)));
      return;
    }
    const vendor = {
      "/vendor/leaflet.js": ["leaflet.js", "text/javascript"],
      "/vendor/leaflet.css": ["leaflet.css", "text/css"],
      "/vendor/images/marker-icon.png": ["images/marker-icon.png", "image/png"],
      "/vendor/images/marker-icon-2x.png": [
        "images/marker-icon-2x.png",
        "image/png",
      ],
      "/vendor/images/marker-shadow.png": [
        "images/marker-shadow.png",
        "image/png",
      ],
      "/vendor/images/layers.png": ["images/layers.png", "image/png"],
      "/vendor/images/layers-2x.png": ["images/layers-2x.png", "image/png"],
    }[path];
    if (vendor) {
      res.writeHead(200, {
        "Content-Type": vendor[1],
        "X-Content-Type-Options": "nosniff",
      });
      res.end(
        readFileSync(resolve(root, "node_modules/leaflet/dist", vendor[0])),
      );
      return;
    }
    const files = {
      "/": "index.html",
      "/app.js": "app.js",
      "/toolkit.js": "toolkit.js",
      "/style.css": "style.css",
    };
    const file = files[path];
    if (!file || !existsSync(resolve(root, "public", file)))
      fail(404, "Không tìm thấy trang");
    res.writeHead(200, {
      "Content-Type": file.endsWith(".js")
        ? "text/javascript; charset=utf-8"
        : file.endsWith(".css")
          ? "text/css; charset=utf-8"
          : "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' https:; media-src 'self' https:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'",
    });
    res.end(readFileSync(resolve(root, "public", file)));
  } catch (e) {
    send(e.status || 500, { error: e.status ? e.message : "Lỗi máy chủ" });
    if (!e.status) console.error(e);
  }
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
server.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () => console.log(`HeritageKit đang chạy, cổng ${server.address().port}`),
);

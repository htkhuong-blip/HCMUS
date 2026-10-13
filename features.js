import { buildReport } from "./shared/report.js";
import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import QRCode from "qrcode";

export const kinds = [
  "products",
  "tasks",
  "worklogs",
  "evidence",
  "trials",
  "budget",
];
export const evidenceKinds = [
  "cooperation",
  "source",
  "verification",
  "technical",
  "user-testing",
  "handover",
  "acceptance",
  "budget",
  "assignment",
];
export const productTypes = [
  "Trang giới thiệu",
  "Bộ ảnh số",
  "Thuyết minh âm thanh",
  "Video di sản",
  "Dòng thời gian",
  "Tuyến khám phá",
  "Tài liệu giáo dục",
  "Trải nghiệm tương tác",
];
export function setupFeatures(db, uploadDir) {
  mkdirSync(uploadDir, { recursive: true });
  db.exec(`CREATE TABLE IF NOT EXISTS entries(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,status TEXT NOT NULL,created_by INTEGER REFERENCES users(id),reviewer_id INTEGER REFERENCES users(id),review_note TEXT DEFAULT '',updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,name TEXT,mime TEXT,size INTEGER,sha256 TEXT,created_by INTEGER REFERENCES users(id),created_at TEXT);`);
}
export function entries(db, kind) {
  return db
    .prepare(
      "SELECT e.*,u.name creator,r.name reviewer FROM entries e JOIN users u ON u.id=e.created_by LEFT JOIN users r ON r.id=e.reviewer_id WHERE e.kind=? ORDER BY e.id DESC",
    )
    .all(kind)
    .map((r) => ({ ...r, ...JSON.parse(r.data), data: undefined }));
}
const string = (v, max = 5000) =>
  String(v ?? "")
    .trim()
    .slice(0, max);
const parseEntry = (r) => ({ ...r, ...JSON.parse(r.data), data: undefined });
export function validMediaUrl(db, url) {
  if (typeof url !== "string") return false;
  if (/^https:\/\//.test(url)) {
    try {
      const u = new URL(url);
      return !!u.hostname && !u.username && !u.password;
    } catch {
      return false;
    }
  }
  const m = /^\/uploads\/([a-f0-9]{32})$/.exec(url);
  return !!m && !!db.prepare("SELECT id FROM files WHERE id=?").get(m[1]);
}
function validate(kind, b, db, fail) {
  const need = (v, label) => {
    if (!string(v)) fail(400, `Cần nhập ${label}`);
    return string(v);
  };
  const day = (v) => {
    v = string(v, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
      !Number.isFinite(Date.parse(v)) ||
      new Date(v).toISOString().slice(0, 10) !== v
    )
      fail(400, "Ngày không hợp lệ");
    return v;
  };
  const fk = (id, table, subkind) => {
    if (id == null || id === "") return null;
    id = Number(id);
    if (
      !Number.isSafeInteger(id) ||
      !db
        .prepare(
          `SELECT id FROM ${table} WHERE id=? ${subkind ? "AND kind=?" : ""}`,
        )
        .get(...(subkind ? [id, subkind] : [id]))
    )
      fail(400, "Hồ sơ liên kết không tồn tại");
    return id;
  };
  if (kind === "products") {
    const v = {
      title: need(b.title, "tên sản phẩm"),
      type: need(b.type, "loại sản phẩm"),
      heritage_id: fk(b.heritage_id, "heritage"),
      description: need(b.description, "mô tả"),
      url: need(b.url, "đường dẫn sản phẩm"),
      source: need(b.source, "nguồn"),
      rights: need(b.rights, "quyền sử dụng"),
    };
    if (
      !productTypes.includes(v.type) ||
      !v.heritage_id ||
      !(validMediaUrl(db, v.url) || v.url === `/#heritage/${v.heritage_id}`)
    )
      fail(400, "Chọn loại, di sản và đường dẫn HTTPS hoặc tệp đã tải lên");
    return v;
  }
  if (kind === "budget") {
    const v = {
      title: need(b.title, "hạng mục kinh phí"),
      unit: need(b.unit, "đơn vị tính"),
      quantity: Number(b.quantity),
      unit_cost: Number(b.unit_cost),
      funding: need(b.funding, "nguồn kinh phí/nguồn lực"),
      classification: need(b.classification, "loại ghi nhận"),
      date: day(b.date),
      task_id: fk(b.task_id, "entries", "tasks"),
      url: string(b.url),
      note: string(b.note),
    };
    if (
      !Number.isFinite(v.quantity) ||
      v.quantity <= 0 ||
      v.quantity > 1e6 ||
      !Number.isSafeInteger(v.unit_cost) ||
      v.unit_cost < 0 ||
      !Number.isSafeInteger(v.quantity * v.unit_cost) ||
      !["estimate", "spent"].includes(v.classification)
    )
      fail(400, "Số lượng, đơn giá VND hoặc loại ghi nhận không hợp lệ");
    if (v.url && !validMediaUrl(db, v.url))
      fail(400, "Đường dẫn chứng từ không hợp lệ");
    return v;
  }
  if (kind === "tasks") {
    const v = {
      title: need(b.title, "nhiệm vụ"),
      unit: need(b.unit, "đơn vị phụ trách"),
      assignee_id: fk(b.assignee_id, "users"),
      stage: need(b.stage, "giai đoạn"),
      due: day(b.due),
      description: string(b.description),
      progress: Number(b.progress || 0),
    };
    if (
      ![
        "Khảo sát",
        "Thu thập",
        "Xây dựng",
        "Thử nghiệm",
        "Nghiệm thu",
      ].includes(v.stage) ||
      !Number.isInteger(v.progress) ||
      v.progress < 0 ||
      v.progress > 100
    )
      fail(400, "Giai đoạn hoặc tiến độ không hợp lệ");
    return v;
  }
  if (kind === "worklogs") {
    const v = {
      member: need(b.member, "người thực hiện"),
      unit: need(b.unit, "đơn vị"),
      date: day(b.date),
      hours: Number(b.hours),
      task_id: fk(b.task_id, "entries", "tasks"),
      description: need(b.description, "công việc và kết quả"),
    };
    if (!Number.isFinite(v.hours) || v.hours <= 0 || v.hours > 24)
      fail(400, "Số giờ cần lớn hơn 0 và không quá 24");
    return v;
  }
  if (kind === "evidence") {
    const v = {
      title: need(b.title, "tên minh chứng"),
      kind_code: need(b.kind_code, "loại minh chứng"),
      heritage_id: fk(b.heritage_id, "heritage"),
      product_id: fk(b.product_id, "entries", "products"),
      issuer: need(b.issuer, "đơn vị/người xác nhận"),
      date: day(b.date),
      url: need(b.url, "tệp hoặc đường dẫn"),
      note: string(b.note),
    };
    if (!evidenceKinds.includes(v.kind_code) || !validMediaUrl(db, v.url))
      fail(400, "Loại minh chứng hoặc đường dẫn không hợp lệ");
    return v;
  }
  if (kind === "trials") {
    if (!Array.isArray(b.participants) || b.participants.length > 300)
      fail(400, "Danh sách người dùng không hợp lệ (tối đa 300)");
    const participants = b.participants.map((p) => {
      if (!p || typeof p !== "object" || Array.isArray(p))
        fail(400, "Phiếu khảo sát không hợp lệ");
      const v = {
        name: need(p.name, "tên hoặc mã người dùng"),
        unit: string(p.unit),
        clarity: Number(p.clarity),
        usability: Number(p.usability),
        usefulness: Number(p.usefulness),
        comment: string(p.comment, 3000),
      };
      if (
        [v.clarity, v.usability, v.usefulness].some(
          (n) => !Number.isInteger(n) || n < 1 || n > 5,
        )
      )
        fail(400, "Điểm khảo sát cần từ 1 đến 5");
      return v;
    });
    if (
      new Set(participants.map((p) => p.name.toLocaleLowerCase("vi"))).size !==
      participants.length
    )
      fail(400, "Tên hoặc mã người tham gia bị trùng trong đợt thử nghiệm");
    return {
      title: need(b.title, "tên đợt thử nghiệm"),
      date: day(b.date),
      audience: need(b.audience, "nhóm người dùng"),
      summary: string(b.summary),
      participants,
    };
  }
}
export function projectReport(db) {
  return buildReport({
    heritage: db.prepare("SELECT * FROM heritage").all(),
    products: entries(db, "products"),
    evidence: entries(db, "evidence"),
    tasks: entries(db, "tasks"),
    logs: entries(db, "worklogs"),
    trials: entries(db, "trials"),
    budget: entries(db, "budget"),
    feedback: db
      .prepare(
        "SELECT f.*,h.title FROM feedback f JOIN heritage h ON h.id=f.heritage_id ORDER BY f.id DESC",
      )
      .all(),
  });
}
export async function handleFeatures(ctx) {
  const {
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
  } = ctx;
  if (path === "/api/uploads" && req.method === "POST") {
    auth(["admin", "editor"]);
    const b = await body(req, 15 * 1024 * 1024);
    const name = string(b.name, 200);
    if (
      !name ||
      typeof b.base64 !== "string" ||
      !b.base64.length ||
      b.base64.length % 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64)
    )
      fail(400, "Tệp không hợp lệ");
    const bytes = Buffer.from(b.base64, "base64");
    if (!bytes.length || bytes.length > 10 * 1024 * 1024)
      fail(413, "Tệp tối đa 10 MB");
    let mime;
    const start = bytes.subarray(0, 12);
    if (start.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
      mime = "image/jpeg";
    else if (
      start
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      mime = "image/png";
    else if (
      start.subarray(0, 6).toString() === "GIF89a" ||
      start.subarray(0, 6).toString() === "GIF87a"
    )
      mime = "image/gif";
    else if (
      start.subarray(0, 4).toString() === "RIFF" &&
      start.subarray(8, 12).toString() === "WEBP"
    )
      mime = "image/webp";
    else if (start.subarray(0, 5).toString() === "%PDF-")
      mime = "application/pdf";
    else if (
      start.subarray(0, 3).toString() === "ID3" ||
      (bytes[0] === 255 && (bytes[1] & 224) === 224)
    )
      mime = "audio/mpeg";
    else if (
      start.subarray(0, 4).toString() === "RIFF" &&
      start.subarray(8, 12).toString() === "WAVE"
    )
      mime = "audio/wav";
    else if (start.subarray(4, 8).toString() === "ftyp") mime = "video/mp4";
    else
      fail(
        400,
        "Chỉ nhận ảnh JPG/PNG/GIF/WebP, PDF, MP3/WAV, MP4 có định dạng phù hợp",
      );
    const id = randomBytes(16).toString("hex");
    writeFileSync(resolve(uploadDir, id), bytes, { mode: 0o600, flag: "wx" });
    db.prepare("INSERT INTO files VALUES(?,?,?,?,?,?,?)").run(
      id,
      name,
      mime,
      bytes.length,
      createHash("sha256").update(bytes).digest("hex"),
      user.id,
      new Date().toISOString(),
    );
    audit(user, "upload", null);
    send(201, {
      id,
      name,
      mime,
      size: bytes.length,
      url: "/uploads/" + id,
      type: mime.startsWith("image")
        ? "image"
        : mime.startsWith("audio")
          ? "audio"
          : mime.startsWith("video")
            ? "video"
            : "document",
    });
    return true;
  }
  if (path.startsWith("/uploads/") && ["GET", "HEAD"].includes(req.method)) {
    const id = path.slice(9);
    if (!/^[a-f0-9]{32}$/.test(id)) fail(404, "Không tìm thấy tệp");
    const f = db.prepare("SELECT * FROM files WHERE id=?").get(id);
    if (!f || !existsSync(resolve(uploadDir, id)))
      fail(404, "Không tìm thấy tệp");
    const fileUrl = "/uploads/" + id;
    const linked =
      db
        .prepare("SELECT media FROM heritage WHERE status='published'")
        .all()
        .some((h) => JSON.parse(h.media).some((m) => m.url === fileUrl)) ||
      entries(db, "products").some(
        (p) =>
          p.status === "published" &&
          p.url === fileUrl &&
          db
            .prepare(
              "SELECT id FROM heritage WHERE id=? AND status='published'",
            )
            .get(p.heritage_id),
      );
    if (!user && !linked) fail(404, "Không tìm thấy tệp");
    const bytes = readFileSync(resolve(uploadDir, id));
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
    let first = 0,
      last = bytes.length - 1,
      code = 200;
    if (range) {
      first = Number(range[1]);
      last = range[2] ? Math.min(Number(range[2]), last) : last;
      if (first > last || first >= bytes.length) {
        res.writeHead(416, { "Content-Range": `bytes */${bytes.length}` });
        res.end();
        return true;
      }
      code = 206;
    }
    res.writeHead(code, {
      "Content-Type": f.mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes",
      "Content-Length": last - first + 1,
      ...(code === 206
        ? { "Content-Range": `bytes ${first}-${last}/${bytes.length}` }
        : {}),
      ...(f.mime === "application/pdf"
        ? { "Content-Disposition": `attachment; filename="document-${id}.pdf"` }
        : {}),
    });
    res.end(
      req.method === "HEAD" ? undefined : bytes.subarray(first, last + 1),
    );
    return true;
  }
  if (path === "/api/qr" && req.method === "GET") {
    const id = Number(url.searchParams.get("heritage"));
    const h = db
      .prepare("SELECT id FROM heritage WHERE id=? AND status='published'")
      .get(id);
    if (!h) fail(404, "Chỉ tạo QR cho di sản đã công bố");
    const origin = ctx.publicUrl;
    const svg = await QRCode.toString(`${origin}/#heritage/${id}`, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 4,
    });
    res.writeHead(200, {
      "Content-Type": "image/svg+xml",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    res.end(svg);
    return true;
  }
  if (path === "/api/products/public" && req.method === "GET") {
    const products = entries(db, "products").filter(
      (p) =>
        p.status === "published" &&
        db
          .prepare("SELECT id FROM heritage WHERE id=? AND status='published'")
          .get(p.heritage_id),
    );
    send(
      200,
      products.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        heritage_id: p.heritage_id,
        description: p.description,
        url: p.url,
        source: p.source,
        rights: p.rights,
      })),
    );
    return true;
  }
  if (path === "/api/report" && req.method === "GET") {
    auth();
    send(200, projectReport(db));
    return true;
  }
  if (path === "/api/audit" && req.method === "GET") {
    auth(["admin"]);
    send(
      200,
      db
        .prepare(
          "SELECT a.*,u.name FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 300",
        )
        .all(),
    );
    return true;
  }
  const m =
    /^\/api\/(products|tasks|worklogs|evidence|trials|budget)(?:\/(\d+)(?:\/(submit|review))?)?$/.exec(
      path,
    );
  if (!m) return false;
  const [, kind, id, action] = m;
  auth();
  if (!id && req.method === "GET") {
    send(200, entries(db, kind));
    return true;
  }
  const stored = id
    ? db
        .prepare("SELECT * FROM entries WHERE id=? AND kind=?")
        .get(Number(id), kind)
    : null;
  if (id && !stored) fail(404, "Không tìm thấy bản ghi");
  const owner = () => {
    auth(["admin", "editor"]);
    if (stored && user.role !== "admin" && stored.created_by !== user.id)
      fail(403, "Chỉ được thay đổi bản ghi do bạn tạo");
  };
  if (action === "submit" && req.method === "POST") {
    owner();
    if (
      !["products", "evidence"].includes(kind) ||
      !["draft", "rejected"].includes(stored.status)
    )
      fail(409, "Không thể gửi kiểm tra ở trạng thái này");
    if (
      kind === "products" &&
      !db
        .prepare("SELECT id FROM heritage WHERE id=? AND status='published'")
        .get(parseEntry(stored).heritage_id)
    )
      fail(400, "Cần công bố hồ sơ di sản trước khi gửi duyệt sản phẩm");
    db.prepare(
      "UPDATE entries SET status='pending',updated_at=? WHERE id=?",
    ).run(new Date().toISOString(), Number(id));
    audit(user, kind + ":submit", Number(id));
    send(200, { ok: true });
    return true;
  }
  if (action === "review" && req.method === "POST") {
    auth(["admin", "reviewer"]);
    if (!["products", "evidence"].includes(kind) || stored.status !== "pending")
      fail(409, "Bản ghi chưa chờ kiểm tra");
    if (stored.created_by === user.id)
      fail(403, "Người tạo không được tự xác nhận");
    const b = await body(req);
    const approved = kind === "products" ? "published" : "approved";
    if (![approved, "rejected"].includes(b.status) || !string(b.note))
      fail(400, "Cần kết quả và ghi chú");
    if (
      kind === "products" &&
      b.status === approved &&
      !db
        .prepare("SELECT id FROM heritage WHERE id=? AND status='published'")
        .get(parseEntry(stored).heritage_id)
    )
      fail(400, "Di sản liên kết chưa công bố");
    db.prepare(
      "UPDATE entries SET status=?,reviewer_id=?,review_note=?,updated_at=? WHERE id=?",
    ).run(
      b.status,
      user.id,
      string(b.note),
      new Date().toISOString(),
      Number(id),
    );
    audit(user, kind + ":" + b.status, Number(id));
    send(200, { ok: true });
    return true;
  }
  if (
    !action &&
    ((!id && req.method === "POST") || (id && req.method === "PUT"))
  ) {
    owner();
    const b = await body(req);
    const v = validate(kind, b, db, fail);
    if (kind === "products") {
      if (v.url.startsWith("https://")) {
        const u = new URL(v.url);
        u.hash = "";
        u.searchParams.sort();
        v.url = u.href;
      }
      const checksum = (path) => {
        const m = /^\/uploads\/([a-f0-9]{32})$/.exec(path);
        return m
          ? db.prepare("SELECT sha256 FROM files WHERE id=?").get(m[1])?.sha256
          : null;
      };
      if (
        entries(db, kind).some(
          (p) =>
            p.id !== Number(id) &&
            (p.url === v.url ||
              (checksum(v.url) && checksum(v.url) === checksum(p.url))),
        )
      )
        fail(
          409,
          "Sản phẩm đã có cùng đường dẫn hoặc nội dung tệp; không tính trùng",
        );
    }
    if (kind === "worklogs") {
      const total = entries(db, kind)
        .filter(
          (l) =>
            l.id !== Number(id) &&
            l.date === v.date &&
            l.member.toLocaleLowerCase("vi") ===
              v.member.toLocaleLowerCase("vi") &&
            l.unit.toLocaleLowerCase("vi") === v.unit.toLocaleLowerCase("vi"),
        )
        .reduce((sum, l) => sum + l.hours, 0);
      if (total + v.hours > 24)
        fail(
          400,
          "Tổng giờ của một người trong cùng ngày không được vượt quá 24",
        );
    }
    let status = ["products", "evidence"].includes(kind)
      ? "draft"
      : kind === "trials"
        ? b.status === "completed"
          ? "completed"
          : "planned"
        : kind === "tasks"
          ? v.progress === 100
            ? "completed"
            : v.progress > 0
              ? "active"
              : "planned"
          : "recorded";
    if (
      kind === "trials" &&
      status === "completed" &&
      (!v.summary || !v.participants.length)
    )
      fail(400, "Hoàn tất thử nghiệm cần phiếu khảo sát và báo cáo tổng hợp");
    let rid = Number(id);
    if (id)
      db.prepare(
        "UPDATE entries SET data=?,status=?,reviewer_id=NULL,review_note='',updated_at=? WHERE id=?",
      ).run(JSON.stringify(v), status, new Date().toISOString(), rid);
    else
      rid = Number(
        db
          .prepare(
            "INSERT INTO entries(kind,data,status,created_by,updated_at) VALUES(?,?,?,?,?)",
          )
          .run(
            kind,
            JSON.stringify(v),
            status,
            user.id,
            new Date().toISOString(),
          ).lastInsertRowid,
      );
    audit(user, kind + ":" + (id ? "edit" : "create"), rid);
    send(
      id ? 200 : 201,
      parseEntry(db.prepare("SELECT * FROM entries WHERE id=?").get(rid)),
    );
    return true;
  }
  if (!action && id && req.method === "DELETE") {
    owner();
    if (["published", "approved", "pending"].includes(stored.status))
      fail(409, "Chỉ xóa bản nháp hoặc bản ghi chưa được xác nhận");
    const referenced =
      entries(db, "worklogs").some((x) => x.task_id === Number(id)) ||
      entries(db, "budget").some((x) => x.task_id === Number(id)) ||
      entries(db, "evidence").some((x) => x.product_id === Number(id));
    if (referenced)
      fail(409, "Bản ghi đang được minh chứng hoặc ngày công sử dụng");
    db.prepare("DELETE FROM entries WHERE id=?").run(Number(id));
    audit(user, kind + ":delete", Number(id));
    send(200, { ok: true });
    return true;
  }
  fail(405, "Phương thức không hỗ trợ");
}

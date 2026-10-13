import { accounts, seedState } from "./seed.js";
import { buildReport } from "./report.js";
import QRCode from "../vendor/qr-module.js";
const groups = [
  "products",
  "tasks",
  "worklogs",
  "evidence",
  "trials",
  "budget",
];
const database = new Promise((resolve, reject) => {
  const request = indexedDB.open("hcmus-heritagekit-browser-demo", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("data");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () =>
    reject(Error("Trình duyệt không cho phép lưu dữ liệu demo."));
});
const clone = (v) => structuredClone(v);
const fail = (message) => {
  throw Error(message);
};
const current = () =>
  accounts.find(
    (a) => a.id === Number(sessionStorage.getItem("heritage-demo-role")),
  ) || null;
const auth = (roles = ["admin", "editor", "reviewer"]) => {
  const u = current();
  if (!u) fail("Chọn vai trò để dùng công cụ demo");
  if (!roles.includes(u.role)) fail("Vai trò mô phỏng không có thao tác này");
  return u;
};
function store(fn) {
  return database.then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("data", "readwrite"),
          bucket = tx.objectStore("data"),
          r = bucket.get("state");
        let result;
        r.onsuccess = () => {
          try {
            const state = r.result || seedState();
            result = fn(state);
            bucket.put(state, "state");
          } catch (e) {
            tx.abort();
            reject(e);
          }
        };
        tx.oncomplete = () => resolve(clone(result));
        tx.onerror = () =>
          reject(
            Error("Không lưu được dữ liệu: kiểm tra dung lượng trình duyệt."),
          );
      }),
  );
}
const need = (v, label) => {
  if (!String(v ?? "").trim()) fail("Cần nhập " + label);
  return String(v).trim();
};
const allowedURL = (url, state) =>
  typeof url === "string" &&
  ((/^https:\/\//.test(url) &&
    !new URL(url).username &&
    !new URL(url).password) ||
    /^\.\/(demo\/images\/site-[123]\.svg|guides\/thuyet-minh-thuc-hien\.(pdf|docx)|#heritage\/\d+)$/.test(
      url,
    ) ||
    state.files.some((f) => f.url === url));
const date = (v) => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail("Ngày không hợp lệ");
  return v;
};
function record(kind, b, state) {
  const v = clone(b);
  delete v.id;
  delete v.created_by;
  if (kind === "heritage") {
    for (const k of ["title", "category", "location"]) v[k] = need(v[k], k);
    for (const k of ["summary", "content", "source", "author", "rights"])
      v[k] = String(v[k] || "");
    for (const k of ["media", "timeline"])
      if (!Array.isArray(v[k]) || v[k].length > 100)
        fail("Danh sách tư liệu/dấu mốc không hợp lệ");
    for (const m of v.media)
      if (
        !m ||
        !["image", "audio", "video", "document"].includes(m.type) ||
        !allowedURL(m.url, state)
      )
        fail("Tư liệu cần URL HTTPS hoặc tệp demo đã tải");
    for (const k of ["lat", "lng"]) {
      v[k] = v[k] === "" || v[k] == null ? null : Number(v[k]);
      if (
        v[k] !== null &&
        (!Number.isFinite(v[k]) || Math.abs(v[k]) > (k === "lat" ? 90 : 180))
      )
        fail("Tọa độ không hợp lệ");
    }
    return v;
  }
  const linked = (key, list, required = false) => {
    v[key] = v[key] === "" || v[key] == null ? null : Number(v[key]);
    if (
      (required && v[key] === null) ||
      (v[key] !== null && !list.some((x) => x.id === v[key]))
    )
      fail("Bản ghi liên kết không tồn tại");
  };
  if (kind === "products") {
    for (const k of ["title", "type", "description", "source", "rights"])
      v[k] = need(v[k], k);
    linked("heritage_id", state.heritage, true);
    if (!allowedURL(v.url, state)) fail("Đường dẫn sản phẩm không hợp lệ");
    if (v.url.startsWith("https:")) {
      const url = new URL(v.url);
      url.hash = "";
      url.searchParams.sort();
      v.url = url.href;
    }
  }
  if (kind === "evidence") {
    for (const k of ["title", "kind_code", "issuer"]) v[k] = need(v[k], k);
    linked("heritage_id", state.heritage);
    linked("product_id", state.products);
    date(v.date);
    if (!allowedURL(v.url, state)) fail("Đường dẫn minh chứng không hợp lệ");
  }
  if (kind === "tasks") {
    for (const k of ["title", "unit", "stage"]) v[k] = need(v[k], k);
    linked("assignee_id", accounts);
    date(v.due);
    v.progress = Number(v.progress || 0);
    if (!Number.isInteger(v.progress) || v.progress < 0 || v.progress > 100)
      fail("Tiến độ cần từ 0 đến 100");
  }
  if (kind === "worklogs") {
    for (const k of ["member", "unit", "description"]) v[k] = need(v[k], k);
    date(v.date);
    linked("task_id", state.tasks);
    v.hours = Number(v.hours);
    if (!Number.isFinite(v.hours) || v.hours <= 0 || v.hours > 24)
      fail("Giờ cần lớn hơn 0 và không quá 24");
  }
  if (kind === "budget") {
    for (const k of ["title", "unit", "funding"]) v[k] = need(v[k], k);
    date(v.date);
    linked("task_id", state.tasks);
    v.quantity = Number(v.quantity);
    v.unit_cost = Number(v.unit_cost);
    if (
      !Number.isFinite(v.quantity) ||
      v.quantity <= 0 ||
      !Number.isSafeInteger(v.unit_cost) ||
      v.unit_cost < 0 ||
      !Number.isSafeInteger(v.unit_cost * v.quantity) ||
      !["estimate", "spent"].includes(v.classification)
    )
      fail("Số lượng, đơn giá hoặc loại ghi nhận không hợp lệ");
    if (v.url && !allowedURL(v.url, state))
      fail("Đường dẫn chứng từ không hợp lệ");
  }
  if (kind === "trials") {
    need(v.title, "tên đợt");
    need(v.audience, "nhóm người dùng");
    date(v.date);
    if (!Array.isArray(v.participants) || v.participants.length > 300)
      fail("Danh sách khảo sát không hợp lệ");
    v.participants = v.participants.map((p) => {
      need(p.name, "mã/tên người dùng");
      const r = { ...p };
      for (const k of ["clarity", "usability", "usefulness"]) {
        r[k] = Number(r[k]);
        if (!Number.isInteger(r[k]) || r[k] < 1 || r[k] > 5)
          fail("Điểm khảo sát cần từ 1 đến 5");
      }
      return r;
    });
    if (
      new Set(v.participants.map((p) => p.name.toLocaleLowerCase("vi")))
        .size !== v.participants.length
    )
      fail("Người tham gia bị trùng");
    if (
      v.status === "completed" &&
      (!String(v.summary || "").trim() || !v.participants.length)
    )
      fail("Hoàn tất đợt cần phiếu khảo sát và báo cáo");
  }
  return v;
}
function importState(b) {
  if (
    !b ||
    b.format !== "heritagekit-browser-demo" ||
    b.version !== 1 ||
    !Number.isSafeInteger(b.nextId) ||
    b.nextId < 1
  )
    fail("Tệp không phải bản xuất demo HeritageKit");
  for (const k of ["heritage", ...groups, "feedback", "audit", "files"])
    if (!Array.isArray(b[k]) || b[k].length > 10000)
      fail("Cấu trúc dữ liệu nhập không hợp lệ");
  const ids = new Set();
  for (const k of ["heritage", ...groups])
    for (const r of b[k]) {
      if (
        !Number.isSafeInteger(r.id) ||
        r.id < 1 ||
        ids.has(r.id) ||
        r.id >= b.nextId ||
        !accounts.some((a) => a.id === r.created_by)
      )
        fail("Mã hoặc người tạo bản ghi không hợp lệ");
      ids.add(r.id);
    }
  for (const f of b.files)
    if (
      !/^data:(image\/(png|jpeg|gif|webp)|audio\/(mpeg|wav)|video\/mp4|application\/pdf);base64,[A-Za-z0-9+/]+=*$/.test(
        f.url,
      ) ||
      f.url.length > 15 * 1024 * 1024
    )
      fail("Tệp đính kèm nhập không hợp lệ");
  for (const k of ["heritage", ...groups])
    for (const r of b[k]) {
      record(k, r, b);
      if (
        ![
          "draft",
          "pending",
          "published",
          "approved",
          "rejected",
          "active",
          "planned",
          "completed",
          "recorded",
        ].includes(r.status)
      )
        fail("Trạng thái không hợp lệ");
    }
  return clone(b);
}
export async function demoApi(path, method = "GET", body) {
  if (path === "/me") return clone(current());
  if (path === "/login") {
    if (body.role === "guest") {
      sessionStorage.removeItem("heritage-demo-role");
      return null;
    }
    const u = accounts.find((a) => a.role === body.role);
    if (!u) fail("Chọn vai trò demo hợp lệ");
    sessionStorage.setItem("heritage-demo-role", u.id);
    return clone(u);
  }
  if (path === "/logout") {
    sessionStorage.removeItem("heritage-demo-role");
    return { ok: true };
  }
  return store((state) => {
    const user = current();
    const timestamp = new Date().toISOString();
    const audit = (action, id) =>
      state.audit.unshift({
        id: state.nextId++,
        user_id: user?.id,
        name: user?.name || "Khách demo",
        action,
        heritage_id: id,
        created_at: timestamp,
      });
    if (path === "/users" && method === "GET") {
      auth();
      return accounts;
    }
    if (path === "/password" || path === "/users")
      fail(
        "Demo dùng vai trò mô phỏng, không tạo tài khoản hoặc mật khẩu thật.",
      );
    if (path === "/backup") {
      auth();
      return state;
    }
    if (path === "/demo/reset" && method === "POST") {
      auth(["admin"]);
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, seedState());
      return { ok: true };
    }
    if (path === "/demo/import" && method === "POST") {
      auth(["admin"]);
      const replacement = importState(body);
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, replacement);
      return { ok: true };
    }
    if (path === "/audit") {
      auth(["admin"]);
      return state.audit;
    }
    if (path === "/report") {
      auth();
      const report = buildReport({ ...state, logs: state.worklogs });
      report.demo = true;
      report.disclaimer =
        "Bản demo: số liệu minh họa hoặc do bạn nhập trên thiết bị này, không phải kết quả nghiệm thu thực tế.";
      return report;
    }
    if (path === "/stats") {
      auth();
      return {
        total: state.heritage.length,
        published: state.heritage.filter((h) => h.status === "published")
          .length,
        pending: state.heritage.filter((h) => h.status === "pending").length,
        views: state.heritage.reduce((s, h) => s + h.views, 0),
        feedback: state.feedback.map((f) => ({
          ...f,
          title: state.heritage.find((h) => h.id === f.heritage_id)?.title,
        })),
      };
    }
    if (path === "/products/public")
      return state.products.filter(
        (p) =>
          p.status === "published" &&
          state.heritage.some(
            (h) => h.id === p.heritage_id && h.status === "published",
          ),
      );
    if (path === "/uploads" && method === "POST") {
      auth(["admin", "editor"]);
      if (
        typeof body.base64 !== "string" ||
        body.base64.length > 14 * 1024 * 1024 ||
        !body.base64.length ||
        body.base64.length % 4 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)
      )
        fail("Tệp tối đa 10 MB, dữ liệu base64 hợp lệ");
      const bytes = atob(body.base64),
        byte = (i) => bytes.charCodeAt(i);
      let mime;
      if (bytes.startsWith("%PDF-")) mime = "application/pdf";
      else if (byte(0) === 137 && bytes.slice(1, 4) === "PNG")
        mime = "image/png";
      else if (byte(0) === 255 && byte(1) === 216 && byte(2) === 255)
        mime = "image/jpeg";
      else if (bytes.startsWith("GIF87a") || bytes.startsWith("GIF89a"))
        mime = "image/gif";
      else if (bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP")
        mime = "image/webp";
      else if (
        bytes.startsWith("ID3") ||
        (byte(0) === 255 && (byte(1) & 224) === 224)
      )
        mime = "audio/mpeg";
      else if (bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WAVE")
        mime = "audio/wav";
      else if (bytes.slice(4, 8) === "ftyp") mime = "video/mp4";
      else fail("Chỉ nhận ảnh, PDF, MP3/WAV, MP4 có định dạng phù hợp");
      if (bytes.length > 10 * 1024 * 1024) fail("Tệp tối đa 10 MB");
      const file = {
        id: state.nextId++,
        name: String(body.name || "Tư liệu").slice(0, 200),
        mime,
        size: bytes.length,
        url: `data:${mime};base64,${body.base64}`,
        type: mime.startsWith("image")
          ? "image"
          : mime.startsWith("audio")
            ? "audio"
            : mime.startsWith("video")
              ? "video"
              : "document",
      };
      state.files.push(file);
      audit("upload", file.id);
      return file;
    }
    const match =
      /^\/(heritage|products|tasks|worklogs|evidence|trials|budget)(?:\/(\d+)(?:\/(submit|review|feedback))?)?$/.exec(
        path,
      );
    if (!match) fail("Chức năng demo chưa hỗ trợ");
    const [, kind, rawId, action] = match,
      list = state[kind],
      id = Number(rawId),
      existing = list.find((r) => r.id === id);
    if (method === "GET" && !rawId) {
      if (kind === "heritage")
        return user ? list : list.filter((h) => h.status === "published");
      auth();
      return list;
    }
    if (
      rawId &&
      (!existing ||
        (kind === "heritage" && !user && existing.status !== "published"))
    )
      fail("Không tìm thấy hồ sơ");
    if (kind === "heritage" && rawId && method === "GET") {
      if (existing.status === "published") existing.views++;
      return existing;
    }
    if (action === "feedback" && method === "POST") {
      if (kind !== "heritage") fail("Phản hồi cần gắn hồ sơ di sản");
      if (existing.status !== "published") fail("Hồ sơ chưa công bố");
      if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)
        fail("Đánh giá cần 1–5");
      need(body.comment, "nhận xét");
      state.feedback.push({
        id: state.nextId++,
        heritage_id: id,
        name: String(body.name || "Khách demo").slice(0, 100),
        rating: body.rating,
        comment: String(body.comment).slice(0, 3000),
        created_at: timestamp,
      });
      return { ok: true };
    }
    const owner = () => {
      auth(["admin", "editor"]);
      if (existing && user.role !== "admin" && existing.created_by !== user.id)
        fail("Chỉ được sửa bản ghi do vai trò này tạo");
    };
    if (action === "submit" && method === "POST") {
      owner();
      if (
        !["heritage", "products", "evidence"].includes(kind) ||
        !["draft", "rejected"].includes(existing.status)
      )
        fail("Không thể gửi duyệt");
      if (
        kind === "heritage" &&
        (!existing.content ||
          !existing.source ||
          !existing.author ||
          !existing.rights ||
          existing.media.some((m) => !m.source || !m.rights))
      )
        fail("Bổ sung nội dung, nguồn, tác giả, quyền sử dụng");
      if (
        kind === "products" &&
        !state.heritage.some(
          (h) => h.id === existing.heritage_id && h.status === "published",
        )
      )
        fail("Di sản liên kết chưa công bố");
      existing.status = "pending";
      existing.updated_at = timestamp;
      audit(kind + ":submit", id);
      return { ok: true };
    }
    if (action === "review" && method === "POST") {
      auth(["admin", "reviewer"]);
      if (!["heritage", "products", "evidence"].includes(kind))
        fail("Bản ghi không dùng quy trình kiểm chứng");
      if (existing.status !== "pending") fail("Chưa chờ kiểm chứng");
      if (existing.created_by === user.id)
        fail("Người tạo không được tự duyệt trong luồng mô phỏng");
      const approval = kind === "evidence" ? "approved" : "published";
      if (![approval, "rejected"].includes(body.status))
        fail("Kết quả không hợp lệ");
      need(body.note, "nhận xét");
      if (
        kind === "products" &&
        body.status === "published" &&
        !state.heritage.some(
          (h) => h.id === existing.heritage_id && h.status === "published",
        )
      )
        fail("Di sản liên kết chưa công bố");
      existing.status = body.status;
      existing.reviewer = user.name;
      existing.reviewer_id = user.id;
      existing.review_note = body.note;
      existing.updated_at = timestamp;
      audit(kind + ":" + body.status, id);
      return { ok: true };
    }
    if (
      !action &&
      ((!rawId && method === "POST") || (rawId && method === "PUT"))
    ) {
      owner();
      const data = record(kind, body, state);
      if (
        kind === "products" &&
        list.some((p) => p.id !== id && p.url === data.url)
      )
        fail("Đường dẫn hoặc nội dung sản phẩm đã có");
      if (
        kind === "worklogs" &&
        list
          .filter(
            (l) =>
              l.id !== id &&
              l.date === data.date &&
              l.member.toLocaleLowerCase("vi") ===
                data.member.toLocaleLowerCase("vi") &&
              l.unit === data.unit,
          )
          .reduce((s, l) => s + l.hours, 0) +
          data.hours >
          24
      )
        fail("Tổng giờ trong ngày không quá 24");
      const status = ["heritage", "products", "evidence"].includes(kind)
        ? "draft"
        : kind === "trials"
          ? data.status === "completed"
            ? "completed"
            : "planned"
          : kind === "tasks"
            ? data.progress === 100
              ? "completed"
              : data.progress > 0
                ? "active"
                : "planned"
            : "recorded";
      const output = {
        ...data,
        id: existing?.id || state.nextId++,
        created_by: existing?.created_by || user.id,
        creator: existing?.creator || user.name,
        status,
        reviewer: "",
        reviewer_id: null,
        review_note: "",
        updated_at: timestamp,
        ...(kind === "heritage" ? { views: existing?.views || 0 } : {}),
      };
      if (existing) list[list.indexOf(existing)] = output;
      else list.unshift(output);
      audit(kind + ":" + (existing ? "edit" : "create"), output.id);
      return output;
    }
    if (!action && rawId && method === "DELETE") {
      owner();
      if (["published", "approved", "pending"].includes(existing.status))
        fail("Chỉ xóa bản ghi chưa xác nhận");
      if (
        state.worklogs.some((l) => l.task_id === id) ||
        state.budget.some((l) => l.task_id === id) ||
        state.evidence.some((e) => e.product_id === id)
      )
        fail("Bản ghi đang được sử dụng");
      list.splice(list.indexOf(existing), 1);
      audit(kind + ":delete", id);
      return { ok: true };
    }
    fail("Thao tác không được hỗ trợ trong demo");
  });
}
export async function qrUrl(id) {
  const svg = await QRCode.toString(
    new URL(id > 3 ? "./" : `./#heritage/${id}`, location.href).href,
    { type: "svg", margin: 4, errorCorrectionLevel: "M" },
  );
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
}

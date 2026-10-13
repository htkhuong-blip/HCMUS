import { createToolkit } from "./toolkit.js";
const app = document.querySelector("#app");
let user = null,
  records = [];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const labels = {
  draft: "Bản nháp",
  pending: "Chờ kiểm chứng",
  published: "Đã công bố",
  rejected: "Cần bổ sung",
};
const types = [
  "Di tích lịch sử",
  "Di sản phi vật thể",
  "Kiến trúc nghệ thuật",
  "Địa chỉ văn hóa",
];
function notice(s) {
  const n = document.querySelector("#notice");
  n.textContent = s;
  n.style.display = "block";
  setTimeout(() => (n.style.display = "none"), 5000);
}
async function api(path, method = "GET", data) {
  const r = await fetch("/api" + path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  const b = await r.json();
  if (!r.ok) throw Error(b.error);
  return b;
}
const run = (f) => async (e) => {
  try {
    await f(e);
  } catch (err) {
    notice(err.message);
  }
};
const toolkit = createToolkit({
  app,
  api,
  esc,
  notice,
  run,
  getUser: () => user,
  manage,
  detail,
});
function bind(id, fn) {
  document.getElementById(id)?.addEventListener("click", run(fn));
}
function card(r, manage = false) {
  return `<article class="card"><span class="badge">${esc(manage ? labels[r.status] : r.category)}</span><h3>${esc(r.title)}</h3><small>⌖ ${esc(r.location)}</small><p class="muted">${esc(r.summary)}</p><button data-view="${r.id}">Xem hồ sơ →</button></article>`;
}
function viewBindings() {
  app
    .querySelectorAll("[data-view]")
    .forEach((b) => (b.onclick = run(() => detail(Number(b.dataset.view)))));
}
async function explore() {
  history.replaceState(null, "", location.pathname);
  records = await api("/heritage");
  records = records.filter((r) => r.status === "published");
  app.innerHTML = `<section class="hero"><div><span class="eyebrow">Di sản hôm qua · Kết nối hôm nay</span><h1>Gìn giữ ký ức.<br>Lan tỏa giá trị.</h1><p class="muted">Khám phá những câu chuyện văn hóa qua hồ sơ số, tư liệu đa phương tiện và dấu ấn lịch sử được kiểm chứng.</p><a class="button primary" href="#collection">Khám phá kho di sản ↓</a></div><div class="art" aria-hidden="true"><strong>◈</strong><span>HCMUS HERITAGEKIT</span></div></section><section id="collection"><div class="row"><button id="map-explore">Bản đồ di sản</button><button id="public-products">Xem sản phẩm số</button></div><span class="eyebrow">Kho tư liệu cộng đồng</span><h2>Những dấu ấn di sản</h2><div class="toolbar"><input id="search" aria-label="Tìm kiếm di sản" placeholder="Tìm tên di sản, địa điểm, câu chuyện…"><select id="category" aria-label="Loại hình"><option value="">Tất cả loại hình</option>${types.map((t) => `<option>${t}</option>`).join("")}</select></div><div id="results"></div></section>`;
  const filter = () => {
    const q = document.querySelector("#search").value.toLocaleLowerCase("vi"),
      c = document.querySelector("#category").value;
    const rows = records.filter(
      (r) =>
        (!c || r.category === c) &&
        `${r.title} ${r.location} ${r.summary}`
          .toLocaleLowerCase("vi")
          .includes(q),
    );
    document.querySelector("#results").innerHTML = rows.length
      ? `<div class="grid">${rows.map((r) => card(r)).join("")}</div>`
      : `<div class="empty"><h3>${records.length ? "Không tìm thấy di sản phù hợp" : "Kho di sản đang được xây dựng"}</h3><p>Hồ sơ sẽ xuất hiện sau khi được kiểm chứng và công bố.</p></div>`;
    viewBindings();
  };
  document.querySelector("#search").oninput = filter;
  document.querySelector("#category").onchange = filter;
  filter();
  bind("map-explore", showMap);
  bind("public-products", publicProducts);
}
async function login() {
  app.innerHTML = `<section class="panel"><span class="eyebrow">Dành cho nhóm thực hiện</span><h2>Đăng nhập không gian quản lý</h2><form id="login-form"><label>Email<input name="email" type="email" required autocomplete="username"></label><label>Mật khẩu<input name="password" type="password" required autocomplete="current-password"></label><button class="primary">Đăng nhập</button></form></section>`;
  document.querySelector("form").onsubmit = run(async (e) => {
    e.preventDefault();
    user = await api(
      "/login",
      "POST",
      Object.fromEntries(new FormData(e.target)),
    );
    updateNav();
    await manage();
  });
}
function updateNav() {
  document.querySelector("#login").textContent = user
    ? "Đăng xuất"
    : "Đăng nhập";
}
async function manage() {
  if (!user) return login();
  history.replaceState(null, "", location.pathname);
  const [rows, stats] = await Promise.all([api("/heritage"), api("/stats")]);
  records = rows;
  app.innerHTML = `${toolkit.nav()}<span class="eyebrow">Không gian làm việc · ${esc(user.name)}</span><div class="row"><h2>Quản lý di sản</h2>${user.role !== "reviewer" ? '<button class="primary" id="new">+ Tạo hồ sơ</button>' : ""}${user.role === "admin" ? '<button id="backup">Xuất bản sao dữ liệu</button><button id="account">Thêm tài khoản</button>' : ""}</div><div class="metrics">${[
    ["Hồ sơ", stats.total],
    ["Đã công bố", stats.published],
    ["Chờ duyệt", stats.pending],
    ["Lượt xem", stats.views],
  ]
    .map(([l, v]) => `<div class="metric"><b>${v}</b>${l}</div>`)
    .join(
      "",
    )}</div><p class="muted">Quy trình: Bản nháp → Gửi kiểm chứng → Chuyên gia duyệt → Công bố. Chỉnh sửa hồ sơ sẽ đưa hồ sơ về bản nháp.</p><div class="grid">${rows.map((r) => card(r, true)).join("")}</div>${!rows.length ? '<div class="empty">Chưa có hồ sơ. Hãy tạo hồ sơ đầu tiên với nguồn và quyền sử dụng rõ ràng.</div>' : ""}<section class="panel"><h2>Phản hồi người dùng (${stats.feedback.length})</h2>${stats.feedback.map((f) => `<p><b>${esc(f.title)} · ${f.rating}/5</b><br>${esc(f.comment)}<br><small>${esc(f.name)}</small></p>`).join("") || "<p>Chưa có phản hồi.</p>"}</section>`;
  toolkit.bindNav();
  viewBindings();
  bind("new", () => edit());
  bind("account", accounts);
  bind("backup", async () => {
    const b = await api("/backup");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `heritagekit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
async function detail(id) {
  const r = await api("/heritage/" + id);
  history.replaceState(null, "", `#heritage/${id}`);
  app.innerHTML = `<button id="back">← ${user ? "Quản lý" : "Kho di sản"}</button><section class="panel"><span class="badge">${esc(labels[r.status])}</span><h1>${esc(r.title)}</h1><p>${esc(r.category)} · ⌖ ${esc(r.location)}</p><p>${esc(r.summary)}</p><div class="detail-content">${esc(r.content)}</div>${r.lat !== null && r.lng !== null ? `<p><a target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=16/${r.lat}/${r.lng}">Xem vị trí trên bản đồ ↗</a></p>` : ""}${r.lat !== null && r.lng !== null ? '<div id="detail-map" class="heritage-map" aria-label="Bản đồ vị trí di sản"></div>' : ""}<h2>Dấu mốc lịch sử</h2><div class="timeline">${r.timeline.map((t) => `<p><b>${esc(t.year)}</b><br>${esc(t.text)}</p>`).join("") || "<p>Chưa bổ sung dấu mốc.</p>"}</div><h2>Tư liệu</h2><div class="grid">${r.media.map((m) => `<div class="card media"><b>${esc(m.title)}</b>${m.type === "image" ? `<img src="${esc(m.url)}" alt="${esc(m.title)}" loading="lazy">` : m.type === "audio" ? `<audio controls src="${esc(m.url)}"></audio>` : m.type === "video" ? `<video controls preload="metadata" src="${esc(m.url)}"></video>` : `<a href="${esc(m.url)}" target="_blank" rel="noopener">Mở tài liệu ↗</a>`}<small>Nguồn: ${esc(m.source)}<br>Quyền sử dụng: ${esc(m.rights)}</small></div>`).join("") || "<p>Chưa có tư liệu.</p>"}</div><h2>Nguồn gốc và kiểm chứng</h2><p>Nguồn: ${esc(r.source)}<br>Tác giả/đơn vị: ${esc(r.author)}<br>Quyền sử dụng: ${esc(r.rights)}<br>Người kiểm chứng: ${esc(r.reviewer || "Chưa được kiểm chứng")}<br>Ghi chú: ${esc(r.review_note)}</p><div class="row">${user && ["admin", "editor"].includes(user.role) && (user.role === "admin" || user.id === r.created_by) ? '<button id="edit">Chỉnh sửa hồ sơ</button>' : ""}${user && ["draft", "rejected"].includes(r.status) && (user.role === "admin" || (user.role === "editor" && user.id === r.created_by)) ? '<button id="submit" class="primary">Gửi kiểm chứng</button>' : ""}<button id="share">Sao chép liên kết</button>${r.status === "published" ? '<button id="qr-share">Mã QR chia sẻ</button>' : ""}</div>${r.status === "published" ? `<div id="qr-panel" class="qr-panel" hidden><img src="/api/qr?heritage=${id}" alt="Mã QR trang giới thiệu di sản"><p><a class="button" download="heritage-${id}-qr.svg" href="/api/qr?heritage=${id}">Tải QR để in / trưng bày</a></p></div>` : ""}</section>${user && ["admin", "reviewer"].includes(user.role) && r.status === "pending" ? '<section class="panel"><h2>Kiểm chứng nội dung</h2><form id="review"><label>Kết quả<select name="status"><option value="published">Duyệt và công bố</option><option value="rejected">Yêu cầu bổ sung</option></select></label><label>Nhận xét kiểm chứng<textarea name="note" required></textarea></label><button class="primary">Lưu kết quả</button></form></section>' : ""}${r.status === "published" ? '<section class="panel"><h2>Chia sẻ trải nghiệm của bạn</h2><form id="feedback"><label>Tên (không bắt buộc)<input name="name" maxlength="100"></label><label>Mức độ hữu ích<select name="rating"><option value="5">5 — Rất hữu ích</option><option value="4">4 — Hữu ích</option><option value="3">3 — Bình thường</option><option value="2">2 — Cần cải thiện</option><option value="1">1 — Chưa hữu ích</option></select></label><label>Nhận xét<textarea name="comment" required maxlength="3000"></textarea></label><button class="primary">Gửi phản hồi</button></form></section>' : ""}`;
  if (r.lat !== null && r.lng !== null && window.L) {
    const map = await geographicMap("detail-map", [r.lat, r.lng], 6);
    L.marker([r.lat, r.lng]).addTo(map).bindPopup(esc(r.title));
  }
  bind("qr-share", () => {
    document.querySelector("#qr-panel").hidden =
      !document.querySelector("#qr-panel").hidden;
  });
  bind("back", () => (user ? manage() : explore()));
  bind("edit", () => edit(r));
  bind("submit", async () => {
    await api(`/heritage/${id}/submit`, "POST", {});
    notice("Đã gửi kiểm chứng");
    await detail(id);
  });
  bind("share", async () => {
    await navigator.clipboard.writeText(`${location.origin}/#heritage/${id}`);
    notice("Đã sao chép liên kết");
  });
  document.querySelector("#review")?.addEventListener(
    "submit",
    run(async (e) => {
      e.preventDefault();
      await api(
        `/heritage/${id}/review`,
        "POST",
        Object.fromEntries(new FormData(e.target)),
      );
      notice("Đã lưu kết quả");
      await detail(id);
    }),
  );
  document.querySelector("#feedback")?.addEventListener(
    "submit",
    run(async (e) => {
      e.preventDefault();
      const b = Object.fromEntries(new FormData(e.target));
      b.rating = Number(b.rating);
      await api(`/heritage/${id}/feedback`, "POST", b);
      e.target.reset();
      notice("Cảm ơn bạn đã phản hồi");
    }),
  );
}
function edit(r = {}) {
  const input = (key, label, required = false) =>
    `<label>${label}<input name="${key}" value="${esc(r[key])}" ${required ? "required" : ""}></label>`;
  app.innerHTML = `${toolkit.nav()}<button id="back">← Quản lý</button><section class="panel"><h2>${r.id ? "Chỉnh sửa" : "Tạo"} hồ sơ di sản</h2><form id="editor"><div class="form-grid">${input("title", "Tên di sản", true)}<label>Loại hình<select name="category">${types.map((t) => `<option ${r.category === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>${input("location", "Địa điểm", true)}${input("author", "Tác giả / đơn vị cung cấp")}</div><label>Giới thiệu ngắn<textarea name="summary">${esc(r.summary)}</textarea></label><label>Nội dung giới thiệu<textarea name="content">${esc(r.content)}</textarea></label>${input("source", "Nguồn tư liệu / đường dẫn tham khảo")}${input("rights", "Quyền sử dụng / văn bản đồng ý")}<div class="form-grid">${input("lat", "Vĩ độ (không bắt buộc)")}${input("lng", "Kinh độ (không bắt buộc)")}</div><h3>Tư liệu đa phương tiện</h3><p class="muted">Mỗi tư liệu cần nguồn và quyền sử dụng riêng. Thêm URL HTTPS hoặc tải tệp tối đa 10 MB.</p><div id="media-items"></div><button id="add-media" type="button">+ Thêm tư liệu</button><h3>Dòng thời gian</h3><div id="timeline-items"></div><button id="add-timeline" type="button">+ Thêm dấu mốc</button><p class="muted">Lưu hồ sơ tạo bản nháp. Cần đủ nội dung, nguồn, tác giả và quyền trước khi gửi kiểm chứng.</p><button id="save-heritage" class="primary">Lưu bản nháp</button></form></section>`;
  toolkit.bindNav();
  bind("back", manage);
  function mediaRow(m = {}) {
    const el = document.createElement("fieldset");
    el.className = "media-item";
    el.innerHTML = `<legend>Tư liệu</legend><div class="form-grid"><label>Tên tư liệu<input data-field="title" value="${esc(m.title)}" required></label><label>Loại<select data-field="type">${[
      ["image", "Hình ảnh"],
      ["audio", "Âm thanh"],
      ["video", "Video"],
      ["document", "Tài liệu"],
    ]
      .map(
        ([k, v]) =>
          `<option value="${k}" ${m.type === k ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select></label></div><label>Đường dẫn tư liệu<input data-field="url" required value="${esc(m.url)}"></label><label>Hoặc tải tệp<input type="file" data-upload accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,audio/mpeg,audio/wav,video/mp4"></label><div class="form-grid"><label>Nguồn<input data-field="source" value="${esc(m.source)}"></label><label>Quyền sử dụng<input data-field="rights" value="${esc(m.rights)}"></label></div><button type="button" data-remove>Xóa tư liệu</button><p data-upload-status role="status"></p>`;
    el.querySelector("[data-remove]").onclick = () => el.remove();
    el.querySelector("[data-upload]").onchange = run(async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const save = document.querySelector("#save-heritage"),
        status = el.querySelector("[data-upload-status]");
      save.disabled = true;
      status.textContent = "Đang tải tệp…";
      try {
        const info = await toolkit.upload(file);
        el.querySelector('[data-field="url"]').value = info.url;
        el.querySelector('[data-field="type"]').value = info.type;
        if (!el.querySelector('[data-field="title"]').value)
          el.querySelector('[data-field="title"]').value = info.name;
        status.textContent = "Đã tải: " + info.name;
      } catch (err) {
        status.textContent = err.message;
        throw err;
      } finally {
        save.disabled = false;
      }
    });
    document.querySelector("#media-items").append(el);
  }
  function timelineRow(t = {}) {
    const el = document.createElement("fieldset");
    el.className = "timeline-item";
    el.innerHTML = `<legend>Dấu mốc</legend><label>Thời điểm<input data-field="year" required value="${esc(t.year)}" placeholder="Ví dụ: năm 1920"></label><label>Nội dung<textarea data-field="text" required>${esc(t.text)}</textarea></label><button type="button">Xóa dấu mốc</button>`;
    el.querySelector("button").onclick = () => el.remove();
    document.querySelector("#timeline-items").append(el);
  }
  (r.media || []).forEach(mediaRow);
  (r.timeline || []).forEach(timelineRow);
  bind("add-media", () => mediaRow());
  bind("add-timeline", () => timelineRow());
  const getRows = (selector) =>
    [...document.querySelectorAll(selector)].map((el) =>
      Object.fromEntries(
        [...el.querySelectorAll("[data-field]")].map((i) => [
          i.dataset.field,
          i.value,
        ]),
      ),
    );
  document.querySelector("#editor").onsubmit = run(async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.target));
    b.media = getRows(".media-item");
    b.timeline = getRows(".timeline-item");
    const save = document.querySelector("#save-heritage");
    save.disabled = true;
    try {
      await api(
        "/heritage" + (r.id ? "/" + r.id : ""),
        r.id ? "PUT" : "POST",
        b,
      );
      notice("Đã lưu hồ sơ");
      await manage();
    } finally {
      if (save.isConnected) save.disabled = false;
    }
  });
}
async function geographicMap(element, center, zoom) {
  const map = L.map(element).setView(center, zoom);
  const geo = await (await fetch("/map/region.geojson")).json();
  const offline = L.geoJSON(geo, {
    style: {
      color: "#91a595",
      weight: 1,
      fillColor: "#e5ece5",
      fillOpacity: 1,
    },
    attribution: "Natural Earth (public domain)",
    onEachFeature: (feature, layer) =>
      layer.bindTooltip(feature.properties.name),
  }).addTo(map);
  const online = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  });
  L.control
    .layers({
      "Sơ đồ địa lý ngoại tuyến": offline,
      "Đường phố OpenStreetMap": online,
    })
    .addTo(map);
  return map;
}
async function showMap() {
  const data = (await api("/heritage")).filter(
    (r) => r.status === "published" && r.lat !== null && r.lng !== null,
  );
  app.innerHTML = `<button id="back">← Khám phá</button><h2>Bản đồ di sản</h2><p class="muted">${data.length} địa điểm có tọa độ. Sơ đồ địa lý ngoại tuyến: Natural Earth. Chọn lớp OpenStreetMap để xem đường phố khi có kết nối mạng.</p><div id="explore-map" class="heritage-map large-map"></div><div class="grid">${data.map((r) => card(r)).join("")}</div>`;
  bind("back", explore);
  viewBindings();
  if (window.L) {
    const map = await geographicMap("explore-map", [16, 106], 5);
    data.forEach((r) =>
      L.marker([r.lat, r.lng])
        .addTo(map)
        .bindPopup(
          `<b>${esc(r.title)}</b><br><a href="#heritage/${r.id}">Xem hồ sơ</a>`,
        ),
    );
    if (data.length)
      map.fitBounds(
        data.map((r) => [r.lat, r.lng]),
        { padding: [30, 30], maxZoom: 7 },
      );
  }
}
async function publicProducts() {
  const products = await api("/products/public");
  app.innerHTML = `<button id="back">← Khám phá</button><h2>Sản phẩm số di sản</h2><p class="muted">Sản phẩm đã được kiểm tra nguồn và quyền sử dụng trước khi công bố.</p><div class="grid">${products.map((p) => `<article class="card"><span class="badge">${esc(p.type)}</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><small>Nguồn: ${esc(p.source)}<br>Quyền: ${esc(p.rights)}</small><a class="button primary" target="_blank" rel="noopener" href="${esc(p.url)}">Trải nghiệm sản phẩm ↗</a><button data-view="${p.heritage_id}">Xem di sản liên quan</button></article>`).join("")}</div>${products.length ? "" : '<div class="empty">Sản phẩm sẽ xuất hiện sau khi được duyệt và di sản liên quan đã công bố.</div>'}`;
  bind("back", explore);
  viewBindings();
}
function accounts() {
  app.innerHTML =
    '<section class="panel"><h2>Thêm thành viên</h2><form id="account-form"><label>Họ tên<input name="name" required></label><label>Email<input type="email" name="email" required></label><label>Vai trò<select name="role"><option value="editor">Người nhập tư liệu</option><option value="reviewer">Chuyên gia kiểm chứng</option><option value="admin">Quản trị viên</option></select></label><label>Mật khẩu ban đầu<input type="password" name="password" minlength="12" required autocomplete="new-password"></label><button class="primary">Tạo tài khoản</button><button type="button" id="back">Quay lại</button></form></section>';
  bind("back", manage);
  document.querySelector("form").onsubmit = run(async (e) => {
    e.preventDefault();
    await api("/users", "POST", Object.fromEntries(new FormData(e.target)));
    notice("Đã tạo tài khoản");
    await manage();
  });
}
bind("toolkit", () => toolkit.show());
bind("explore", explore);
bind("manage", manage);
bind("login", async () => {
  if (user) {
    await api("/logout", "POST", {});
    user = null;
    updateNav();
    await explore();
  } else await login();
});
async function route() {
  const m = /^#heritage\/(\d+)$/.exec(location.hash);
  await (m ? detail(Number(m[1])) : explore());
}
window.addEventListener("hashchange", run(route));
try {
  user = await api("/me");
  updateNav();
  await route();
} catch (e) {
  notice(e.message);
}

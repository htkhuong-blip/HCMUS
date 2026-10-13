const names = {
  overview: "Tổng quan triển khai",
  products: "Sản phẩm số",
  tasks: "Phân công công việc",
  worklogs: "Nhật ký & ngày công",
  evidence: "Hồ sơ minh chứng",
  trials: "Thử nghiệm người dùng",
  budget: "Kinh phí & nguồn lực",
  report: "Báo cáo & nghiệm thu",
  guide: "Hướng dẫn thực hiện",
  settings: "Tài khoản & vận hành",
};
const states = {
  draft: "Bản nháp",
  pending: "Chờ kiểm tra",
  published: "Đã công bố",
  approved: "Đã kiểm tra",
  rejected: "Cần bổ sung",
  planned: "Dự kiến",
  active: "Đang thực hiện",
  completed: "Hoàn tất",
  recorded: "Đã ghi nhận",
};
const evidenceNames = {
  cooperation: "Phối hợp đơn vị",
  source: "Nguồn và quyền tư liệu",
  verification: "Xác nhận chuyên môn",
  technical: "Kiểm tra kỹ thuật",
  "user-testing": "Báo cáo thử nghiệm",
  handover: "Bàn giao / xác nhận sử dụng",
  acceptance: "Nghiệm thu",
  budget: "Kinh phí / nguồn lực",
  assignment: "Phân công lực lượng",
};
const productTypes = [
  "Trang giới thiệu",
  "Bộ ảnh số",
  "Thuyết minh âm thanh",
  "Video di sản",
  "Dòng thời gian",
  "Tuyến khám phá",
  "Tài liệu giáo dục",
  "Trải nghiệm tương tác",
];
const stages = ["Khảo sát", "Thu thập", "Xây dựng", "Thử nghiệm", "Nghiệm thu"];
export function createToolkit(ctx) {
  const isDemo = window.HERITAGE_DEMO === true;
  const asset = (path) =>
    new URL(path.replace(/^\//, ""), new URL("./", location.href)).href;
  const { app, api, esc, notice, run, getUser, manage, detail } = ctx;
  let current = "overview",
    rows = [],
    lookups = {};
  const canEdit = () => ["admin", "editor"].includes(getUser()?.role);
  const own = (r) =>
    canEdit() && (getUser().role === "admin" || r.created_by === getUser().id);
  const bind = (id, fn) =>
    document.getElementById(id)?.addEventListener("click", run(fn));
  function nav() {
    return `<div class="tool-links"><button data-module="overview">Tổng quan</button><button data-module="dossiers">Hồ sơ di sản</button>${Object.entries(
      names,
    )
      .filter(([k]) => k !== "overview")
      .map(([k, v]) => `<button data-module="${k}">${v}</button>`)
      .join("")}</div>`;
  }
  function bindNav() {
    app
      .querySelectorAll("[data-module]")
      .forEach(
        (b) =>
          (b.onclick = run(() =>
            b.dataset.module === "dossiers" ? manage() : show(b.dataset.module),
          )),
      );
  }
  function shell(html) {
    app.innerHTML = `<div class="workspace-heading"><div><span class="eyebrow">HCMUS HeritageKit · Bộ công cụ thực hiện đề án</span><h2>${names[current] || "Không gian làm việc"}</h2></div><span class="badge">${esc(getUser().name)} · ${esc({ admin: "Quản trị", editor: "Nhập liệu", reviewer: "Kiểm chứng" }[getUser().role])}</span></div>${nav()}${html}`;
    bindNav();
  }
  async function look() {
    const [heritage, users, tasks, products] = await Promise.all([
      api("/heritage"),
      api("/users"),
      api("/tasks"),
      api("/products"),
    ]);
    lookups = { heritage, users, tasks, products };
  }
  const titleOf = (list, id) => list?.find((x) => x.id === id)?.title || "—";
  const download = (name, contents, type = "application/json") => {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  function csv(filename, headers, data) {
    const safe = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    download(
      filename,
      "\uFEFF" +
        [headers, ...data].map((r) => r.map(safe).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  async function show(module = "overview") {
    if (!getUser()) return manage();
    current = module;
    if (module === "dossiers") return manage();
    if (module === "overview" || module === "report") {
      const r = await api("/report");
      return report(r, module === "overview");
    }
    if (module === "guide") return guide();
    if (module === "settings") return settings();
    await look();
    rows = await api("/" + module);
    list();
  }
  function list() {
    const desc = {
      budget:
        "Ghi dự toán hoặc thực chi, số lượng, đơn giá VND, nguồn kinh phí và chứng từ. Số liệu cần đối chiếu xác nhận thực tế.",
      products:
        "Đăng ký sản phẩm độc lập, gắn di sản, nguồn và quyền sử dụng. Chuyên gia duyệt trước khi công bố; không cho phép đường dẫn trùng.",
      tasks:
        "Phân công theo 5 bước của đề án. Ghi đơn vị, người phụ trách, hạn hoàn thành và tiến độ.",
      worklogs:
        "Ghi người thực hiện, đơn vị, công việc, kết quả và số giờ. Ngày công hiển thị quy đổi theo 8 giờ/ngày.",
      evidence:
        "Lưu văn bản phối hợp, nguồn, kiểm chứng, thử nghiệm, bàn giao và nghiệm thu. Người khác kiểm tra trước khi tính vào chỉ tiêu.",
      trials:
        "Lập đợt dùng thử, ghi phiếu khảo sát và tổng hợp vấn đề cần sửa. Có thể dùng mã người tham gia để giảm thông tin cá nhân.",
    };
    shell(
      `<p class="muted">${desc[current]}</p><div class="row section-actions"><button id="export-csv">Xuất CSV</button>${canEdit() ? '<button class="primary" id="add-entry">+ Thêm mới</button>' : ""}<span class="muted">${rows.length} bản ghi</span></div><div class="grid entries">${rows.map((r) => entryCard(r)).join("")}</div>${!rows.length ? '<div class="empty"><h3>Chưa có dữ liệu</h3><p>Bắt đầu bằng một bản ghi thực tế. Không dùng dữ liệu minh họa để xác nhận chỉ tiêu.</p></div>' : ""}`,
    );
    bind("add-entry", () => form());
    bind("export-csv", () => exportCurrent());
    app
      .querySelectorAll("[data-edit]")
      .forEach(
        (b) =>
          (b.onclick = run(() =>
            form(rows.find((r) => r.id === Number(b.dataset.edit))),
          )),
      );
    app.querySelectorAll("[data-submit]").forEach(
      (b) =>
        (b.onclick = run(async () => {
          await api(`/${current}/${b.dataset.submit}/submit`, "POST", {});
          notice("Đã gửi kiểm tra");
          await show(current);
        })),
    );
    app
      .querySelectorAll("[data-review]")
      .forEach(
        (b) =>
          (b.onclick = run(() =>
            review(rows.find((r) => r.id === Number(b.dataset.review))),
          )),
      );
    app.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = run(async () => {
          if (
            !confirm(
              "Xóa bản ghi này? Thao tác chỉ áp dụng bản ghi chưa được xác nhận.",
            )
          )
            return;
          await api(`/${current}/${b.dataset.delete}`, "DELETE", {});
          notice("Đã xóa");
          await show(current);
        })),
    );
  }
  function entryCard(r) {
    let content = "";
    if (current === "products")
      content = `<p>${esc(r.type)} · ${esc(titleOf(lookups.heritage, r.heritage_id))}</p><p>${esc(r.description)}</p><a ${r.url.startsWith("data:") ? `download="${esc(r.title || "tai-lieu")}"` : 'target="_blank"'} rel="noopener" href="${esc(r.url)}">Mở sản phẩm ↗</a><small>Nguồn: ${esc(r.source)}<br>Quyền: ${esc(r.rights)}</small>`;
    if (current === "budget")
      content = `<p>${esc(r.classification === "estimate" ? "Dự toán" : "Thực chi")} · ${esc(r.date)}</p><p>${r.quantity} ${esc(r.unit)} × ${Number(r.unit_cost).toLocaleString("vi-VN")} đ<br><b>${(r.quantity * r.unit_cost).toLocaleString("vi-VN")} đ</b></p><small>Nguồn: ${esc(r.funding)}<br>${esc(r.note)}</small>${r.url ? `<a href="${esc(r.url)}" ${r.url.startsWith("data:") ? `download="${esc(r.title || "tai-lieu")}"` : 'target="_blank"'} rel="noopener">Chứng từ ↗</a>` : ""}`;
    if (current === "tasks")
      content = `<p>${esc(r.stage)} · ${esc(r.unit)}</p><p>Phụ trách: ${esc(lookups.users.find((u) => u.id === r.assignee_id)?.name || "Chưa phân công")}<br>Hạn: ${esc(r.due)}</p><progress value="${r.progress}" max="100" aria-label="Tiến độ ${r.progress}%"></progress><small>${r.progress}% hoàn thành</small><p>${esc(r.description)}</p>`;
    if (current === "worklogs")
      content = `<p>${esc(r.unit)} · ${esc(r.date)}</p><p><b>${r.hours} giờ</b> · ${(r.hours / 8).toFixed(2)} ngày công</p><small>Nhiệm vụ: ${esc(titleOf(lookups.tasks, r.task_id))}</small><p>${esc(r.description)}</p>`;
    if (current === "evidence")
      content = `<p>${esc(evidenceNames[r.kind_code])}</p><small>${esc(r.issuer)} · ${esc(r.date)}<br>Di sản: ${esc(titleOf(lookups.heritage, r.heritage_id))}<br>Sản phẩm: ${esc(titleOf(lookups.products, r.product_id))}</small><a href="${esc(r.url)}" ${r.url.startsWith("data:") ? `download="${esc(r.title || "tai-lieu")}"` : 'target="_blank"'} rel="noopener">Xem minh chứng ↗</a><p>${esc(r.note)}</p>`;
    if (current === "trials")
      content = `<p>${esc(r.date)} · ${esc(r.audience)}</p><p><b>${r.participants.length}</b> người tham gia</p><p>${esc(r.summary || "Chưa có tổng hợp kết quả")}</p><details><summary>Phiếu khảo sát</summary>${r.participants.map((p) => `<p><b>${esc(p.name)}</b> · ${esc(p.unit)}<br>Dễ hiểu ${p.clarity}/5 · Dễ dùng ${p.usability}/5 · Hữu ích ${p.usefulness}/5<br>${esc(p.comment)}</p>`).join("")}</details>`;
    const reviewable = ["products", "evidence"].includes(current);
    return `<article class="card"><span class="badge ${r.status === "pending" ? "pending" : ""}">${esc(states[r.status])}</span><h3>${esc(r.title || r.member)}</h3>${content}${r.review_note ? `<small>Kiểm tra: ${esc(r.reviewer || "—")}<br>${esc(r.review_note)}</small>` : ""}<div class="row card-actions">${own(r) ? `<button data-edit="${r.id}">Chỉnh sửa</button>${!["published", "approved", "pending"].includes(r.status) ? `<button data-delete="${r.id}">Xóa</button>` : ""}` : ""}${own(r) && reviewable && ["draft", "rejected"].includes(r.status) ? `<button class="primary" data-submit="${r.id}">Gửi kiểm tra</button>` : ""}${["admin", "reviewer"].includes(getUser().role) && r.created_by !== getUser().id && reviewable && r.status === "pending" ? `<button class="primary" data-review="${r.id}">Kiểm tra</button>` : ""}</div></article>`;
  }
  const input = (name, label, r, type = "text", required = false) =>
    `<label>${label}<input name="${name}" type="${type}" value="${esc(r[name])}" ${required ? "required" : ""} ${type === "number" ? 'step="any"' : ""}></label>`;
  const area = (name, label, r, required = false) =>
    `<label>${label}<textarea name="${name}" ${required ? "required" : ""}>${esc(r[name])}</textarea></label>`;
  const select = (name, label, options, r, optional = false) =>
    `<label>${label}<select name="${name}">${optional ? '<option value="">Không liên kết</option>' : ""}${options
      .map((o) => {
        const [value, label] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(value)}" ${String(r[name]) === String(value) ? "selected" : ""}>${esc(label)}</option>`;
      })
      .join("")}</select></label>`;
  const dates = (r) => input("date", "Ngày ghi nhận", r, "date", true);
  function form(r = {}) {
    r = {
      date: new Date().toISOString().slice(0, 10),
      due: "2027-05-30",
      ...r,
    };
    let html = "";
    if (current === "products")
      html =
        input("title", "Tên sản phẩm số", r, "text", true) +
        select("type", "Loại sản phẩm", productTypes, r) +
        select(
          "heritage_id",
          "Di sản liên kết",
          lookups.heritage.map((h) => [h.id, h.title]),
          r,
        ) +
        area("description", "Mô tả và giá trị sử dụng", r, true) +
        input(
          "url",
          "Đường dẫn sản phẩm (HTTPS, tệp đã tải hoặc /#heritage/ID)",
          r,
          "text",
          true,
        ) +
        uploadBox() +
        input("source", "Nguồn / tác giả", r, "text", true) +
        input("rights", "Quyền sử dụng", r, "text", true);
    if (current === "budget")
      html =
        input("title", "Hạng mục kinh phí / nguồn lực", r, "text", true) +
        input("unit", "Đơn vị tính (lượt, ngày, bộ…)", r, "text", true) +
        input("quantity", "Số lượng", r, "number", true) +
        input("unit_cost", "Đơn giá VND (số nguyên)", r, "number", true) +
        input("funding", "Nguồn kinh phí / đơn vị hỗ trợ", r, "text", true) +
        select(
          "classification",
          "Loại ghi nhận",
          [
            ["estimate", "Dự toán"],
            ["spent", "Thực chi"],
          ],
          r,
        ) +
        dates(r) +
        select(
          "task_id",
          "Nhiệm vụ liên kết",
          lookups.tasks.map((t) => [t.id, t.title]),
          r,
          true,
        ) +
        input("url", "Đường dẫn chứng từ (không bắt buộc)", r) +
        uploadBox() +
        area("note", "Ghi chú và cách đối chiếu", r);
    if (current === "tasks")
      html =
        input("title", "Nhiệm vụ", r, "text", true) +
        input("unit", "Đơn vị phụ trách", r, "text", true) +
        select(
          "assignee_id",
          "Người phụ trách",
          lookups.users.map((u) => [u.id, u.name + " · " + u.role]),
          r,
          true,
        ) +
        select("stage", "Giai đoạn đề án", stages, r) +
        input("due", "Hạn hoàn thành", r, "date", true) +
        input("progress", "Tiến độ (%)", r, "number", true) +
        area("description", "Mô tả / kết quả", r);
    if (current === "worklogs")
      html =
        input("member", "Tên người thực hiện", r, "text", true) +
        input("unit", "Đơn vị / cơ sở Đoàn", r, "text", true) +
        dates(r) +
        input("hours", "Số giờ thực hiện (tối đa 24)", r, "number", true) +
        select(
          "task_id",
          "Nhiệm vụ liên kết",
          lookups.tasks.map((t) => [t.id, t.title]),
          r,
          true,
        ) +
        area("description", "Công việc, kết quả và sản phẩm", r, true);
    if (current === "evidence")
      html =
        input("title", "Tên minh chứng", r, "text", true) +
        select(
          "kind_code",
          "Nhóm minh chứng",
          Object.entries(evidenceNames),
          r,
        ) +
        select(
          "heritage_id",
          "Di sản liên kết",
          lookups.heritage.map((h) => [h.id, h.title]),
          r,
          true,
        ) +
        select(
          "product_id",
          "Sản phẩm liên kết",
          lookups.products.map((p) => [p.id, p.title]),
          r,
          true,
        ) +
        input("issuer", "Đơn vị / người xác nhận văn bản", r, "text", true) +
        dates(r) +
        input("url", "Đường dẫn minh chứng", r, "text", true) +
        uploadBox() +
        area("note", "Ghi chú", r);
    if (current === "trials")
      html =
        input("title", "Tên đợt thử nghiệm", r, "text", true) +
        dates(r) +
        input("audience", "Nhóm người dùng", r, "text", true) +
        select(
          "status",
          "Trạng thái",
          [
            ["planned", "Đang chuẩn bị"],
            ["completed", "Hoàn tất và có báo cáo"],
          ],
          r,
        ) +
        area("summary", "Tổng hợp nhận xét, vấn đề và điều chỉnh", r) +
        `<h3>Phiếu khảo sát người dùng</h3><p class="muted">Mỗi phiếu ghi 3 tiêu chí 1–5. Có thể dùng mã thay cho họ tên; chỉ nhóm thực hiện xem được.</p><div id="participants"></div><button type="button" id="add-participant">+ Thêm người tham gia</button>`;
    shell(
      `<button id="back-list">← Danh sách</button><section class="panel"><h3>${r.id ? "Cập nhật" : "Thêm"} ${names[current].toLowerCase()}</h3><form id="entry-form">${html}<div class="row form-actions"><button class="primary" id="save-entry">Lưu dữ liệu</button></div></form></section>`,
    );
    bind("back-list", () => show(current));
    bindUpload();
    if (current === "trials") {
      for (const p of r.participants || []) addParticipant(p);
      bind("add-participant", () => addParticipant());
    }
    const savingModule = current;
    document.querySelector("#entry-form").onsubmit = run(async (e) => {
      e.preventDefault();
      const b = Object.fromEntries(new FormData(e.target));
      if (savingModule === "trials")
        b.participants = [...document.querySelectorAll(".participant")].map(
          (el) =>
            Object.fromEntries(
              [...el.querySelectorAll("[data-field]")].map((i) => [
                i.dataset.field,
                i.value,
              ]),
            ),
        );
      const button = document.querySelector("#save-entry");
      button.disabled = true;
      try {
        await api(
          "/" + savingModule + (r.id ? "/" + r.id : ""),
          r.id ? "PUT" : "POST",
          b,
        );
        notice("Đã lưu dữ liệu");
        await show(savingModule);
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    });
  }
  function addParticipant(p = {}) {
    const el = document.createElement("fieldset");
    el.className = "participant";
    el.innerHTML = `<legend>Phiếu khảo sát</legend><div class="form-grid"><label>Tên hoặc mã<input data-field="name" required value="${esc(p.name)}"></label><label>Đơn vị<input data-field="unit" value="${esc(p.unit)}"></label>${[
      ["clarity", "Dễ hiểu"],
      ["usability", "Dễ dùng"],
      ["usefulness", "Hữu ích"],
    ]
      .map(
        ([k, l]) =>
          `<label>${l}<select data-field="${k}">${[5, 4, 3, 2, 1].map((n) => `<option ${Number(p[k]) === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>`,
      )
      .join(
        "",
      )}</div><label>Nhận xét / vấn đề cần sửa<textarea data-field="comment">${esc(p.comment)}</textarea></label><button type="button" class="remove-participant">Xóa phiếu</button>`;
    el.querySelector("button").onclick = () => el.remove();
    document.querySelector("#participants").append(el);
  }
  function uploadBox() {
    return '<div class="upload-box"><label>Tải tệp từ máy<input id="entry-upload" type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,audio/mpeg,audio/wav,video/mp4"></label><small>Tối đa 10 MB/tệp. Tệp minh chứng và tư liệu nháp chỉ người đăng nhập được xem.</small><p id="upload-result" role="status"></p></div>';
  }
  function bindUpload() {
    document.querySelector("#entry-upload")?.addEventListener(
      "change",
      run(async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const result = document.querySelector("#upload-result");
        result.textContent = "Đang tải lên…";
        const save = document.querySelector("#save-entry");
        save.disabled = true;
        try {
          const info = await upload(f);
          document.querySelector('[name="url"]').value = info.url;
          result.textContent = "Đã tải: " + info.name;
        } catch (err) {
          result.textContent = err.message;
          throw err;
        } finally {
          save.disabled = false;
        }
      }),
    );
  }
  async function upload(file) {
    if (file.size > 10 * 1024 * 1024) throw Error("Tệp tối đa 10 MB");
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return api("/uploads", "POST", { name: file.name, base64 });
  }
  function review(r) {
    shell(
      `<button id="back-list">← Danh sách</button><section class="panel"><h3>Kiểm tra: ${esc(r.title)}</h3><p>Đối chiếu nội dung, nguồn và quyền sử dụng; kết quả ghi nhận trong nhật ký.</p><a href="${esc(r.url)}" ${r.url.startsWith("data:") ? `download="${esc(r.title || "tai-lieu")}"` : 'target="_blank"'} rel="noopener">Mở sản phẩm / minh chứng ↗</a><form id="review-entry">${select(
        "status",
        "Kết quả",
        [
          [current === "products" ? "published" : "approved", "Chấp thuận"],
          ["rejected", "Yêu cầu bổ sung"],
        ],
        {},
      )}${area("note", "Nhận xét kiểm tra", {}, true)}<button class="primary">Lưu kết quả</button></form></section>`,
    );
    bind("back-list", () => show(current));
    document.querySelector("form").onsubmit = run(async (e) => {
      e.preventDefault();
      await api(
        `/${current}/${r.id}/review`,
        "POST",
        Object.fromEntries(new FormData(e.target)),
      );
      notice("Đã ghi nhận kết quả");
      await show(current);
    });
  }
  function report(r, overview) {
    const s = r.summary;
    const count = r.indicators.filter((i) => i.met).length;
    shell(
      `<div class="row section-actions"><p class="muted">Hạn hoàn thành: <b>30/05/2027</b> · Theo dõi ${count}/7 chỉ tiêu đủ dữ liệu</p><button id="refresh-report">Cập nhật</button>${!overview ? '<button id="print-report">In / lưu PDF</button><button id="json-report">Xuất báo cáo JSON</button><button id="csv-report">Xuất chỉ tiêu CSV</button>' : ""}</div><div class="metrics">${[
        ["Hồ sơ công bố", s.published + "/3"],
        ["Sản phẩm số", s.products + "/5"],
        ["Giờ thực hiện", s.hours],
        ["Phiếu khảo sát", s.survey_responses],
      ]
        .map(([l, v]) => `<div class="metric"><b>${esc(v)}</b>${l}</div>`)
        .join(
          "",
        )}</div><section class="panel"><h3>Đối chiếu chỉ tiêu đề án</h3><p class="callout">${esc(r.disclaimer)}</p><div class="checklist">${r.indicators.map((i) => `<div class="check-item"><span class="check-icon ${i.met ? "done" : ""}">${i.met ? "✓" : "○"}</span><div><b>${esc(i.label)}</b><p>${esc(i.note)}</p></div><span class="badge">${i.current}/${i.target}</span></div>`).join("")}</div></section><div class="grid"><section class="card"><h3>Nhân sự & tiến độ</h3><p>${s.completed_tasks}/${s.tasks} nhiệm vụ hoàn tất<br>${s.members} người · ${s.units} đơn vị<br>${s.workdays} ngày công quy đổi</p><small>Quy đổi 8 giờ/ngày, chưa thay thế bảng xác nhận ngày công.</small></section><section class="card"><h3>Đánh giá người dùng</h3><p>Dễ hiểu: ${s.clarity ?? "—"}/5<br>Dễ dùng: ${s.usability ?? "—"}/5<br>Hữu ích: ${s.usefulness ?? "—"}/5</p><small>Tính từ phiếu khảo sát trong đợt thử nghiệm hoàn tất.</small></section><section class="card"><h3>Hồ sơ bàn giao</h3><p>${r.evidence.length} minh chứng đã ghi nhận<br>${r.feedback.length} phản hồi công khai</p><button data-module="evidence">Quản lý minh chứng →</button></section></div><section class="panel"><h3>Kinh phí & nguồn lực</h3><p>Dự toán: ${Number(s.estimated_budget).toLocaleString("vi-VN")} đ · Thực chi ghi nhận: ${Number(s.spent_budget).toLocaleString("vi-VN")} đ</p><small>Chưa thay thế bảng kê được đơn vị xác nhận. Không cộng dự toán và thực chi thành một tổng.</small><p><button data-module="budget">Mở sổ kinh phí →</button></p></section>${!overview ? reportTables(r) : ""}<p class="muted">Thời điểm tổng hợp: ${esc(new Date(r.generated_at).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" }))}</p>`,
    );
    bindNav();
    bind("refresh-report", () => show(current));
    bind("print-report", () => window.print());
    bind("json-report", () =>
      download("heritagekit-bao-cao.json", JSON.stringify(r, null, 2)),
    );
    bind("csv-report", () =>
      csv(
        "heritagekit-chi-tieu.csv",
        ["Chỉ tiêu", "Hiện có", "Mục tiêu", "Đủ dữ liệu", "Ghi chú"],
        r.indicators.map((i) => [
          i.label,
          i.current,
          i.target,
          i.met ? "Có" : "Chưa",
          i.note,
        ]),
      ),
    );
  }
  function reportTables(r) {
    const table = (title, heads, rows) =>
      `<section class="panel report-section"><h3>${title}</h3><div class="table-scroll"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${heads.length}">Chưa có dữ liệu</td></tr>`}</tbody></table></div></section>`;
    return (
      table(
        "Danh mục hồ sơ di sản",
        ["Tên", "Trạng thái", "Người kiểm chứng"],
        r.heritage.map((h) => [h.title, states[h.status], h.reviewer]),
      ) +
      table(
        "Danh mục sản phẩm số",
        ["Tên", "Loại", "Trạng thái", "Đường dẫn"],
        r.products.map((p) => [p.title, p.type, states[p.status], p.url]),
      ) +
      table(
        "Bảng kê kinh phí / nguồn lực",
        ["Hạng mục", "Loại", "Nguồn", "Thành tiền VND"],
        r.budget.map((b) => [
          b.title,
          b.classification === "estimate" ? "Dự toán" : "Thực chi",
          b.funding,
          b.quantity * b.unit_cost,
        ]),
      ) +
      table(
        "Bảng ghi nhận ngày công",
        ["Người thực hiện", "Đơn vị", "Ngày", "Giờ", "Kết quả"],
        r.worklogs.map((l) => [
          l.member,
          l.unit,
          l.date,
          l.hours,
          l.description,
        ]),
      ) +
      table(
        "Danh mục minh chứng",
        ["Tên", "Loại", "Đơn vị xác nhận", "Trạng thái"],
        r.evidence.map((e) => [
          e.title,
          evidenceNames[e.kind_code],
          e.issuer,
          states[e.status],
        ]),
      ) +
      r.trials
        .map((t) =>
          table(
            "Đợt thử nghiệm: " + esc(t.title),
            ["Người/mã", "Dễ hiểu", "Dễ dùng", "Hữu ích", "Nhận xét"],
            t.participants.map((p) => [
              p.name,
              p.clarity,
              p.usability,
              p.usefulness,
              p.comment,
            ]),
          ),
        )
        .join("")
    );
  }
  function exportCurrent() {
    const configs = {
      budget: [
        [
          "Hạng mục",
          "Ngày",
          "Loại",
          "Số lượng",
          "Đơn vị",
          "Đơn giá VND",
          "Thành tiền VND",
          "Nguồn",
          "Chứng từ",
        ],
        (r) => [
          r.title,
          r.date,
          r.classification,
          r.quantity,
          r.unit,
          r.unit_cost,
          r.quantity * r.unit_cost,
          r.funding,
          r.url,
        ],
      ],
      products: [
        ["Tên", "Loại", "Di sản", "URL", "Trạng thái"],
        (r) => [
          r.title,
          r.type,
          titleOf(lookups.heritage, r.heritage_id),
          r.url,
          states[r.status],
        ],
      ],
      tasks: [
        ["Nhiệm vụ", "Đơn vị", "Giai đoạn", "Hạn", "Tiến độ"],
        (r) => [r.title, r.unit, r.stage, r.due, r.progress],
      ],
      worklogs: [
        ["Người", "Đơn vị", "Ngày", "Giờ", "Ngày công", "Kết quả"],
        (r) => [r.member, r.unit, r.date, r.hours, r.hours / 8, r.description],
      ],
      evidence: [
        ["Tên", "Loại", "Đơn vị xác nhận", "Ngày", "URL", "Trạng thái"],
        (r) => [
          r.title,
          evidenceNames[r.kind_code],
          r.issuer,
          r.date,
          r.url,
          states[r.status],
        ],
      ],
      trials: [
        ["Tên đợt", "Ngày", "Nhóm", "Số phiếu", "Tổng hợp", "Trạng thái"],
        (r) => [
          r.title,
          r.date,
          r.audience,
          r.participants.length,
          r.summary,
          states[r.status],
        ],
      ],
    };
    const [heads, fn] = configs[current];
    csv(`heritagekit-${current}.csv`, heads, rows.map(fn));
  }
  function guide() {
    shell(
      `<section class="panel guide"><span class="eyebrow">Quy trình thực hiện công trình</span><h3>Từ tư liệu gốc đến hồ sơ bàn giao</h3><p>Bộ công cụ hỗ trợ 5 bước trong đề án. Thực hiện đúng vai trò, ghi nguồn và thu thập minh chứng ngay trong quá trình làm.</p>${[
        [
          "01",
          "Khảo sát & chọn di sản",
          "Tạo nhiệm vụ khảo sát, phân công người phụ trách. Lập ít nhất 03 hồ sơ di sản dạng nháp. Lưu văn bản phối hợp ở Minh chứng, chọn loại Phối hợp đơn vị và gắn đúng hồ sơ.",
          "tasks",
        ],
        [
          "02",
          "Thu thập & kiểm chứng",
          "Nhập nội dung, tác giả, nguồn, quyền sử dụng. Tải tư liệu hoặc dùng URL HTTPS. Bổ sung tọa độ và dấu mốc có nguồn xác nhận. Gửi kiểm chứng; chuyên gia dùng tài khoản riêng duyệt hoặc yêu cầu bổ sung.",
          "dossiers",
        ],
        [
          "03",
          "Xây dựng sản phẩm số",
          "Đăng ký từng sản phẩm có thể sử dụng độc lập: trang giới thiệu, bộ ảnh, thuyết minh âm thanh, video, tài liệu giáo dục… Gắn di sản đã công bố, nguồn và quyền. Gửi kiểm tra; không dùng cùng đường dẫn cho nhiều sản phẩm để đủ chỉ tiêu.",
          "products",
        ],
        [
          "04",
          "Thử nghiệm & điều chỉnh",
          "Tạo đợt dùng thử, ghi nhóm người dùng và từng phiếu 1–5 về dễ hiểu, dễ dùng, hữu ích. Tổng hợp vấn đề và cách sửa. Hoàn tất đợt khi có phiếu và báo cáo; ghi ngày công sửa lỗi, lưu biên bản thử nghiệm.",
          "trials",
        ],
        [
          "05",
          "Nghiệm thu & bàn giao",
          "Đối chiếu 7 chỉ tiêu, kiểm tra danh mục 03 hồ sơ và 05 sản phẩm. Lưu văn bản tiếp nhận, biên bản kiểm tra và nghiệm thu. Xuất báo cáo, bảng ngày công, sao lưu dữ liệu và bàn giao tài khoản cho đơn vị vận hành.",
          "report",
        ],
      ]
        .map(
          ([n, title, text, module]) =>
            `<article class="guide-step"><span>${n}</span><div><h3>${title}</h3><p>${text}</p><button data-module="${module}">Mở công cụ →</button></div></article>`,
        )
        .join(
          "",
        )}<h3>Thuyết minh cách thực hiện</h3><p>Tài liệu mô tả bộ công cụ, cách thao tác và đầu ra cho từng bước; có thể chỉnh sửa để đưa vào hồ sơ đề án.</p><div class="row"><a class="button primary" href="${asset("/guides/thuyet-minh-thuc-hien.docx")}" download>Tải thuyết minh Word ↓</a><a class="button" href="${asset("/guides/thuyet-minh-thuc-hien.pdf")}" download>Tải thuyết minh PDF ↓</a></div><h3>Biểu mẫu hỗ trợ triển khai</h3><p>Các mẫu để trống cần đơn vị điều chỉnh và xác nhận theo thẩm quyền.</p><div class="row">${[
        ["phoi-hop.md", "Phiếu phối hợp"],
        ["ban-giao.md", "Biên bản bàn giao"],
        ["nghiem-thu.md", "Đối chiếu nghiệm thu"],
        ["kiem-tra-ky-thuat.csv", "Kiểm tra kỹ thuật"],
        ["phieu-khao-sat.csv", "Phiếu khảo sát"],
        ["phan-cong.csv", "Phân công lực lượng"],
      ]
        .map(
          ([file, title]) =>
            `<a class="button" href="${asset(`/templates/${file}`)}" download>${title} ↓</a>`,
        )
        .join(
          "",
        )}</div><h3>Phân quyền và trách nhiệm</h3><p><b>Người nhập:</b> tạo và sửa dữ liệu của mình, gửi kiểm tra. <b>Chuyên gia:</b> kiểm chứng và ghi nhận kết quả. <b>Quản trị:</b> quản lý tài khoản, dữ liệu và sao lưu. Người tạo hồ sơ, sản phẩm hoặc minh chứng không được tự xác nhận.</p><h3>Lưu ý khi báo cáo</h3><p>Không dùng dữ liệu giả làm minh chứng. Điểm khảo sát và lượt xem chỉ phản ánh dữ liệu ghi nhận, không chứng minh tác động cộng đồng. Trạng thái “đủ dữ liệu” trên bảng chỉ tiêu không thay thế nghiệm thu của đơn vị có thẩm quyền.</p></section>`,
    );
    bindNav();
  }
  async function settings() {
    if (isDemo) {
      shell(
        `<section class="panel"><h3>Dữ liệu demo trên thiết bị này</h3><p>Dữ liệu lưu trong trình duyệt, không chia sẻ giữa các thiết bị và có thể mất khi xóa dữ liệu website. Không nhập mật khẩu hoặc thông tin cá nhân thật.</p><button id="export-demo">Xuất dữ liệu demo JSON</button>${getUser().role === "admin" ? '<label>Nhập bản xuất demo<input type="file" id="import-demo" accept="application/json,.json"></label><button id="reset-demo">Khôi phục dữ liệu minh họa</button>' : ""}<p id="demo-import-status" role="status"></p></section>`,
      );
      bind("export-demo", async () =>
        download(
          "heritagekit-demo.json",
          JSON.stringify(await api("/backup"), null, 2),
        ),
      );
      document.querySelector("#import-demo")?.addEventListener(
        "change",
        run(async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          if (file.size > 64 * 1024 * 1024)
            throw Error("Bản nhập tối đa 64 MB");
          if (
            !confirm(
              "Thay dữ liệu demo hiện tại bằng bản nhập? Hãy xuất bản sao trước.",
            )
          )
            return;
          const state = JSON.parse(await file.text());
          await api("/demo/import", "POST", state);
          document.querySelector("#demo-import-status").textContent =
            "Đã nhập dữ liệu demo";
          notice("Đã phục hồi bản xuất trên thiết bị này");
        }),
      );
      bind("reset-demo", async () => {
        if (
          !confirm(
            "Khôi phục dữ liệu mẫu? Dữ liệu demo bạn nhập sẽ bị thay thế.",
          )
        )
          return;
        await api("/demo/reset", "POST", {});
        notice("Đã khôi phục dữ liệu mẫu");
        await show("overview");
      });
      return;
    }

    shell(
      `<section class="panel"><h3>Đổi mật khẩu</h3><form id="password-form"><label>Mật khẩu hiện tại<input name="current" type="password" required autocomplete="current-password"></label><label>Mật khẩu mới (ít nhất 12 ký tự)<input name="password" type="password" minlength="12" required autocomplete="new-password"></label><button class="primary">Đổi mật khẩu</button></form></section><section class="panel"><h3>Sao lưu & vận hành</h3><p>Xuất JSON cho hồ sơ, sản phẩm, công việc, phản hồi và nhật ký. Bản xuất này không chứa nội dung tệp đã tải hoặc mật khẩu.</p>${getUser().role === "admin" ? '<button id="backup-data">Xuất dữ liệu JSON</button><button id="audit-log">Xem nhật ký thay đổi</button>' : ""}<p>Để sao lưu đầy đủ cơ sở dữ liệu và tệp đính kèm, người vận hành chạy <code>npm run backup</code>. Hướng dẫn phục hồi và bàn giao nằm trong <code>docs/operations.md</code>.</p><div id="audit-output"></div></section>`,
    );
    document.querySelector("#password-form").onsubmit = run(async (e) => {
      e.preventDefault();
      await api(
        "/password",
        "POST",
        Object.fromEntries(new FormData(e.target)),
      );
      e.target.reset();
      notice("Đã đổi mật khẩu và kết thúc các phiên khác");
    });
    bind("backup-data", async () =>
      download(
        "heritagekit-data.json",
        JSON.stringify(await api("/backup"), null, 2),
      ),
    );
    bind("audit-log", async () => {
      const records = await api("/audit");
      document.querySelector("#audit-output").innerHTML =
        '<div class="table-scroll"><table><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Mã liên kết</th></tr>' +
        records
          .map(
            (a) =>
              `<tr><td>${esc(a.created_at)}</td><td>${esc(a.name)}</td><td>${esc(a.action)}</td><td>${esc(a.heritage_id)}</td></tr>`,
          )
          .join("") +
        "</table></div>";
    });
  }
  return { show, nav, bindNav, upload };
}

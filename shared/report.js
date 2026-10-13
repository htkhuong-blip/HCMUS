export function buildReport({
  heritage,
  products,
  evidence,
  tasks,
  logs,
  trials,
  budget,
  feedback,
}) {
  const published = heritage.filter(
    (h) =>
      h.status === "published" &&
      h.reviewer &&
      h.source &&
      h.author &&
      h.rights,
  );
  const activeProducts = products.filter(
    (p) =>
      p.status === "published" && published.some((h) => h.id === p.heritage_id),
  );
  const approved = evidence.filter((e) => e.status === "approved");
  const cooperation = published.filter((h) =>
    approved.some(
      (e) => e.kind_code === "cooperation" && e.heritage_id === h.id,
    ),
  ).length;
  const completeTrials = trials.filter(
    (t) => t.status === "completed" && t.summary && t.participants.length,
  );
  const survey = completeTrials.flatMap((t) => t.participants);
  const indicators = [
    {
      id: "toolkit",
      label: "01 bộ công cụ web và hướng dẫn vận hành",
      target: 1,
      current: 1,
      met: true,
      note: "Phần mềm đang hoạt động; biên bản kiểm tra và nghiệm thu vẫn cần đơn vị xác nhận.",
    },
    {
      id: "guide",
      label: "01 quy trình dữ liệu thống nhất",
      target: 1,
      current: 1,
      met: true,
      note: "Hướng dẫn trong ứng dụng và docs/data-workflow.md.",
    },
    {
      id: "heritage",
      label: "Ít nhất 03 hồ sơ được kiểm chứng và có phối hợp",
      target: 3,
      current: Math.min(published.length, cooperation),
      met: cooperation >= 3,
      note: `${published.length} hồ sơ công bố; ${cooperation} hồ sơ có minh chứng phối hợp được kiểm tra.`,
    },
    {
      id: "products",
      label: "Ít nhất 05 sản phẩm số không tính trùng",
      target: 5,
      current: activeProducts.length,
      met: activeProducts.length >= 5,
      note: "Sản phẩm đã duyệt, đường dẫn không trùng và di sản liên kết đang công bố.",
    },
    {
      id: "handover",
      label: "Ít nhất 01 đơn vị tiếp nhận/xác nhận sử dụng",
      target: 1,
      current: approved.filter((e) => e.kind_code === "handover").length,
      met: approved.some((e) => e.kind_code === "handover"),
      note: "Dựa trên minh chứng bàn giao được người khác kiểm tra; không thay thế văn bản gốc.",
    },
    {
      id: "trials",
      label: "Có thử nghiệm, khảo sát và báo cáo kết quả",
      target: 1,
      current: completeTrials.length,
      met: completeTrials.length > 0,
      note: `${survey.length} phiếu khảo sát trong các đợt hoàn tất.`,
    },
    {
      id: "worklogs",
      label: "Có danh sách lực lượng, phân công và ngày công",
      target: 1,
      current: logs.length,
      met: logs.length > 0 && tasks.length > 0,
      note: "Ngày công quy đổi = tổng giờ / 8; không phải xác nhận hành chính.",
    },
  ];
  const mean = (k) =>
    survey.length
      ? Number(
          (survey.reduce((n, p) => n + p[k], 0) / survey.length).toFixed(2),
        )
      : null;
  return {
    generated_at: new Date().toISOString(),
    deadline: "2027-05-30",
    indicators,
    summary: {
      estimated_budget: budget
        .filter((b) => b.classification === "estimate")
        .reduce((sum, b) => sum + b.quantity * b.unit_cost, 0),
      spent_budget: budget
        .filter((b) => b.classification === "spent")
        .reduce((sum, b) => sum + b.quantity * b.unit_cost, 0),
      heritage: heritage.length,
      published: published.length,
      products: activeProducts.length,
      tasks: tasks.length,
      completed_tasks: tasks.filter((t) => t.progress === 100).length,
      hours: logs.reduce((n, l) => n + l.hours, 0),
      workdays: Number((logs.reduce((n, l) => n + l.hours, 0) / 8).toFixed(2)),
      members: new Set(logs.map((l) => `${l.member}|${l.unit}`)).size,
      units: new Set(logs.map((l) => l.unit)).size,
      survey_responses: survey.length,
      clarity: mean("clarity"),
      usability: mean("usability"),
      usefulness: mean("usefulness"),
    },
    heritage: heritage.map((h) => ({
      id: h.id,
      title: h.title,
      status: h.status,
      reviewer: h.reviewer,
      source: h.source,
    })),
    products,
    tasks,
    worklogs: logs,
    evidence,
    trials,
    budget,
    feedback,
    disclaimer:
      "Báo cáo hỗ trợ theo dõi dữ liệu đã nhập, không tự xác nhận nghiệm thu, tính xác thực văn bản hoặc hoàn thành đề án.",
  };
}

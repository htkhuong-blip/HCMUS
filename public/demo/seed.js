export const accounts = [
  { id: 1, name: "Quản trị demo", email: "admin@demo.local", role: "admin" },
  {
    id: 2,
    name: "Người nhập demo",
    email: "editor@demo.local",
    role: "editor",
  },
  {
    id: 3,
    name: "Chuyên gia demo",
    email: "reviewer@demo.local",
    role: "reviewer",
  },
];
export function seedState() {
  const sites = [
    [
      "Không gian ký ức A",
      "Di tích lịch sử",
      "Địa điểm minh họa A",
      10.78,
      106.69,
    ],
    [
      "Nghề thủ công B",
      "Di sản phi vật thể",
      "Địa điểm minh họa B",
      10.83,
      106.65,
    ],
    ["Nhà văn hóa C", "Địa chỉ văn hóa", "Địa điểm minh họa C", 10.73, 106.72],
  ];
  const heritage = sites.map(([title, category, location, lat, lng], i) => ({
    id: i + 1,
    title,
    category,
    location,
    lat,
    lng,
    summary:
      "Hồ sơ minh họa để khám phá và thử bộ công cụ. Không phải tư liệu lịch sử đã xác minh.",
    content:
      "Đây là địa điểm giả định dùng để trình diễn quy trình số hóa, quản lý nguồn, kiểm chứng và lan tỏa di sản.\n\nBạn có thể sửa hồ sơ này, tạo hồ sơ mới, bổ sung ảnh, dấu mốc, gửi kiểm chứng và chọn vai trò chuyên gia để thử duyệt. Tất cả thay đổi chỉ lưu trong trình duyệt của bạn.",
    source: "Dữ liệu mô phỏng do HeritageKit tạo",
    author: "Nhóm demo",
    rights: "Chỉ dùng trình diễn; không làm minh chứng nghiệm thu",
    media: [
      {
        type: "image",
        url: `./demo/images/site-${i + 1}.svg`,
        title: "Minh họa đồ họa",
        source: "Hình vẽ demo HeritageKit",
        rights: "Cho phép dùng trong demo",
      },
    ],
    timeline: [
      { year: "2026", text: "Mốc minh họa: lập hồ sơ số" },
      { year: "2027", text: "Mốc minh họa: dùng thử và bàn giao" },
    ],
    status: "published",
    created_by: 2,
    reviewer: "Chuyên gia mô phỏng",
    review_note: "Trạng thái minh họa, không phải kiểm chứng chuyên môn",
    updated_at: new Date().toISOString(),
    views: 0,
  }));
  const products = [
    {
      title: "Trang giới thiệu mẫu A",
      type: "Trang giới thiệu",
      heritage_id: 1,
      url: "./#heritage/1",
    },
    {
      title: "Trang giới thiệu mẫu B",
      type: "Trang giới thiệu",
      heritage_id: 2,
      url: "./#heritage/2",
    },
    {
      title: "Trang giới thiệu mẫu C",
      type: "Trang giới thiệu",
      heritage_id: 3,
      url: "./#heritage/3",
    },
    {
      title: "Hướng dẫn khám phá di sản",
      type: "Tài liệu giáo dục",
      heritage_id: 1,
      url: "./guides/thuyet-minh-thuc-hien.pdf",
    },
    {
      title: "Bộ ảnh minh họa mẫu",
      type: "Bộ ảnh số",
      heritage_id: 2,
      url: "./demo/images/site-2.svg",
    },
  ].map((p, i) => ({
    ...p,
    id: 10 + i,
    description:
      "Sản phẩm mẫu để thao tác thử, không tính là sản phẩm hoàn thành đề án.",
    source: "Dữ liệu demo",
    rights: "Chỉ dùng minh họa",
    status: "published",
    created_by: 2,
    reviewer: "Chuyên gia mô phỏng",
    reviewer_id: 3,
    review_note: "Dữ liệu mô phỏng",
    updated_at: new Date().toISOString(),
  }));
  return {
    format: "heritagekit-browser-demo",
    version: 1,
    nextId: 100,
    heritage,
    products,
    tasks: [
      {
        id: 20,
        title: "Khảo sát và chọn di sản (mẫu)",
        unit: "Nhóm demo",
        assignee_id: 2,
        stage: "Khảo sát",
        due: "2026-11-30",
        description: "Xác định đầu mối và tư liệu được phép sử dụng.",
        progress: 25,
        status: "active",
        created_by: 1,
        creator: "Quản trị demo",
      },
    ],
    worklogs: [],
    evidence: [],
    trials: [],
    budget: [],
    feedback: [],
    audit: [],
    files: [],
  };
}

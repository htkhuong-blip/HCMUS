# HCMUS HeritageKit 0.2

## Bản demo miễn phí GitHub Pages

Có sẵn bản demo chạy hoàn toàn trong trình duyệt, có dữ liệu minh họa và vai trò mô phỏng, không cần Render hay máy chủ. Dữ liệu riêng từng trình duyệt lưu bằng IndexedDB, có xuất/nhập JSON. Xem [cách bật và sử dụng GitHub Pages](docs/demo-pages.md).

Dựng bằng `npm run build:pages`, kiểm tra `npm run test:pages`. Cấu hình xuất bản: `.github/workflows/pages.yml`. Chủ repository cần bật **Settings → Pages → Source: GitHub Actions** một lần. Bản demo không có tài khoản/phân quyền bảo mật hoặc lưu trữ dùng chung thật.

Bộ công cụ web tiếng Việt hỗ trợ đề án CTTN 2026–2027: số hóa, lưu trữ và lan tỏa giá trị di sản văn hóa. Bản này có các công cụ để triển khai, quản lý minh chứng và mô tả cách thực hiện; chưa tự cung cấp dữ liệu di sản hoặc xác nhận đạt chỉ tiêu đề án.

## Khởi động

Cần Node.js **24 trở lên** (SQLite tích hợp). Từ checkout hiện có:

```sh
cd /workspace/HCMUS
npm ci --cache /workspace/.npm-cache
npm test
npm start
```

Mặc định `127.0.0.1:3000`. `PORT`, `HOST`, `DB_PATH`, `UPLOAD_DIR`, `BACKUP_DIR` tùy chọn. Cấu hình `PUBLIC_URL=https://ten-mien-cua-don-vi` khi triển khai để QR và kiểm tra nguồn yêu cầu sử dụng đúng địa chỉ công khai. Không cấu hình tin cậy tùy tiện cho header proxy.

Lần chạy đầu tạo `admin@heritagekit.local` với mật khẩu ngẫu nhiên in trong terminal riêng tư. Có thể đặt `ADMIN_EMAIL` và `ADMIN_PASSWORD` trước lần đầu; thay đổi biến sau đó không đặt lại mật khẩu. Không lưu mật khẩu trong Git hoặc chat. Quản trị tạo tài khoản người nhập/chuyên gia tại **Không gian quản lý → Thêm tài khoản**. Đổi mật khẩu trong **Bộ công cụ → Tài khoản & vận hành**.

## Bộ công cụ

| Công cụ | Thao tác | Đầu ra |
|---|---|---|
| Hồ sơ di sản | Nhập dữ liệu, nguồn, quyền, tọa độ, dấu mốc; gửi chuyên gia duyệt | Hồ sơ số được kiểm chứng trước công bố |
| Kho tư liệu | Tải JPG/PNG/GIF/WebP, PDF, MP3/WAV, MP4 tối đa 10 MB/tệp hoặc gắn HTTPS | Tư liệu có nguồn và quyền riêng |
| Khám phá | Tìm kiếm, lọc, trang giới thiệu, dòng thời gian, sơ đồ địa lý, QR tải SVG | Trang/QR chia sẻ cho công chúng |
| Sản phẩm số | Đăng ký, gắn di sản, kiểm tra độc lập; chặn URL/tệp trùng | Danh mục sản phẩm và catalog công khai |
| Phân công | Nhiệm vụ, giai đoạn, đơn vị, người phụ trách, hạn, tiến độ | Bảng phân công CSV |
| Nhật ký & ngày công | Người, đơn vị, ngày, giờ, kết quả; tổng cùng ngày không quá 24 giờ | Tổng giờ, ngày công quy đổi /8, CSV |
| Kinh phí & nguồn lực | Ghi dự toán/thực chi, số lượng, đơn giá VND, nguồn và chứng từ | Bảng kê CSV, tổng hợp tách dự toán và thực chi |
| Minh chứng | Phối hợp, quyền, kiểm chứng, thử nghiệm, bàn giao…; gửi kiểm tra | Danh mục tài liệu có trạng thái xác nhận |
| Thử nghiệm người dùng | Đợt thử, phiếu dễ hiểu/dễ dùng/hữu ích 1–5, nhận xét, tổng hợp | Báo cáo và điểm trung bình khảo sát |
| Báo cáo & nghiệm thu | Đối chiếu 7 chỉ tiêu, danh mục, nguồn lực, minh chứng | JSON, CSV, bản in/lưu PDF |
| Hướng dẫn | Quy trình 5 bước, thuyết minh Word/PDF và 6 biểu mẫu | Tài liệu hỗ trợ mô tả và triển khai |
| Vận hành | Đổi mật khẩu, nhật ký thay đổi, xuất JSON, snapshot đầy đủ | Dữ liệu bàn giao và phục hồi |

Người nhập chỉ sửa dữ liệu của mình; quản trị có thể sửa chung. Chuyên gia kiểm chứng không nhập/sửa dữ liệu. Người tạo không tự duyệt hồ sơ/sản phẩm/minh chứng. Sửa dữ liệu đã duyệt sẽ thu hồi kết quả duyệt; sản phẩm công khai phụ thuộc hồ sơ liên kết đang công bố. Minh chứng, khảo sát và ngày công không công khai.

Bảng chỉ tiêu là công cụ theo dõi dữ liệu. Chỉ tiêu hồ sơ có kiểm chứng và phối hợp yêu cầu hồ sơ công bố cùng minh chứng phối hợp được người khác kiểm tra. Chỉ tiêu sản phẩm đếm sản phẩm duyệt gắn hồ sơ đang công bố. Kết quả không thay thế xác nhận chuyên môn hay nghiệm thu. Chống trùng URL/checksum không đủ phát hiện mọi nội dung trùng ở các nguồn khác nhau.

## Kiểm thử

```sh
npm test
npm run test:ui
```

Kiểm thử trình duyệt cần Chromium tại `/usr/bin/chromium`, hoặc đặt `CHROMIUM_PATH`. Dữ liệu tạm được xóa sau kiểm thử; ảnh chụp vào `playwright-artifacts/` (được Git bỏ qua). Kiểm thử này không tạo hồ sơ di sản thật trong môi trường vận hành.

## Sao lưu

```sh
npm run backup
# Dừng máy chủ trước khi phục hồi:
npm run restore -- /duong/dan/thu-muc-snapshot --confirm
```

Snapshot đầy đủ chứa database, tài khoản, tệp và manifest checksum. Xuất JSON trong ứng dụng chỉ phục vụ tra cứu/chuyển giao, không chứa byte tệp hoặc mật khẩu. Phục hồi tạo snapshot an toàn dữ liệu cũ trước khi thay thế. Xem [vận hành](docs/operations.md).

## Tài liệu để sử dụng trong đề án

- [Thuyết minh cách thực hiện](docs/thuyet-minh-thuc-hien.md), [Word](docs/thuyet-minh-thuc-hien.docx), [PDF](docs/thuyet-minh-thuc-hien.pdf).
- [Quy trình dữ liệu](docs/data-workflow.md), [vận hành/bàn giao](docs/operations.md).
- [Biểu mẫu tham khảo](docs/templates): phối hợp, phân công, kỹ thuật, khảo sát, nghiệm thu, bàn giao.

## Giới hạn cần xử lý trước triển khai rộng

Chưa có tên miền/HTTPS được triển khai, lưu trữ đám mây, hạn mức tổng dung lượng, quét mã độc, MFA, email khôi phục mật khẩu hoặc giám sát tập trung. Mật khẩu scrypt, phiên HttpOnly/SameSite, kiểm tra Origin, giới hạn đăng nhập/phản hồi và kiểm tra định dạng tệp đã có, nhưng không thay thế kiểm tra an toàn khi dùng thật. Phiên đăng nhập tồn tại 8 giờ và mất khi khởi động lại. Bảo vệ log đầu tiên vì có mật khẩu khởi tạo. Có thể phục hồi tài khoản từ snapshot; hiện không có UI đặt lại mật khẩu cho người quên.

Sơ đồ địa lý ngoại tuyến dùng dữ liệu Natural Earth; lớp đường phố dùng `tile.openstreetmap.org` khi được phép kết nối. Dữ liệu sơ đồ ở tỷ lệ nhỏ không thể thay thế bản đồ đường phố. Lượt xem đếm lượt mở hồ sơ, không phải số người duy nhất. Cần bổ sung 03 hồ sơ thật, 05 sản phẩm thật, dùng thử người dùng thật và văn bản phối hợp/tiếp nhận để hoàn thành đề án.

Tài liệu Word/PDF đã được tạo sẵn. Nếu sửa thuyết minh Markdown và cần tạo lại: `python3 -m pip install -r docs/requirements.txt` trong môi trường Python phù hợp, rồi `python3 scripts/build-guide.py` (cần phông DejaVu Sans). Các thư viện này chỉ phục vụ tạo tài liệu, không cần để chạy website.

## Đưa website lên Internet

Có sẵn `Dockerfile`, `render.yaml` và health check `/api/health`. Xem [hướng dẫn Render/VPS](docs/deployment.md). Cấu hình Render hiện dùng Free, không có ổ đĩa trả phí; phù hợp xem thử vì database và tệp có thể mất khi máy chủ được tạo lại. Giữ dữ liệu thật lâu dài cần kho bền vững riêng. Chưa có website công khai chỉ vì đã tạo các tệp cấu hình.

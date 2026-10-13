# Demo HeritageKit miễn phí trên GitHub Pages

Bản này chạy hoàn toàn trong trình duyệt: không có Node server, database dùng chung, đăng nhập/mật khẩu hoặc phân quyền bảo mật thật. Vai trò Quản trị/Người nhập/Chuyên gia chỉ mô phỏng thao tác. Không nhập thông tin cá nhân, mật khẩu hoặc tư liệu cần bảo mật.

## Cách xem

Sau khi GitHub Pages xuất bản thành công, trang dự kiến là `https://htkhuong-blip.github.io/HCMUS/`. Địa chỉ này chưa được coi là hoạt động nếu chưa kiểm tra deployment. GitHub Pages miễn phí cho repository công khai; repository hiện đã được kiểm tra là công khai. Không sử dụng Render, ổ đĩa trả phí hay bí mật API cho bản demo.

Lần đầu có 03 địa điểm giả định và 05 sản phẩm minh họa. Chúng không phải hồ sơ kiểm chứng hoặc sản phẩm nghiệm thu thật. Mọi màn hình có nhãn DEMO.

## Thao tác thử

1. Khám phá hồ sơ, tư liệu minh họa, dòng thời gian, bản đồ, sản phẩm và QR.
2. Chọn vai trò Người nhập để tạo hồ sơ, bổ sung nguồn/quyền, tải tư liệu và gửi kiểm chứng.
3. Chọn Chuyên gia để thử duyệt; vai trò tạo không tự duyệt trong luồng mô phỏng.
4. Chọn Quản trị để quản lý phân công, nhật ký/ngày công, kinh phí, minh chứng, khảo sát và báo cáo.
5. Mở Tài khoản & vận hành để xuất dữ liệu JSON, nhập bản xuất hoặc khôi phục dữ liệu mẫu. Xuất trước khi thay thế dữ liệu.

Dữ liệu/tệp lưu bằng IndexedDB trong cùng trình duyệt và cùng địa chỉ website. Tải lại trang vẫn giữ dữ liệu; xóa dữ liệu website, đổi thiết bị/trình duyệt hoặc dùng chế độ riêng tư có thể mất dữ liệu. Xuất JSON demo bao gồm tệp base64 để chuyển sang thiết bị khác; nhập tối đa 64 MB. Hệ thống dùng chung thật cần backend/kho dữ liệu riêng.

QR/liên kết mẫu mở hồ sơ mẫu có sẵn. Với hồ sơ bạn tự tạo, QR mở trang demo chung; dữ liệu cục bộ không tự đi kèm URL. Xuất và nhập JSON trên thiết bị nhận nếu cần trình diễn đúng dữ liệu tùy chỉnh.

## Bật Pages một lần

Tại repository: **Settings → Pages → Build and deployment → Source → GitHub Actions**. Cần người có quyền quản trị repository thực hiện. Không cần tạo token hoặc cung cấp mật khẩu trong chat.

Sau đó mở **Actions → Publish HeritageKit browser demo → Run workflow**, chọn nhánh `deploy/heritagekit`. Workflow cài dependency bằng lockfile, chạy kiểm thử backend, dựng `dist/`, tải artifact và xuất bản Pages. Các commit tiếp theo ở nhánh này tự chạy workflow.

Workflow dùng GITHUB_TOKEN chỉ để xuất bản Pages đã được bật. Theo tài liệu chính thức của actions/configure-pages, tự bật Pages yêu cầu token khác hoặc quyền quản trị bổ sung; vì vậy không yêu cầu người dùng tạo token cho demo. Bật bằng Settings là cách đơn giản nhất.

## Kiểm tra local và cập nhật code

```sh
npm ci --cache /workspace/.npm-cache
npm run build:pages
npm run test:pages
npm run preview:pages
```

Preview mô phỏng chính xác đường dẫn con `/HCMUS/` trên cổng 4173. `dist/` là đầu ra sinh tự động, được Git bỏ qua; không đưa cơ sở dữ liệu hoặc tài khoản backend vào artifact. QR được dựng trực tiếp trong trình duyệt. Tài liệu và thư viện được đóng gói nội bộ, không cần gọi API ngoài để thử phần lõi.

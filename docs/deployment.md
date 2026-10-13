# Triển khai website HeritageKit

Ứng dụng có SQLite và tệp tải lên nên cần **lưu trữ bền vững**. Không dùng gói chỉ có filesystem tạm để lưu dữ liệu thật. Render Blueprint đi kèm chọn dịch vụ và ổ đĩa có phí; cần chủ tài khoản xem giá hiện tại và thiết lập thanh toán trước khi tạo tài nguyên. Chưa có dịch vụ/chi phí nào được tạo bởi các tệp cấu hình.

## Render (HTTPS do nền tảng cấp)

1. Mã nguồn và `render.yaml` đã ở nhánh `deploy/heritagekit` của `htkhuong-blip/HCMUS`: https://github.com/htkhuong-blip/HCMUS/tree/deploy/heritagekit. Chọn đúng nhánh này khi tạo Blueprint.
2. Đăng nhập Render bằng tài khoản của bạn, kết nối repository; chọn **New → Blueprint**, chọn repository và nhánh chứa cấu hình.
3. Xem `render.yaml`: 1 dịch vụ Docker, 1 ổ đĩa bền vững tại `/var/lib/heritage`, không triển khai tự động khi có commit mới. Xem lại giá/gói và vùng máy chủ.
4. Điền `ADMIN_PASSWORD` trong biểu mẫu môi trường **bảo mật** của Render (ít nhất 12 ký tự); không gửi mật khẩu trong chat. Biến chỉ dùng lần đầu tạo database. ADMIN_EMAIL mặc định `admin@heritagekit.local`, có thể đổi trước lần đầu.
5. Tạo Blueprint và chờ health check `/api/health` đạt. Mở URL HTTPS do Render cung cấp. Ứng dụng dùng `RENDER_EXTERNAL_URL` để tạo QR và kiểm tra Origin. Nếu dùng tên miền riêng, đặt `PUBLIC_URL=https://ten-mien-cua-ban` rồi khởi động lại dịch vụ.
6. Đăng nhập, tạo tài khoản người nhập và chuyên gia, thử hồ sơ nháp → kiểm chứng → công bố, tải tư liệu và quét QR trên điện thoại. Xác minh tệp/database còn sau khi khởi động lại dịch vụ.
7. Đặt lịch sao lưu và lưu bản hoàn tất ở vị trí ngoài ổ đĩa dịch vụ. Snapshot cùng máy không bảo vệ khi xóa dịch vụ/ổ đĩa.

Blueprint không chuyển dữ liệu từ máy phát triển. Tạo database mới hoặc phục hồi snapshot đầy đủ qua terminal quản trị khi dịch vụ đã dừng và vị trí lưu được cấp đúng quyền. Không đưa database/log khởi tạo/mật khẩu lên GitHub.

## VPS bằng Docker

Có thể dùng cùng Dockerfile; cần Docker, máy chủ, tên miền và reverse proxy HTTPS do người vận hành quản lý.

```sh
docker build -t hcmus-heritagekit:0.2 .
# Điền biến vào tệp môi trường ngoài repository, chmod 600.
# ADMIN_PASSWORD phải được đặt trước lần đầu; PUBLIC_URL là origin HTTPS thực tế.
docker run -d --name heritagekit --restart unless-stopped \
  --env-file /duong/dan/heritagekit.env \
  -p 127.0.0.1:3000:3000 \
  -v heritage-data:/var/lib/heritage \
  hcmus-heritagekit:0.2
```

Reverse proxy HTTPS chuyển tiếp đến `127.0.0.1:3000`; giới hạn request ít nhất 15 MB để hỗ trợ tệp 10 MB dạng base64. Không mở trực tiếp HTTP 3000 ra Internet. Một replica duy nhất sử dụng SQLite; không dùng nhiều máy chủ cùng database. Cấu hình dung lượng, giám sát, riêng tư và tài khoản theo phạm vi sử dụng.

## Kiểm tra sau triển khai

- URL HTTPS trang chủ, tài liệu và API health trả thành công.
- Đăng nhập bằng thông tin người vận hành đã đặt, không công khai mật khẩu.
- Hồ sơ nháp và tệp riêng không xem được khi đăng xuất.
- Chuyên gia khác duyệt; nội dung công bố xem được trên điện thoại.
- QR trỏ đúng tên miền công khai; tệp vẫn còn sau restart.
- Tạo snapshot và thử phục hồi ở môi trường riêng trước bàn giao.

Bản Docker đã được kiểm tra tại môi trường phát triển: health check, đăng nhập, tạo hồ sơ, tải PDF, khởi động lại, giữ database/tệp và tạo snapshot. Đây chưa phải xác minh một dịch vụ Render đã được tạo hoặc chạy trên Internet.

# Triển khai website HeritageKit

## Bản xem thử miễn phí trên Render

`render.yaml` hiện dùng **plan: free**, không tạo ổ đĩa trả phí. Cấu hình này để xem thử và thử chức năng. SQLite và tệp đính kèm nằm trên filesystem tạm: dữ liệu có thể mất khi Render tạo lại máy chủ hoặc triển khai lại. Không dùng bản này để giữ hồ sơ thật lâu dài. Dịch vụ miễn phí có thể ngủ khi không dùng và mất thời gian khởi động lại; các hạn mức phụ thuộc chính sách hiện hành của Render.

Không cần sử dụng Blueprint để tạo một Web Service miễn phí:

1. Đăng ký/đăng nhập Render, chọn **New → Web Service** và kết nối GitHub.
2. Chọn repository `htkhuong-blip/HCMUS`, nhánh `deploy/heritagekit`, runtime **Docker**.
3. Chọn instance **Free**. Không thêm Disk hoặc dịch vụ trả phí.
4. Thêm `ADMIN_PASSWORD` (ít nhất 12 ký tự) trong mục Environment của Render, không gửi mật khẩu trong chat. Email quản trị mặc định `admin@heritagekit.local`.
5. Đặt health check `/api/health`, tạo dịch vụ và chờ triển khai. Mở URL HTTPS được Render cấp. Ứng dụng sử dụng `RENDER_EXTERNAL_URL` để tạo QR.
6. Dùng dữ liệu thử; xuất dữ liệu/tải tư liệu về máy khi cần. Snapshot đặt cùng filesystem tạm cũng có thể mất.

Nếu dùng Blueprint, chọn đúng nhánh chứa `render.yaml`, xác minh instance **Free** và không có Disk trước khi tạo. Cấu hình không triển khai tự động khi có commit mới.

## Miễn phí và giữ dữ liệu lâu dài

Cần chuyển cơ sở dữ liệu và tệp ra kho bền vững, ví dụ Supabase Free cho PostgreSQL và Storage, kết hợp Render Free chạy ứng dụng. Đây cần thay đổi backend SQLite và cơ chế lưu tệp; bản hiện tại **chưa hỗ trợ kết nối Supabase**. Không chỉ điền URL Supabase vào cấu hình là dữ liệu sẽ được lưu ở đó. Các gói miễn phí có hạn mức và có thể tạm dừng khi ít hoạt động; phải theo dõi hạn mức và sao lưu riêng.

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

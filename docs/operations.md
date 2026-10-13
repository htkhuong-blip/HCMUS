# Vận hành và bàn giao HeritageKit 0.2

## Khởi động

Dùng checkout hiện có; không tạo Git worktree. Cần Node.js >=24. Chạy `npm ci --cache /workspace/.npm-cache`, `npm test`, rồi `npm start` từ repository. Kiểm tra GET `/` có HTML, `/api/heritage` có JSON, `/toolkit.js` và `/vendor/leaflet.js` truy cập được. Ứng dụng mới chưa có hồ sơ công bố sẽ trả danh sách rỗng; không thêm dữ liệu giả để xác nhận chỉ tiêu.

Máy chủ mặc định chỉ lắng nghe loopback. Trước khi công khai, dùng reverse proxy HTTPS được quản lý, cấu hình `PUBLIC_URL` bằng origin công khai, giữ `HOST=127.0.0.1` khi proxy cùng máy. Không tin tùy tiện các header Forwarded/X-Forwarded. QR phải trỏ đến địa chỉ người dùng thật truy cập được; QR localhost chỉ phục vụ thử nghiệm.

Bản đồ ngoại tuyến không cần mạng. Muốn xem lớp đường phố cần cho phép HTTPS `tile.openstreetmap.org` và tuân thủ chính sách sử dụng dịch vụ. Liên kết tư liệu HTTPS phụ thuộc quyền và khả năng truy cập kho bên ngoài.

## Tài khoản

Lần đầu tài khoản admin và mật khẩu ngẫu nhiên được tạo. Xem mật khẩu qua terminal riêng tư hoặc log chỉ người vận hành đọc được; không gửi log trong chat. Nếu khởi động nền, dùng `umask 077` trước khi chuyển hướng log. Chỉ cấu hình ADMIN_EMAIL/ADMIN_PASSWORD trước lần chạy đầu. Tạo tài khoản riêng cho người nhập và chuyên gia; đổi mật khẩu sau bàn giao.

Phiên tồn tại trong bộ nhớ 8 giờ và mất khi máy chủ khởi động lại. Đổi mật khẩu chấm dứt các phiên khác của tài khoản. Giới hạn đăng nhập là 20 yêu cầu/IP trong 15 phút và phản hồi là 30/IP/giờ; nhiều người cùng IP có thể ảnh hưởng nhau. Đặt giới hạn và cơ chế quản trị tài khoản phù hợp khi mở rộng.

Tệp PID cạnh database giúp ngăn hai máy chủ dùng cùng dữ liệu và chặn phục hồi khi máy chủ đang hoạt động. Không xóa PID của tiến trình đang chạy. Dùng SIGTERM/SIGINT để dừng tiến trình do mình khởi chạy.

## Sao lưu đầy đủ

`npm run backup` dùng SQLite backup API để tạo bản database nhất quán trong khi ứng dụng chạy. Tệp đã tải lên là bất biến; công cụ sao chép danh mục từ database snapshot, kiểm tra SHA-256 và lưu manifest. Thư mục snapshot mặc định là `backups/…`. Có thể chỉ định: `npm run backup -- /duong/dan/moi`; thư mục đích phải chưa tồn tại.

Snapshot gồm `database.sqlite`, `uploads/`, `manifest.json`. Chứa thông tin tài khoản và khảo sát nội bộ nên phải kiểm soát quyền. Sao chép snapshot hoàn tất sang kho được đơn vị cho phép; thư mục cùng máy không bảo vệ khỏi mất máy. Nếu thiếu tệp hoặc checksum sai, công cụ báo lỗi: không coi snapshot thiếu manifest hoàn tất là bản sao lưu hợp lệ.

Xuất JSON trên giao diện gồm hồ sơ, sản phẩm, nhiệm vụ, ngày công, minh chứng, thử nghiệm, phản hồi và nhật ký; không chứa mật khẩu hoặc byte tệp, không dùng để phục hồi đầy đủ. Chưa có UI nhập lại JSON.

## Phục hồi

Dừng máy chủ. Sao lưu và kiểm tra snapshot trên môi trường riêng trước khi phục hồi dữ liệu thật. Chạy `npm run restore -- /duong/dan/snapshot --confirm`. Công cụ kiểm tra integrity database, danh mục tệp và checksum; tạo snapshot dữ liệu hiện tại trước khi thay database; giữ các tệp cũ không được snapshot dùng để tránh mất dữ liệu.

`DB_PATH`, `UPLOAD_DIR`, `BACKUP_DIR` phải đúng ở cả máy chủ và công cụ. Không chạy snapshot không tin cậy: checksum hỗ trợ phát hiện sai khác, không xác minh người tạo bản sao. Sau phục hồi khởi động lại, đăng nhập bằng tài khoản của snapshot, kiểm tra số hồ sơ/sản phẩm, tệp và khảo sát. Bảo vệ bản sao an toàn và lên lịch dọn các tệp/ảnh snapshot theo chính sách lưu giữ.

## Bàn giao

Ghi đơn vị vận hành, người giữ tài khoản, tên miền/HTTPS, nơi lưu database/tệp, quyền tư liệu, lịch sao lưu, vị trí snapshot ngoài máy, kết quả thử phục hồi, đầu mối lỗi và quy trình kiểm chứng lại khi sửa. Bàn giao tài khoản qua kênh an toàn; không ghi mật khẩu vào văn bản công khai.

Xuất báo cáo, bảng ngày công, danh mục sản phẩm/minh chứng; hoàn thiện mẫu bàn giao và nghiệm thu theo thẩm quyền. Trạng thái đủ dữ liệu trên phần mềm không phải công nhận công trình. Trước triển khai rộng bổ sung hạn mức lưu trữ tổng, quét an toàn tệp, khôi phục tài khoản, giám sát, chính sách riêng tư và đánh giá bảo mật.

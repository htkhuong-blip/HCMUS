# HCMUS HERITAGEKIT
## Thuyết minh bộ công cụ và phương thức thực hiện đề án

Công trình thanh niên năm học 2026–2027: Bộ công cụ số hóa, lưu trữ và lan tỏa giá trị di sản văn hóa.

Tài liệu mô tả các chức năng của phiên bản phần mềm 0.2.0 và quy trình đề xuất để triển khai. Không phải báo cáo xác nhận đã có 03 di sản, 05 sản phẩm hay đơn vị tiếp nhận. Khi dùng trong hồ sơ chính thức, nhóm thực hiện cần bổ sung tên đơn vị, di sản, dữ liệu, văn bản và kết quả thực tế.

## 1. Mô hình triển khai

HCMUS HeritageKit được xây dựng dưới dạng ứng dụng web, sử dụng trên máy tính và điện thoại. Bộ công cụ cung cấp một quy trình thống nhất từ khảo sát, thu thập tư liệu, nhập hồ sơ, kiểm chứng chuyên môn đến công bố, dùng thử, theo dõi nguồn lực và tổng hợp hồ sơ bàn giao. Các đơn vị tham gia cùng sử dụng mẫu dữ liệu và quy trình kiểm tra thay vì tạo từng sản phẩm rời rạc cho mỗi địa điểm.

Hệ thống có ba vai trò nội bộ: quản trị viên, người nhập tư liệu và chuyên gia kiểm chứng. Khách truy cập chỉ xem hồ sơ và sản phẩm đã được công bố. Người tạo hồ sơ, sản phẩm hoặc minh chứng không được tự duyệt. Khi nội dung hồ sơ hoặc sản phẩm đã công bố được sửa, bản ghi trở về trạng thái nháp để kiểm chứng lại.

## 2. Bộ công cụ theo bốn nhóm chức năng

### Nhóm 1. Nhập và kiểm tra tư liệu

Công cụ Hồ sơ di sản hỗ trợ nhập tên, loại hình, địa điểm, giới thiệu, nội dung, nguồn, tác giả, quyền sử dụng, tọa độ và dấu mốc. Tư liệu đính kèm gồm hình ảnh, âm thanh, video và PDF, được tải trực tiếp hoặc gắn đường dẫn HTTPS. Mỗi tư liệu có thông tin nguồn và quyền riêng. Tệp tải lên tối đa 10 MB; tệp lớn hơn được lưu trên kho của đơn vị và dẫn bằng URL phù hợp.

Hồ sơ chỉ được gửi kiểm chứng khi có nội dung, nguồn, tác giả và quyền sử dụng. Chuyên gia dùng tài khoản riêng để đối chiếu nguồn, ghi nhận xét và chọn công bố hoặc yêu cầu bổ sung. Sản phẩm số và minh chứng có luồng gửi kiểm tra riêng. Nhật ký hệ thống ghi người thực hiện, thao tác và thời điểm.

Đầu ra: bộ hồ sơ số có nguồn gốc rõ ràng, kết quả kiểm chứng và tư liệu được phép sử dụng. Kết luận trong phần mềm phải dựa trên việc kiểm tra thực tế; không thay thế văn bản xác nhận của đơn vị chuyên môn.

### Nhóm 2. Lưu trữ và tìm kiếm

Dữ liệu được lưu trong cơ sở dữ liệu SQLite; tệp tải lên được lưu trong thư mục riêng trên máy chủ. Có tìm kiếm theo tên, địa điểm và giới thiệu, lọc theo loại hình. Công cụ nội bộ liên kết sản phẩm, minh chứng, nhiệm vụ và ngày công để phục vụ tra cứu.

Tư liệu nháp hoặc chỉ dùng làm minh chứng được giới hạn cho người đăng nhập. Tư liệu được gắn vào hồ sơ hoặc sản phẩm đã công bố mới có thể được khách truy cập xem. Không đưa tư liệu chưa có quyền công bố vào hồ sơ công khai.

Đầu ra: kho tư liệu có tổ chức, khả năng cập nhật và tra cứu; dữ liệu được xuất JSON, các danh mục được xuất CSV. Sao lưu đầy đủ gồm cơ sở dữ liệu, tài khoản và tệp, có checksum để kiểm tra trước khi phục hồi.

### Nhóm 3. Giới thiệu và trải nghiệm

Mỗi hồ sơ đã công bố có trang giới thiệu, nội dung, tư liệu ảnh/âm thanh/video, dòng thời gian, vị trí và liên kết chia sẻ. Sơ đồ địa lý ngoại tuyến cho phép xem vị trí khi không có kết nối đến dịch vụ bản đồ; lớp OpenStreetMap hỗ trợ xem đường phố khi mạng cho phép. Mã QR được tạo tại máy chủ, có thể tải SVG để in và gắn tại điểm trưng bày. Khi bàn giao, phải cấu hình đúng địa chỉ website công khai và kiểm tra lại QR trên thiết bị thật.

Công cụ Sản phẩm số đăng ký từng sản phẩm có giá trị sử dụng độc lập như bộ ảnh, bài thuyết minh âm thanh, video, tài liệu giáo dục hoặc tuyến khám phá. Sản phẩm gắn với một hồ sơ đã công bố, có nguồn, quyền sử dụng và kiểm tra độc lập. Hệ thống từ chối sản phẩm trùng đường dẫn chuẩn hóa hoặc tệp có cùng checksum. Nhóm thực hiện vẫn cần đối chiếu nội dung để tránh tính trùng sản phẩm khi dùng nhiều đường dẫn khác nhau.

Đầu ra: trang giới thiệu có thể chia sẻ, mã QR, danh mục sản phẩm số đã được kiểm tra. Cần tối thiểu 05 sản phẩm thật, không chỉ đăng ký 05 tên hoặc đường dẫn chưa có nội dung.

### Nhóm 4. Quản lý và đánh giá

Không gian quản lý gồm bảng tổng quan, phân công công việc theo 5 giai đoạn, người phụ trách, đơn vị, hạn hoàn thành và tiến độ. Nhật ký ghi người thực hiện, ngày, nhiệm vụ, kết quả và số giờ; ngày công được quy đổi theo 8 giờ/ngày để tổng hợp. Đây là số liệu ghi nhận, cần bảng xác nhận ngày công theo quy định của đơn vị.

Công cụ Thử nghiệm người dùng lập đợt trải nghiệm, ghi nhóm tham gia và phiếu đánh giá ba tiêu chí: dễ hiểu, dễ dùng, hữu ích; mỗi tiêu chí chấm từ 1 đến 5. Có nhận xét và báo cáo tổng hợp. Đợt thử nghiệm chỉ được ghi hoàn tất khi có phiếu và báo cáo. Phản hồi công khai trên trang hồ sơ được theo dõi riêng.

Công cụ Kinh phí & nguồn lực ghi hạng mục, số lượng, đơn giá VND, nguồn, chứng từ và loại dự toán hoặc thực chi; tổng hợp tách riêng hai loại để không cộng trùng. Số liệu cần đối chiếu bảng kê và chứng từ được đơn vị xác nhận.

Công cụ Minh chứng lưu tài liệu phối hợp, nguồn/quyền, xác nhận chuyên môn, kiểm tra kỹ thuật, thử nghiệm, bàn giao, nghiệm thu, kinh phí và phân công. Công cụ Báo cáo đối chiếu 7 chỉ tiêu, tổng hợp hồ sơ, sản phẩm, giờ/ngày công, minh chứng và khảo sát; cho phép xuất JSON, CSV hoặc in/lưu PDF từ trình duyệt.

Đầu ra: danh mục sản phẩm và minh chứng, bảng phân công/ngày công, kết quả khảo sát, báo cáo theo dõi chỉ tiêu và bản sao lưu phục vụ bàn giao. Phần mềm không tự kết luận nghiệm thu hoặc tính xác thực của văn bản.

## 3. Quy trình thực hiện theo năm bước

### Bước 1. Khảo sát và chọn di sản

Tạo nhiệm vụ khảo sát, phân công đơn vị và người phụ trách. Lập ít nhất 03 hồ sơ nháp cho địa điểm dự kiến. Thống nhất với đơn vị quản lý phạm vi tư liệu, điều kiện sử dụng, người kiểm chứng và phương thức tiếp nhận sản phẩm. Lưu văn bản phối hợp trong Minh chứng, chọn đúng loại và gắn từng hồ sơ di sản.

Minh chứng cần có: danh sách địa điểm, phiếu khảo sát, văn bản/biên bản phối hợp. Biểu mẫu phối hợp trong ứng dụng là mẫu tham khảo chưa có xác nhận.

### Bước 2. Thu thập và kiểm chứng tư liệu

Người nhập bổ sung nội dung, nguồn, tác giả và quyền sử dụng; tải hoặc liên kết tư liệu. Chỉ nhập tọa độ, niên đại khi có nguồn xác nhận. Gửi hồ sơ kiểm chứng, chuyên gia kiểm tra và ghi kết quả. Nếu cần bổ sung, người nhập sửa rồi gửi lại.

Minh chứng cần có: hồ sơ số, nguồn tư liệu, điều kiện bản quyền/quyền sử dụng và xác nhận chuyên môn. Việc nhấn duyệt không thay thế đối chiếu nguồn.

### Bước 3. Xây dựng sản phẩm và kiểm tra kỹ thuật

Công bố hồ sơ đã được duyệt; đăng ký ít nhất 05 sản phẩm số độc lập, gắn di sản và quyền sử dụng, gửi người khác kiểm tra. Kiểm tra tìm kiếm, tệp, dòng thời gian, bản đồ, liên kết và QR trên máy tính, điện thoại. Dùng mẫu kiểm tra kỹ thuật để ghi kết quả và lưu minh chứng.

Minh chứng cần có: danh mục sản phẩm không trùng, đường dẫn/tệp sử dụng được, biên bản kiểm tra và hướng dẫn. Hệ thống không tự tạo nội dung của 05 sản phẩm; nhóm phải sản xuất hoặc cung cấp nội dung thực tế.

### Bước 4. Trải nghiệm và điều chỉnh

Tạo đợt dùng thử, ghi nhóm người dùng, ngày tổ chức và phiếu khảo sát. Có thể dùng mã người tham gia thay tên để giảm thông tin cá nhân. Tổng hợp các vấn đề, giao nhiệm vụ sửa và ghi kết quả/ngày công. Lưu báo cáo thử nghiệm và bằng chứng điều chỉnh trong Minh chứng.

Minh chứng cần có: danh sách/phiếu hợp lệ, báo cáo nhận xét, nhiệm vụ và bằng chứng đã sửa. Phản hồi công khai không thay thế danh sách người tham gia đợt thử nghiệm.

### Bước 5. Nghiệm thu và bàn giao

Đối chiếu 7 chỉ tiêu trên Báo cáo; kiểm tra hồ sơ và sản phẩm thực tế, văn bản chuyên môn, thử nghiệm và ngày công. Tải mẫu nghiệm thu và bàn giao để hoàn thiện theo thẩm quyền. Sao lưu đầy đủ, thử phục hồi trên môi trường riêng, giao quyền vận hành qua kênh an toàn.

Minh chứng cần có: biên bản kiểm tra, hồ sơ nghiệm thu, văn bản bàn giao hoặc xác nhận sử dụng, danh mục dữ liệu được phép chuyển giao, tài khoản vận hành, lịch sao lưu và đầu mối hỗ trợ. Tất cả hạng mục theo đề án hoàn thành chậm nhất 30/05/2027.

## 4. Cách mô tả ngắn để đưa vào đề án hoặc báo cáo

“Nhóm thực hiện xây dựng HCMUS HeritageKit dưới dạng bộ công cụ web dùng chung, hỗ trợ các đơn vị thu thập, số hóa, sắp xếp, kiểm chứng và giới thiệu tư liệu di sản. Quy trình thao tác gồm lập hồ sơ có nguồn và quyền sử dụng, chuyên gia kiểm chứng trước công bố, tạo sản phẩm số có thể sử dụng độc lập, tổ chức dùng thử và ghi nhận kết quả. Hệ thống đồng thời quản lý phân công, nhật ký giờ/ngày công, minh chứng, sao lưu và báo cáo đối chiếu các chỉ tiêu để phục vụ nghiệm thu và bàn giao. Dữ liệu và văn bản chuyên môn được đơn vị phối hợp xác nhận; phần mềm hỗ trợ quản lý và tổng hợp, không thay thế thẩm quyền xác nhận nội dung hoặc công nhận công trình.”

Khi viết báo cáo kết quả, thay phần mô tả dự kiến bằng số liệu và minh chứng thực tế; không ghi đạt chỉ tiêu khi mới hoàn thành phần mềm.

## 5. Điều kiện vận hành và công việc trước khi công khai

Phiên bản hiện tại sử dụng Node.js từ 24, SQLite, Leaflet và thư viện QR. Cơ sở dữ liệu và tệp cần được sao lưu, quản lý quyền và bảo vệ ngoài Git. Website công khai cần HTTPS, tên miền đúng cho QR, tài khoản riêng cho từng người và chính sách quyền riêng tư. Trước khi phục vụ rộng rãi cần bổ sung giới hạn dung lượng tổng, kiểm tra an toàn tệp, giám sát, chính sách lưu/giữ dữ liệu và cơ chế khôi phục tài khoản.

Các biểu mẫu phối hợp, kiểm tra, khảo sát, phân công, nghiệm thu và bàn giao có thể tải trong Hướng dẫn thực hiện. Nhóm phải điều chỉnh theo quy định đang áp dụng và xin xác nhận đúng thẩm quyền.

## 6. Kiểm tra phần mềm đã thực hiện

Kiểm thử tự động chạy trên cơ sở dữ liệu tạm, không dùng dữ liệu thật: tạo/sửa/gửi duyệt/công bố hồ sơ, ngăn tự duyệt, giới hạn khách xem bản nháp và tệp riêng, duyệt sản phẩm/minh chứng, ghi nhiệm vụ/ngày công/kinh phí/khảo sát, tổng hợp chỉ tiêu, xuất dữ liệu, sao lưu và phục hồi kèm kiểm tra checksum, đổi mật khẩu và bảo vệ yêu cầu.

Kiểm tra trình duyệt thực hiện ở khung máy tính 1365×900 và điện thoại 390×844: nhập hồ sơ, tải ảnh/PDF, tài khoản chuyên gia duyệt, tạo sản phẩm, QR, khảo sát, xuất CSV và các màn hình quản lý. Đây là kiểm tra kỹ thuật bằng dữ liệu thử, chưa thay thế đợt dùng thử người dùng thật hoặc nghiệm thu của đơn vị.

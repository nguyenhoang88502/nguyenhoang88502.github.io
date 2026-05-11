# BOM Dataset Indexer — Hướng Dẫn Cho Quản Lý

## Dành cho bộ phận NPI — Wahl Clipper Việt Nam

---

## Công cụ này làm gì?

**BOM Dataset Indexer** là một công cụ tra cứu dữ liệu nhanh. Nó quét toàn bộ thư mục chứa các file Excel/CSV của bộ phận NPI (BOM, danh mục vật tư, thông tin nhà cung cấp, báo giá…) và xây dựng một bộ chỉ mục để **tìm kiếm tức thì** — thay vì phải mở từng file Excel một cách thủ công.

Nói ngắn gọn: **Giống như Google Search, nhưng dành riêng cho toàn bộ dữ liệu Excel trong ổ đĩa của bộ phận NPI.**

---

## Tại sao bộ phận NPI cần công cụ này?

### Bối cảnh hiện tại

Từ năm 2020 đến 2025, số lượng dự án chuyển giao về Wahl Việt Nam đã tăng từ **9 lên 101 dự án/năm**. Mỗi dự án tạo ra hàng chục file Excel: BOM, báo giá, danh sách nhà cung cấp, tiêu chuẩn kiểm tra, PRFA, RII…

Những khó khăn thực tế mà đội ngũ NPI đang gặp phải:

| Vấn đề | Trước đây | Với BOM Indexer |
|---|---|---|
| **Tra cứu linh kiện** | Mở từng file Excel, Ctrl+F từng file — mất 10–20 phút mỗi lần | Gõ từ khóa, kết quả hiện trong 1–2 giây |
| **Xác minh BOM (Bước 2.5 EPM)** | So sánh thủ công giữa mẫu thật và BOM hệ thống, dễ bỏ sót | Tìm và đối chiếu tất cả BOM liên quan trong tích tắc |
| **Tìm nhà cung cấp** | Không nhớ supplier nào cung cấp linh kiện nào — phải lục lại email hoặc file cũ | Gõ tên linh kiện, thấy ngay tất cả supplier từng liên quan |
| **Chuẩn bị trial production** | Tổng hợp dữ liệu từ nhiều file để lập kế hoạch trial — mất hàng giờ | Xuất CSV đã lọc, copy thẳng vào kế hoạch trial |
| **Dự án tăng đột biến** | Càng nhiều dự án, càng mất thời gian tra cứu — không scale được | Công cụ chạy nhanh như nhau dù 10 hay 100 dự án |

### Tiết kiệm thời gian ước tính

- **Tra cứu thông tin linh kiện/BOM**: từ ~15 phút → ~10 giây (tiết kiệm ~90%)
- **Tổng hợp dữ liệu cho báo cáo trial**: từ ~2 giờ → ~5 phút
- **Tìm và xác minh supplier**: từ ~30 phút → ~1 phút

Với trung bình mỗi kỹ sư NPI thực hiện 5–10 lần tra cứu mỗi ngày, công cụ này tiết kiệm **khoảng 5–8 giờ/tuần/người**.

---

## Công cụ hoạt động như thế nào?

(Không cần kiến thức kỹ thuật để hiểu phần này)

```
THƯ MỤC CHỨA FILE        BỘ CHỈ MỤC              TRA CỨU
   (Excel/CSV)      →     (Database)      →      (Tìm kiếm)

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  BOM_SP001    │      │              │      │  "motor"     │
│  Supplier list│  →   │  IndexedDB   │  →   │  → 12 files  │
│  Báo giá      │      │  / SQLite    │      │  → 45 records│
│  PRFA         │      │              │      │  → 3 suppliers│
│  ...hundreds  │      │  (tự động)   │      │  (1-2 giây)  │
└──────────────┘      └──────────────┘      └──────────────┘
```

**Ba bước đơn giản:**
1. **Chọn thư mục** — trỏ vào ổ đĩa chứa dữ liệu NPI (một lần duy nhất)
2. **Nhấn Index** — công cụ tự động đọc và lập chỉ mục tất cả file Excel/CSV
3. **Tìm kiếm** — gõ từ khóa bất kỳ, kết quả hiện ra ngay

**Những lần sau:** Chỉ cần mở lại app, dữ liệu đã được lưu trong bộ nhớ đệm (cache) — không cần index lại. Chỉ khi có file mới thì nhấn "Re-index" để cập nhật.

---

## Bảo mật dữ liệu — tuyệt đối an toàn

Đây là điểm quan trọng để ban lãnh đạo yên tâm:

- **KHÔNG có dữ liệu nào được tải lên internet.** Toàn bộ quá trình xử lý diễn ra trên máy tính nội bộ.
- **KHÔNG có server, KHÔNG có cloud.** Dữ liệu BOM, supplier, báo giá ở yên trong nhà máy.
- **File gốc không bao giờ bị thay đổi.** Công cụ chỉ đọc, không ghi vào file Excel gốc.
- **Phù hợp với chính sách bảo mật của Wahl Global.** Không chia sẻ dữ liệu ra bên ngoài.

---

## Hai phiên bản — dùng cái nào cũng được

| | Web Version | Desktop App |
|---|---|---|
| **Cần cài đặt?** | Không — mở bằng trình duyệt | Không — chạy file .exe trực tiếp |
| **Phù hợp khi** | Tra cứu nhanh, không cần tải gì | Dùng hàng ngày, dữ liệu lớn |
| **Tốc độ** | Nhanh | Nhanh hơn (đa luồng) |
| **Dữ liệu lưu ở** | Trình duyệt (IndexedDB) | File SQLite trên máy |
| **Offline?** | Có (PWA) | Có |

**Khuyến nghị cho NPI:** Dùng Desktop App để có tốc độ xử lý tốt nhất với khối lượng dữ liệu lớn. Web Version dùng để tra cứu nhanh khi đang họp hoặc trên laptop không cài sẵn app.

---

## Workflow mới cho bộ phận NPI

### Quy trình 7 bước EPM — tích hợp BOM Indexer

| Bước EPM | Hoạt động | Cách BOM Indexer hỗ trợ |
|---|---|---|
| **Bước 1:** Lập kế hoạch | Thiết lập BOM, báo giá, Gantt chart | Index tất cả BOM của dự án cũ — tra cứu linh kiện tương tự để ước tính chi phí và timeline nhanh hơn |
| **Bước 2–3:** Thiết kế | Kiểm tra thiết kế, chuẩn bị FMEA, DFM | Tìm ngay các linh kiện có lịch sử lỗi từ dữ liệu cũ để đưa vào FMEA |
| **Bước 4–5:** Kiểm tra mẫu | Kiểm tra mẫu thật, thiết lập inspection standard | Đối chiếu BOM mẫu thật với BOM hệ thống — phát hiện sai khác trong giây lát |
| **Bước 6:** Trial Production | Chạy thử, ghi nhận lỗi, SOP | Tra cứu nhanh các lỗi tương tự ở dự án trước để có phương án xử lý sớm |
| **Bước 7:** Sản xuất hàng loạt | Bàn giao cho Supply Chain, Kaizen | Xuất toàn bộ dữ liệu đã index thành CSV để bàn giao hoặc phân tích |

### Ví dụ thực tế

**Tình huống:** Kỹ sư NPI nhận dự án chuyển giao sản phẩm tông-đơ mới từ Ningbo. Cần xác minh BOM gồm 80 linh kiện khớp giữa mẫu thật và hệ thống.

**Trước đây:**
1. Mở BOM hệ thống (ERP)
2. Mở BOM từ Ningbo gửi qua (Excel)
3. Mở bảng supplier list
4. So sánh từng dòng — 80 linh kiện × kiểm tra 3 nguồn = ~1.5–2 giờ
5. Nếu có sai khác, lại mở thêm file khác để đối chiếu

**Với BOM Indexer:**
1. Index folder dự án một lần (~2 phút)
2. Gõ mã linh kiện hoặc tên — kết quả hiện từ tất cả các file cùng lúc
3. Thấy ngay linh kiện nào có sai khác giữa các nguồn
4. Tổng thời gian: ~15 phút cho cả bộ BOM 80 linh kiện

---

## Cách bắt đầu — cho Quản lý NPI

### Dành cho Trưởng bộ phận:

1. **Tải app về** — link tải: `[Server nội bộ]/BOM Dataset Indexer v5.exe` (hoặc lấy từ thư mục `legacy_database_management/desktop_app/`)
2. **Chạy thử với 1 dự án** — chọn thư mục của 1 dự án NPI đã hoàn thành gần đây, index và test tìm kiếm
3. **Phổ biến cho team** — tổ chức 1 buổi họp 15 phút demo cách dùng (xem phần "Hướng dẫn nhanh" bên dưới)
4. **Thiết lập thói quen** — mỗi khi bắt đầu dự án mới, index folder dự án đó vào BOM Indexer. Mỗi tuần re-index 1 lần để cập nhật dữ liệu mới.

### Dành cho Kỹ sư NPI:

#### Web Version (mở bằng trình duyệt):
1. Mở `Indexing_web.html` bằng Chrome/Edge
2. Nhấn **Select Folder** → chọn thư mục dự án
3. Chọn chế độ **BOM** (cho dữ liệu sản xuất)
4. Nhấn **Start Indexing** — chờ thanh tiến trình chạy xong
5. Dùng thanh tìm kiếm để tra cứu — gõ mã linh kiện, tên supplier, mã BOM…
6. Nhấn **Export CSV** để xuất kết quả ra file

#### Desktop App (ứng dụng Windows):
1. Tải file `.exe` về máy
2. Nhấp đúp để chạy — **không cần cài đặt**
3. Nhấn **Select Folder** → chọn thư mục chứa dữ liệu NPI
4. Chọn chế độ quét và nhấn **Start Indexing**
5. Sử dụng:
   - **Thanh tìm kiếm chính** — tìm toàn văn trên tất cả nội dung
   - **Quick Lookup** — tìm chính xác theo mã linh kiện hoặc mã BOM
   - **Batch Find** — dán danh sách nhiều mã cùng lúc
6. Nhấn **Export CSV** để lưu kết quả đã lọc

---

## Câu hỏi thường gặp

**H: Dữ liệu có bị mất khi tắt app không?**
Đ: Không. Tất cả dữ liệu đã index được lưu vào cache (SQLite/IndexedDB). Lần mở sau load lại ngay lập tức.

**H: Có giới hạn số lượng file không?**
Đ: Không có giới hạn cứng. Đã test với hàng ngàn file Excel. Nếu dữ liệu quá lớn (~trên 100MB), cache sẽ tự động phân vùng.

**H: App có hoạt động trên máy tính công ty không?**
Đ: Có. App chỉ cần Windows 10/11, không cần quyền admin, không cần cài đặt gì thêm. File .exe chạy độc lập.

**H: Nếu có nhiều người cùng dùng thì sao?**
Đ: Mỗi người cài app trên máy riêng, index thư mục dữ liệu dùng chung trên ổ đĩa mạng. Mỗi máy có cache riêng — không xung đột.

**H: Có cần IT hỗ trợ không?**
Đ: Không. App chạy độc lập, không cần server, không cần database, không cần cấu hình mạng.

---

## Tổng kết

BOM Dataset Indexer giải quyết một vấn đề rất cụ thể của bộ phận NPI: **mất quá nhiều thời gian để tra cứu dữ liệu từ hàng trăm file Excel**. 

Với áp lực ngày càng tăng (từ 9 dự án/năm lên 101+ dự án/năm), việc có một công cụ tra cứu nhanh không còn là "nice to have" mà là công cụ thiết yếu để bộ phận NPI vận hành hiệu quả và đáp ứng được kỳ vọng của ban lãnh đạo về tiến độ dự án.

**Liên hệ:** [Tên người phụ trách] — [Email] — [Số điện thoại nội bộ]

---

*Tài liệu này được viết cho bộ phận NPI — Wahl Clipper Việt Nam. Cập nhật tháng 5/2026.*

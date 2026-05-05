# BOM Dataset Indexer - Trình Quản Lý Cơ Sở Dữ Liệu Kế Toán Vật Liệu

## 📚 Hướng Dẫn Sử Dụng Nhanh (Tutorial)

### Bước 1: Tải Dataset
1. Mở ứng dụng trong trình duyệt
2. Nhấn nút **"Select dataset folder"** (Chọn thư mục dataset)
3. Chọn thư mục chứa các file Excel (.xls, .xlsx, .xlsm, .xlsb)
4. Ứng dụng sẽ tự động quét và phân loại tất cả các file BOM

### Bước 2: Tìm Kiếm Thông Tin
1. Sử dụng hộp tìm kiếm chính để tìm theo:
   - Tên file
   - Tên sheet
   - Số hiệu vật liệu (Item Number)
   - Số hiệu BOM (BOM Number)
   - Tên sản phẩm
   - Tiêu đề cột
   
2. Lọc kết quả theo:
   - **Type**: Loại BOM (BOM line, BOM header, Mixed BOM report, Non-BOM, Unknown, Error)
   - **Records**: Loại dữ liệu (Items, BOMs, Fractional quantities, Errors)

### Bước 3: Tra Cứu Nhanh (Quick Lookup)
1. Gõ bất kỳ giá trị nào vào hộp **"Quick Lookup"**:
   - Số hiệu vật liệu
   - Số hiệu BOM
   - Tên sản phẩm
   - Kho hàng
   - Số lượng
   - Người phê duyệt
   
2. Chọn chế độ tìm kiếm:
   - **Contains**: Tìm kiếm chứa (mặc định)
   - **Exact item/BOM**: Tìm kiếm chính xác

### Bước 4: Tìm Kiếm Hàng Loạt (Batch Find)
1. Dán nhiều giá trị vào hộp **"Batch find"**
2. Tách biệt các giá trị bằng: dòng mới, dấu phẩy, dấu chấm phẩy, tab hoặc dấu cách
3. Nhấn **"Batch Find"** để tìm tất cả các giá trị cùng lúc

### Bước 5: Xuất Dữ Liệu
1. Sau khi tìm kiếm hoặc lọc, nhấn **"Export CSV"** để tải xuống
2. File CSV sẽ chứa tất cả kết quả tìm kiếm

### Bước 6: Lưu Cache
- Ứng dụng tự động lưu cache vào IndexedDB của trình duyệt
- Bạn có thể nhấn **"Load Cache"** để tải lại dữ liệu trước đó mà không cần quét lại

---

## 📖 Giới Thiệu Chi Tiết

**BOM Dataset Indexer** là một công cụ mạnh mẽ để quản lý và tìm kiếm dữ liệu **Bill of Materials (BOM)** từ các file Excel. Công cụ này:

- ✅ Nhận dạng BOM từ tiêu đề và đầu cột theo **tiếng Anh, tiếng Việt và tiếng Trung**
- ✅ Xây dựng chỉ mục BOM tập trung cho truy vấn nhanh
- ✅ Hỗ trợ tìm kiếm với nhiều tiêu chí khác nhau
- ✅ Cho phép tìm kiếm hàng loạt hiệu quả
- ✅ Lưu cache trình duyệt để tối ưu hóa hiệu suất
- ✅ Xuất kết quả thành file CSV

---

## 🎯 Các Tính Năng Chính

### 1. **Tải Dataset**
- Chọn toàn bộ thư mục chứa nhiều file Excel
- Hoặc chọn các file riêng lẻ
- Ứng dụng sẽ phân loại tự động từng file

### 2. **Phân Loại Thông Minh**
Mỗi file được phân loại thành:
- **BOM line**: File chứa các dòng chi tiết BOM
- **BOM header**: File chứa thông tin tiêu đề BOM
- **Mixed BOM report**: File chứa cả tiêu đề và chi tiết
- **Non-BOM**: File không liên quan đến BOM
- **Unknown**: Không xác định được loại
- **Error**: Có lỗi trong quá trình xử lý

### 3. **Thống Kê Toàn Bộ**
Hiển thị các chỉ số:
- Tổng số file đã xử lý
- Tổng số file bỏ qua
- Số lượng cache hit
- Phân bố theo loại file

### 4. **Tìm Kiếm Nâng Cao**
- Tìm kiếm toàn văn bản trong tất cả các trường
- Hỗ trợ tìm kiếm theo chế độ chính xác
- Tìm kiếm hàng loạt với nhiều từ khóa cùng lúc

### 5. **Lọc Dữ Liệu**
- Lọc theo loại BOM
- Lọc theo loại dữ liệu (có số hiệu vật liệu, BOM, số lượng lẻ, lỗi)
- Tùy chọn chỉ hiển thị BOM liên quan

### 6. **Quản Lý Đường Dẫn**
- Lưu đường dẫn thư mục cha để tham chiếu sau
- Xóa đường dẫn đã lưu

### 7. **Xuất Dữ Liệu**
- Xuất kết quả tìm kiếm thành file CSV
- Dễ dàng nhập vào Excel, Power BI hoặc các công cụ khác

---

## 🛠️ Hướng Dẫn Chi Tiết cho Từng Tính Năng

### Cách Sử Dụng Bộ Lọc

**1. Bộ Lọc Loại (Type Filter):**
```
- "All detected types": Hiển thị tất cả các loại
- "BOM line": Chỉ file chi tiết dòng BOM
- "BOM header": Chỉ file tiêu đề BOM
- "Mixed BOM report": File kết hợp
- "Non-BOM": File không phải BOM
- "Unknown": Loại không xác định
- "Error": File có lỗi
```

**2. Bộ Lọc Bản Ghi (Record Filter):**
```
- "All records": Tất cả bản ghi
- "Has item numbers": Chỉ bản ghi có số hiệu vật liệu
- "Has BOM numbers": Chỉ bản ghi có số hiệu BOM
- "Has fractional qty": Chỉ bản ghi có số lượng lẻ
- "Has parse errors": Chỉ bản ghi có lỗi
```

### Cách Sử Dụng Tra Cứu Nhanh

Hộp **Quick Lookup** cho phép tìm kiếm một lần:
- Gõ số hiệu vật liệu (ví dụ: 12345678)
- Hoặc gõ tên sản phẩm
- Hoặc gõ số BOM

Kết quả sẽ hiển thị tất cả các hàng liên quan và đường dẫn file

### Cách Sử Dụng Tìm Kiếm Hàng Loạt

Khi bạn có danh sách nhiều vật liệu cần tìm:

```
Ví dụ, dán vào hộp Batch Find:
10001 10002 10003
hoặc
10001, 10002, 10003
hoặc
10001
10002
10003
```

Ứng dụng sẽ tìm tất cả các bản ghi khớp với danh sách

---

## 📊 Hiểu Biết Thêm Về Dữ Liệu

### Thống Kê Workbook Index
- **Tổng Files**: Tổng số file được xử lý
- **Skipped**: Số file bỏ qua (thường là file không phải BOM)
- **Cache Hits**: Số file được lấy từ cache
- **BOM Lines**: Tổng số dòng BOM được nhận diện
- **Unique Items**: Tổng số vật liệu duy nhất
- **Unique BOMs**: Tổng số BOM duy nhất

### Thông Tin Chi Tiết Workbook
Khi bạn chọn một file trong danh sách, bên phải sẽ hiển thị:
- Tên file và đường dẫn
- Số lượng sheet
- Tổng số bản ghi BOM
- Danh sách các loại BOM được phát hiện
- Các cảnh báo hoặc lỗi (nếu có)
- Mẫu dữ liệu từ file

---

## 💾 Hệ Thống Cache

Ứng dụng sử dụng **IndexedDB** để lưu cache:

- **Tên cơ sở dữ liệu**: `bom-dataset-index-cache`
- **Tên bảng**: `indexes`
- **Khóa**: `latest-v3`

**Lợi ích của cache:**
- Không cần quét lại file khi mở lại ứng dụng
- Tăng tốc độ tải dữ liệu
- Giảm tải xử lý

**Cách xóa cache:**
- Nhấn F12 → DevTools → Application → IndexedDB
- Xóa database `bom-dataset-index-cache`

---

## 🌐 Hỗ Trợ Ngôn Ngữ

Ứng dụng hỗ trợ nhận dạng BOM từ tiêu đề bằng:
- ✅ **Tiếng Anh**: BOM, Bill of Materials, Item, Quantity...
- ✅ **Tiếng Việt**: BOM, Vật liệu, Số hiệu, Số lượng, Đơn vị...
- ✅ **Tiếng Trung**: BOM, 物料, 数量...

---

## ⚙️ Các Thiết Lập Nâng Cao

### Đường Dẫn Gốc (Base Path)
- Nhập đường dẫn cha để tham chiếu
- Ví dụ: `C:\Users\...\D365 automation`
- Nhấn **Save Path** để lưu
- Nhấn **Clear Path** để xóa

### Tùy Chọn Lọc BOM
- **Skip unrelated workbooks**: Bỏ qua các file không phải BOM
  - Những file này sẽ được phân loại nhưng không thêm vào tìm kiếm
  - Giúp giữ chỉ mục sạch và nhanh

---

## 📝 Hướng Dẫn Xuất Dữ Liệu

### Xuất toàn bộ chỉ mục
1. Không nhập gì vào bộ tìm kiếm
2. Không áp dụng bộ lọc hoặc áp dụng `All`
3. Nhấn **Export CSV**

### Xuất kết quả tìm kiếm
1. Tìm kiếm hoặc lọc dữ liệu theo ý
2. Nhấn **Export CSV**
3. File CSV sẽ chứa chỉ những kết quả được hiển thị

### Định dạng CSV
File CSV được xuất chứa các cột:
- File path
- Sheet name
- Item number (nếu có)
- BOM number (nếu có)
- Product name
- Quantity
- Unit
- Và các cột khác tùy theo dữ liệu

---

## 🐛 Xử Lý Sự Cố

### Vấn đề: Ứng dụng tải chậm
**Giải pháp:**
- Xóa cache và tải lại
- Tắt tùy chọn "Skip unrelated workbooks" nếu bạn cần tất cả file
- Giảm kích thước dataset nếu có thể

### Vấn đề: Một số file không được nhận diện là BOM
**Giải pháp:**
- Kiểm tra tiêu đề sheet có chứa từ khoá BOM không
- Kiểm tra xem các tên cột có khớp với tiêu chuẩn BOM không
- File có thể được phân loại là "Non-BOM" nếu không có cấu trúc BOM rõ ràng

### Vấn đề: Tìm kiếm không trả về kết quả
**Giải pháp:**
- Kiểm tra xem bộ lọc có quá hạn chế không
- Thử sử dụng chế độ "Contains" thay vì "Exact"
- Kiểm tra lại cách viết từ khóa

### Vấn đề: Export CSV không hoạt động
**Giải pháp:**
- Kiểm tra trình duyệt có cho phép tải file không
- Thử trình duyệt khác
- Kiểm tra xem có dữ liệu được hiển thị trong chỉ mục không

---

## 📋 Các Trường Dữ Liệu Được Hỗ Trợ

Ứng dụng có thể nhận diện và lập chỉ mục các trường:

| Trường | Mô Tả |
|-------|-------|
| Item Number | Số hiệu vật liệu duy nhất |
| BOM Number | Số hiệu danh sách vật liệu |
| Product Name | Tên sản phẩm |
| Description | Mô tả chi tiết |
| Quantity | Số lượng |
| Unit | Đơn vị tính (EA, KG, M, v.v.) |
| Warehouse | Kho hàng |
| Approved By | Người phê duyệt |
| Status | Trạng thái (Active, Inactive, v.v.) |

---

## 🎓 Ví Dụ Thực Tế

### Ví dụ 1: Tìm tất cả các sản phẩm chứa vật liệu 10001
1. Nhấn "Select dataset folder" chọn thư mục
2. Đợi tải xong
3. Gõ "10001" vào "Quick Lookup"
4. Xem các BOM chứa vật liệu này

### Ví dụ 2: Tìm kiếm danh sách 100 vật liệu cùng lúc
1. Copy danh sách từ Excel
2. Dán vào hộp "Batch find"
3. Nhấn "Batch Find"
4. Nhấn "Export CSV" để lưu kết quả

### Ví dụ 3: Kiểm tra tất cả BOM có số lượng lẻ
1. Chọn "Record Filter" → "Has fractional qty"
2. Xem danh sách
3. Kiểm tra hoặc xuất để xử lý

---

## 📌 Ghi Chú Quan Trọng

- ⚠️ Dữ liệu được lưu trong cache trình duyệt, có thể bị xóa nếu bạn xóa dữ liệu duyệt
- ⚠️ Ứng dụng chỉ đọc file, không chỉnh sửa file gốc
- ⚠️ Để có kết quả tốt nhất, hãy đảm bảo file Excel có cấu trúc rõ ràng với tiêu đề cột
- ✅ Ứng dụng hoạt động ngoại tuyến sau khi tải xong

---

## 📞 Hỗ Trợ & Phản Hồi

Nếu gặp vấn đề hoặc có đề xuất cải tiến, vui lòng:
- Kiểm tra phần "Xử Lý Sự Cố" ở trên
- Kiểm tra console trình duyệt (F12) để xem chi tiết lỗi
- Ghi lại các bước dẫn đến sự cố

---

## 📄 Phiên Bản & Cập Nhật

**Phiên bản hiện tại**: 1.0

**Những cải tiến trong tương lai:**
- Hỗ trợ thêm định dạng file (CSV, JSON, XML)
- Hỗ trợ nhiều ngôn ngữ hơn
- Tính năng so sánh BOM
- Xuất báo cáo chi tiết hơn
- Hỗ trợ cloud sync

---

**Chúc bạn sử dụng ứng dụng hiệu quả!** 🚀

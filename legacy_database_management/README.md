# Hệ thống Quản lý và Truy vấn Dữ liệu BOM (BOM Dataset Indexer)

BOM Dataset Indexer là giải pháp tối ưu giúp tự động hóa việc phân loại, lập chỉ mục và tìm kiếm dữ liệu Bill of Materials (BOM) từ các tệp tin Excel. Công cụ hỗ trợ nhận diện đa ngôn ngữ (Anh - Việt - Trung) và tối ưu hóa hiệu suất truy vấn thông qua hệ thống lưu trữ đệm (cache) thông minh.


## Hướng dẫn sử dụng nhanh

### Bước 1: Nạp dữ liệu

1.  Truy cập ứng dụng trên trình duyệt.
    
2.  Nhấn nút "Select dataset folder" (Chọn thư mục dữ liệu).
    
3.  Chọn thư mục chứa các tệp Excel (.xls, .xlsx, .xlsm, .xlsb).
    
4.  Hệ thống sẽ tự động quét, phân loại và lập chỉ mục toàn bộ dữ liệu hiện có.
    

### Bước 2: Tìm kiếm thông tin

Sử dụng hộp tìm kiếm chính để tra cứu theo các tiêu chí:

*   Thông tin định danh: Tên tệp, tên Sheet, số hiệu BOM (BOM Number).
    
*   Thông tin vật tư: Số hiệu vật liệu (Item Number), tên sản phẩm, tiêu đề cột.
    

### Bước 3: Tra cứu nhanh (Quick Lookup)

Nhập bất kỳ giá trị nào (mã vật tư, kho, người duyệt...) vào ô Quick Lookup:

*   Chế độ Contains: Tìm kiếm tương đối (mặc định).
    
*   Chế độ Exact item/BOM: Tìm kiếm chính xác tuyệt đối.
    

### Bước 4: Tìm kiếm hàng loạt (Batch Find)

1.  Dán danh sách các mã vật tư vào ô Batch Find. Hệ thống hỗ trợ các dấu ngăn cách: xuống dòng, dấu phẩy, dấu chấm phẩy, tab hoặc khoảng trắng.
    
2.  Nhấn "Batch Find" để hệ thống truy xuất đồng thời tất cả các giá trị trong danh sách.
    

### Bước 5: Xuất báo cáo

Nhấn "Export CSV" để tải về kết quả đã lọc hoặc tìm kiếm. Tệp CSV được tối ưu để mở bằng Excel, Power BI hoặc các công cụ phân tích dữ liệu khác.


## Các tính năng chi tiết

### 1\. Phân loại dữ liệu thông minh

Hệ thống tự động nhận diện và phân loại tệp dựa trên cấu trúc dữ liệu:

*   BOM line: Tệp chứa chi tiết các dòng vật tư.
    
*   BOM header: Tệp chứa thông tin tiêu đề/tổng quát của BOM.
    
*   Mixed BOM report: Tệp kết hợp cả thông tin tiêu đề và chi tiết.
    
*   Non-BOM / Unknown: Tệp không liên quan hoặc không xác định được cấu trúc BOM.
    
*   Error: Tệp bị lỗi định dạng hoặc không thể truy cập.
    

### 2\. Bộ lọc chuyên sâu

*   Lọc theo Loại (Type Filter): Thu hẹp phạm vi tìm kiếm theo nhãn tệp (BOM Line, Header...).
    
*   Lọc theo Bản ghi (Record Filter): Tìm nhanh các dòng có số lượng lẻ (fractional qty), các dòng bị lỗi (parse errors) hoặc lọc riêng theo mã vật tư/số hiệu BOM.
    

### 3\. Hệ thống lưu trữ đệm (Cache)

Ứng dụng sử dụng IndexedDB để ghi nhớ dữ liệu đã lập chỉ mục:

*   Tốc độ: Tải lại dữ liệu cũ gần như tức thì thông qua nút "Load Cache".
    
*   Hiệu suất: Giảm thiểu việc xử lý lại các tệp không thay đổi, tiết kiệm tài nguyên hệ thống.
    


## Bảng trường dữ liệu được hỗ trợ

Hệ thống tự động nhận diện các cột dữ liệu dựa trên tiêu đề bằng tiếng Anh, Việt và Trung:

<table data-path-to-node="31"><thead><tr><th><span data-path-to-node="31,0,0,0">Trường dữ liệu</span></th><th><span data-path-to-node="31,0,1,0">Mô tả</span></th></tr></thead><tbody><tr><td><span data-path-to-node="31,1,0,0">Item Number</span></td><td><span data-path-to-node="31,1,1,0">Mã số định danh vật tư</span></td></tr><tr><td><span data-path-to-node="31,2,0,0">BOM Number</span></td><td><span data-path-to-node="31,2,1,0">Mã số danh mục vật tư</span></td></tr><tr><td><span data-path-to-node="31,3,0,0">Product Name</span></td><td><span data-path-to-node="31,3,1,0">Tên sản phẩm hoặc thành phẩm</span></td></tr><tr><td><span data-path-to-node="31,4,0,0">Quantity</span></td><td><span data-path-to-node="31,4,1,0">Số lượng vật tư</span></td></tr><tr><td><span data-path-to-node="31,5,0,0">Unit</span></td><td><span data-path-to-node="31,5,1,0">Đơn vị tính (EA, KG, M, bộ...)</span></td></tr><tr><td><span data-path-to-node="31,6,0,0">Warehouse</span></td><td><span data-path-to-node="31,6,1,0">Kho lưu trữ hoặc vị trí lưu kho</span></td></tr><tr><td><span data-path-to-node="31,7,0,0">Approved By</span></td><td><span data-path-to-node="31,7,1,0">Người phê duyệt dữ liệu</span></td></tr><tr><td><span data-path-to-node="31,8,0,0">Status</span></td><td><span data-path-to-node="31,8,1,0">Trạng thái (Active, Inactive, v.v.)</span></td></tr></tbody></table>


## Xử lý sự cố thường gặp

*   Tệp không xuất hiện trong kết quả: Kiểm tra tùy chọn "Skip unrelated workbooks". Nếu tệp không chứa từ khóa tiêu chuẩn về BOM trong tên sheet hoặc tiêu đề cột, hệ thống có thể đã bỏ qua để tối ưu bộ nhớ.
    
*   Ứng dụng phản hồi chậm: Thực hiện xóa cache tại mục DevTools (F12) > Application > IndexedDB và tải lại dữ liệu.
    
*   Không xuất được tệp CSV: Đảm bảo trình duyệt đang sử dụng (Chrome/Edge) được cấp quyền tải xuống tệp tin.
    
*   Dữ liệu nhận diện sai cột: Kiểm tra lại tệp Excel gốc để đảm bảo dòng tiêu đề không bị gộp ô (merge cells) và nằm ở các dòng đầu tiên.
    


## Ghi chú quan trọng

*   Bảo mật: Dữ liệu được xử lý cục bộ trên trình duyệt, không tải lên máy chủ bên ngoài.
    
*   Tính toàn vẹn: Ứng dụng chỉ đọc dữ liệu, không làm thay đổi nội dung các tệp Excel gốc.
    
*   Khuyến nghị: Nên sử dụng cache để tối ưu hóa thời gian làm việc với các bộ dữ liệu lớn.
    


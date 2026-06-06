# Công Cụ Inspection Standard

Đây là công cụ chạy trực tiếp trên máy tính nội bộ để tạo file Excel Inspection Standard từ hình ảnh, file PDF scan, file template Excel và file BOM hằng tuần. Người dùng chỉ cần mở công cụ bằng file launch, kéo thả hình vào đúng vị trí, kiểm tra gợi ý BOM, rồi xuất file Excel cuối cùng.

## Mục Đích

Công cụ này giúp giảm thao tác thủ công khi lập Inspection Standard:

- Đưa hình ảnh hoặc trang PDF scan vào khu vực làm việc.
- Gán hình vào các vị trí đã có sẵn trong template.
- Cắt hình thủ công khi cần, hoặc dùng nút `Auto crop` để công cụ tự căn lại hình theo tỉ lệ của ô trong Excel.
- Đọc file BOM mới nhất trong thư mục BOM hằng tuần.
- Gợi ý item BOM liên quan theo mã FG để người kiểm tra đối chiếu nhanh hơn.
- Tạo file Excel đầu ra dựa trên `Inspection Standard Template.xlsx`.

Tất cả xử lý diễn ra trên máy tính của người dùng. Công cụ không cần server riêng và không đưa hình ảnh lên internet.

## Các File Cần Để Cùng Một Thư Mục

Vui lòng giữ các file và thư mục sau trong cùng một thư mục chia sẻ, ví dụ OneDrive:

```text
Launch Inspection Standard Tool.bat
Inspection Standard Tool.html
Inspection Standard Template.xlsx
1. Weekly BOM\
```

File BOM hằng tuần được đặt trong:

```text
1. Weekly BOM\
```

Khi mở công cụ, file `Launch Inspection Standard Tool.bat` sẽ tự tạo `Weekly BOM Manifest.json`. File này giúp công cụ nhận biết BOM nào là mới nhất trong thư mục `1. Weekly BOM`.

## Cách Mở Công Cụ

Người dùng mở bằng cách double-click:

```text
Launch Inspection Standard Tool.bat
```

Không nên double-click trực tiếp vào `Inspection Standard Tool.html`, vì file launch đã chuẩn bị môi trường Chrome phù hợp để công cụ đọc được template Excel và file BOM nội bộ.

## Quy Trình Sử Dụng

1. Mở công cụ bằng `Launch Inspection Standard Tool.bat`.
2. Kéo thả hình ảnh hoặc PDF scan vào khu vực upload.
3. Nếu hình nằm trong danh sách Unassigned Images, kéo hình đó vào placeholder cần dùng.
4. Nếu cần cắt hình nhanh theo tỉ lệ ô Excel, bấm `Auto crop` ở phần footer của slot.
5. Nếu cần chỉnh tay, bấm `Crop` trên hình đã gán.
6. Có thể dùng `Clear` để xóa hình khỏi slot và gán lại.
7. Nhập mã FG để công cụ đọc BOM và hiển thị gợi ý item liên quan.
8. Kiểm tra các gợi ý BOM, chọn những mục phù hợp nếu cần.
9. Bấm generate để tạo file Excel Inspection Standard cuối cùng.

## Những Việc Công Cụ Tự Động Làm

- Tự chọn file BOM mới nhất trong thư mục `1. Weekly BOM`.
- Tự nhận diện dòng header trong file BOM, nên BOM có thêm dòng ghi chú phía trên vẫn có thể đọc được.
- Tự chuẩn hóa dữ liệu BOM về đúng dạng mà công cụ cần dùng.
- Tự bỏ qua một số nhóm vật tư khó kiểm bằng hình, ví dụ molding material hoặc một số part assembly.
- Với slot fold, công cụ chỉ ưu tiên hiển thị các item tape liên quan.
- Khi dùng `Auto crop`, công cụ căn hình theo tỉ lệ của vùng merge cell trong template Excel để hình đưa vào file xuất ra vừa với ô hơn.

## Khi Có Vấn Đề

Nếu công cụ không đọc được BOM mới nhất, hãy kiểm tra:

- File BOM đã nằm trong thư mục `1. Weekly BOM`.
- File BOM không bị khóa hoặc đang lỗi sync từ OneDrive.
- Mở lại công cụ bằng `Launch Inspection Standard Tool.bat`.
- Nếu cần, dùng chức năng mở BOM thủ công trong giao diện.

Nếu hình không vào đúng placeholder, thử kéo lại từ danh sách Unassigned Images hoặc upload lại hình từ File Explorer.

## Lưu Ý Quan Trọng

- `Inspection Standard Template.xlsx` là file mẫu đầu ra, không nên đổi tên nếu chưa thông báo cho người phụ trách công cụ.
- Không xóa `1. Weekly BOM\` nếu vẫn muốn công cụ tự lấy BOM mới nhất.
- `Weekly BOM Manifest.json` là file tự động tạo ra, không cần sửa tay.
- Công cụ được thiết kế để chạy nội bộ, phù hợp cho người dùng nghiệp vụ mà không cần thao tác kỹ thuật.

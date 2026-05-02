
# -*- coding: utf-8 -*-
# BKFC NHC low-effort poster builder.
# PowerShell stays ASCII-only. This Python file writes all Vietnamese content as UTF-8.
# All design resources are PNG files, not SVG.

from __future__ import annotations

import argparse
import csv
import html
from pathlib import Path
import struct
import zlib

def _chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

def write_png(path: Path, width: int, height: int, rgba: bytearray) -> None:
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        start = y * stride
        raw.extend(rgba[start:start + stride])
    data = b"\x89PNG\r\n\x1a\n"
    data += _chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    data += _chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    data += _chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

def canvas(width: int, height: int, color=(0, 0, 0, 0)) -> bytearray:
    r, g, b, a = color
    return bytearray([r, g, b, a] * width * height)

def set_px(img: bytearray, w: int, h: int, x: int, y: int, color) -> None:
    if 0 <= x < w and 0 <= y < h:
        i = (y * w + x) * 4
        img[i:i+4] = bytes(color)

def rect(img: bytearray, w: int, h: int, x0: int, y0: int, x1: int, y1: int, color) -> None:
    x0, x1 = max(0, min(x0, x1)), min(w, max(x0, x1))
    y0, y1 = max(0, min(y0, y1)), min(h, max(y0, y1))
    for y in range(y0, y1):
        row = (y * w + x0) * 4
        img[row:row + (x1-x0)*4] = bytes(color) * (x1-x0)

def circle(img: bytearray, w: int, h: int, cx: int, cy: int, r: int, color) -> None:
    r2 = r * r
    for y in range(max(0, cy-r), min(h, cy+r+1)):
        dy = y - cy
        dxmax = int((r2 - dy*dy) ** 0.5)
        x0, x1 = max(0, cx - dxmax), min(w, cx + dxmax + 1)
        row = (y * w + x0) * 4
        img[row:row + (x1-x0)*4] = bytes(color) * (x1-x0)

def ellipse(img: bytearray, w: int, h: int, cx: int, cy: int, rx: int, ry: int, color) -> None:
    for y in range(max(0, cy-ry), min(h, cy+ry+1)):
        dy = (y - cy) / max(1, ry)
        dxmax = int(rx * max(0.0, 1 - dy*dy) ** 0.5)
        x0, x1 = max(0, cx - dxmax), min(w, cx + dxmax + 1)
        row = (y * w + x0) * 4
        img[row:row + (x1-x0)*4] = bytes(color) * (x1-x0)

def line(img: bytearray, w: int, h: int, x0: int, y0: int, x1: int, y1: int, color, thickness=4) -> None:
    dx = abs(x1-x0)
    dy = -abs(y1-y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        for yy in range(y0-thickness//2, y0+thickness//2+1):
            for xx in range(x0-thickness//2, x0+thickness//2+1):
                set_px(img, w, h, xx, yy, color)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy

def polygon(img: bytearray, w: int, h: int, pts, color) -> None:
    min_y = max(0, int(min(y for x, y in pts)))
    max_y = min(h - 1, int(max(y for x, y in pts)))
    for y in range(min_y, max_y + 1):
        xs = []
        for i in range(len(pts)):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % len(pts)]
            if (y1 <= y < y2) or (y2 <= y < y1):
                if y2 != y1:
                    x = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
                    xs.append(x)
        xs.sort()
        for j in range(0, len(xs), 2):
            if j + 1 < len(xs):
                x0 = max(0, int(xs[j]))
                x1 = min(w, int(xs[j+1]) + 1)
                row = (y * w + x0) * 4
                img[row:row + (x1-x0)*4] = bytes(color) * (x1-x0)

def make_school_icon(path: Path) -> None:
    w = h = 512
    img = canvas(w, h, (0,0,0,0))
    circle(img, w, h, 256, 256, 230, (255,255,255,230))
    dark = (3,43,145,255)
    blue = (20,136,219,255)
    sky = (96,181,231,255)
    polygon(img, w, h, [(256,42),(398,128),(398,260),(256,342),(114,260),(114,128)], dark)
    polygon(img, w, h, [(256,70),(373,140),(373,246),(256,314),(139,246),(139,140)], blue)
    polygon(img, w, h, [(256,70),(373,140),(256,214),(139,140)], sky)
    rect(img, w, h, 184, 214, 328, 312, (255,255,255,255))
    rect(img, w, h, 204, 238, 308, 262, dark)
    rect(img, w, h, 204, 272, 308, 288, dark)
    write_png(path, w, h, img)

def make_bee(path: Path, variant="main") -> None:
    w = h = 512
    img = canvas(w, h, (0,0,0,0))
    ellipse(img, w, h, 178, 260, 92, 135, (173,224,242,170))
    ellipse(img, w, h, 334, 260, 92, 135, (173,224,242,170))
    circle(img, w, h, 256, 156, 105, (255,221,66,255))
    circle(img, w, h, 205, 178, 12, (0,33,90,255))
    circle(img, w, h, 307, 178, 12, (0,33,90,255))
    circle(img, w, h, 188, 205, 18, (255,126,139,220))
    circle(img, w, h, 324, 205, 18, (255,126,139,220))
    line(img, w, h, 224, 218, 246, 236, (0,33,90,255), 5)
    line(img, w, h, 246, 236, 288, 218, (0,33,90,255), 5)
    line(img, w, h, 212, 70, 188, 24, (0,33,90,255), 6)
    line(img, w, h, 300, 70, 324, 24, (0,33,90,255), 6)
    circle(img, w, h, 185, 20, 15, (0,33,90,255))
    circle(img, w, h, 327, 20, 15, (0,33,90,255))
    rect(img, w, h, 162, 266, 350, 402, (212,0,8,255))
    circle(img, w, h, 162, 334, 28, (212,0,8,255))
    circle(img, w, h, 350, 334, 28, (212,0,8,255))
    rect(img, w, h, 210, 402, 240, 462, (3,43,145,255))
    rect(img, w, h, 272, 402, 302, 462, (3,43,145,255))
    rect(img, w, h, 194, 456, 248, 476, (0,33,90,255))
    rect(img, w, h, 264, 456, 318, 476, (0,33,90,255))
    if variant == "study":
        rect(img, w, h, 126, 330, 206, 392, (255,255,255,255))
        rect(img, w, h, 132, 337, 200, 385, (255,248,222,255))
        line(img, w, h, 142, 350, 190, 350, (3,43,145,255), 4)
        line(img, w, h, 142, 370, 190, 370, (3,43,145,255), 4)
    elif variant == "cool":
        rect(img, w, h, 180, 158, 244, 190, (0,33,90,255))
        rect(img, w, h, 268, 158, 332, 190, (0,33,90,255))
        line(img, w, h, 244, 174, 268, 174, (0,33,90,255), 5)
        rect(img, w, h, 330, 310, 398, 382, (20,136,219,255))
    elif variant == "goodluck":
        circle(img, w, h, 120, 316, 28, (255,179,0,255))
        line(img, w, h, 120, 316, 162, 330, (255,179,0,255), 8)
        circle(img, w, h, 390, 316, 28, (255,179,0,255))
        line(img, w, h, 390, 316, 348, 330, (255,179,0,255), 8)
    else:
        line(img, w, h, 116, 342, 166, 298, (3,43,145,255), 10)
        polygon(img, w, h, [(90,304),(128,236),(154,304)], (255,179,0,255))
        polygon(img, w, h, [(110,296),(132,250),(146,296)], (255,85,0,255))
    write_png(path, w, h, img)

def make_icon(path: Path, kind: str) -> None:
    w = h = 256
    img = canvas(w, h, (0,0,0,0))
    red = (212,0,8,255)
    blue = (3,43,145,255)
    orange = (255,179,0,255)
    black = (0,0,0,255)
    white = (255,255,255,255)
    if kind == "calendar":
        rect(img,w,h,45,50,211,210,white); rect(img,w,h,45,50,211,88,red); rect(img,w,h,68,110,100,142,blue); rect(img,w,h,116,110,148,142,orange); rect(img,w,h,164,110,196,142,blue); rect(img,w,h,68,160,100,192,orange); rect(img,w,h,116,160,148,192,blue)
    elif kind == "checklist":
        rect(img,w,h,54,38,202,218,white); rect(img,w,h,70,62,186,82,blue)
        for y in [112,152,192]:
            line(img,w,h,72,y,90,y+16,orange,8); line(img,w,h,90,y+16,122,y-18,orange,8); rect(img,w,h,136,y-10,186,y,blue)
    elif kind == "ticket":
        rect(img,w,h,42,76,214,180,orange); rect(img,w,h,74,104,180,124,white); rect(img,w,h,74,138,160,154,white)
    elif kind == "result":
        circle(img,w,h,128,112,70,orange); rect(img,w,h,82,162,174,222,red); polygon(img,w,h,[(82,222),(108,190),(128,222)],blue); polygon(img,w,h,[(174,222),(148,190),(128,222)],blue); circle(img,w,h,128,112,38,white)
    elif kind == "heart":
        circle(img,w,h,98,105,42,red); circle(img,w,h,158,105,42,red); polygon(img,w,h,[(58,118),(198,118),(128,212)],red)
    elif kind == "book":
        rect(img,w,h,48,58,122,206,blue); rect(img,w,h,134,58,208,206,red); line(img,w,h,128,58,128,206,black,4); rect(img,w,h,66,86,108,100,white); rect(img,w,h,150,86,192,100,white)
    elif kind == "alarm":
        circle(img,w,h,128,136,70,white); line(img,w,h,128,136,128,92,blue,8); line(img,w,h,128,136,166,158,blue,8); circle(img,w,h,128,136,8,red); circle(img,w,h,80,60,28,red); circle(img,w,h,176,60,28,red); rect(img,w,h,85,205,102,230,blue); rect(img,w,h,154,205,171,230,blue)
    else:
        circle(img,w,h,128,128,82,orange); rect(img,w,h,80,112,176,144,white)
    write_png(path, w, h, img)

def make_theme_bees(path: Path) -> None:
    w, h = 900, 280
    img = canvas(w, h, (0,0,0,0))
    for i, x in enumerate(range(70, 850, 150)):
        y = 90 + (i % 2) * 70
        ellipse(img,w,h,x-25,y,32,22,(173,224,242,160))
        ellipse(img,w,h,x+25,y,32,22,(173,224,242,160))
        circle(img,w,h,x,y,34,(255,221,66,255))
        rect(img,w,h,x-22,y+18,x+22,y+58,(212,0,8,255))
        circle(img,w,h,x-12,y-6,4,(0,33,90,255))
        circle(img,w,h,x+12,y-6,4,(0,33,90,255))
        line(img,w,h,x-10,y+10,x+10,y+10,(0,33,90,255),3)
    write_png(path, w, h, img)

def make_sparkles(path: Path) -> None:
    w, h = 500, 500
    img = canvas(w,h,(0,0,0,0))
    orange=(255,179,0,255); red=(212,0,8,255); blue=(20,136,219,255)
    for cx, cy, s, c in [(80,90,34,orange),(220,70,22,blue),(380,120,30,red),(120,300,26,red),(330,330,38,orange),(420,430,24,blue)]:
        polygon(img,w,h,[(cx,cy-s),(cx+s//3,cy-s//3),(cx+s,cy),(cx+s//3,cy+s//3),(cx,cy+s),(cx-s//3,cy+s//3),(cx-s,cy),(cx-s//3,cy-s//3)],c)
    write_png(path,w,h,img)

def make_corner_checkers(path: Path) -> None:
    w, h = 360, 360
    img = canvas(w,h,(0,0,0,0))
    colors = [(212,0,8,255),(163,28,10,255),(255,255,255,0)]
    cell = 48
    for y in range(0,h,cell):
        for x in range(0,w,cell):
            idx = ((x//cell)+(y//cell)) % 3
            if idx != 2 and (x < 220 or y < 220):
                rect(img,w,h,x,y,x+cell,y+cell,colors[idx])
    write_png(path,w,h,img)

POSTS = [
    {"no":"01","slug":"tnthpt-registration-deadline","date":"03/05/2026","phase":"TN THPT 2026","tag":"NHẮC DEADLINE","title":"ĐỪNG ĐỂ LỠ HẠN","subtitle":"Kiểm tra đăng ký dự thi TN THPT trước 17:00 ngày 05/05","points":["Đăng nhập hệ thống và kiểm tra thông tin cá nhân","Soát môn thi, khu vực, đối tượng ưu tiên","Báo ngay giáo viên nếu phát hiện sai sót"],"cta":"Lưu bài này và gửi cho bạn cùng lớp.","icon":"alarm.png","bee":"bee-main.png"},
    {"no":"02","slug":"dgnl-admission-ticket","date":"16/05/2026","phase":"ĐGNL ĐỢT 2","tag":"GIẤY BÁO DỰ THI","title":"KIỂM TRA NGAY","subtitle":"Đừng đợi sát ngày thi mới xem địa điểm và thông tin cá nhân","points":["Kiểm tra họ tên, số báo danh, phòng thi","Lưu địa điểm thi vào điện thoại","Chuẩn bị CCCD và vật dụng cần thiết"],"cta":"Tag người hay quên để nhắc nhau.","icon":"ticket.png","bee":"bee-cool.png"},
    {"no":"03","slug":"dgnl-checklist","date":"21/05/2026","phase":"ĐGNL ĐỢT 2","tag":"CHECKLIST","title":"TRƯỚC NGÀY THI","subtitle":"Mang đủ, ngủ đủ, đến sớm — vậy là ổn áp hơn 50%","points":["CCCD / giấy tờ tùy thân","Giấy báo dự thi hoặc thông tin phòng thi","Bút, nước, đồng hồ thường nếu được phép","Có mặt sớm hơn giờ gọi ít nhất 30 phút"],"cta":"Chụp màn hình checklist này.","icon":"checklist.png","bee":"bee-study.png"},
    {"no":"04","slug":"dgnl-good-luck","date":"23/05/2026","phase":"ĐGNL ĐỢT 2","tag":"LỜI CHÚC","title":"MAI THI RỒI","subtitle":"Bình tĩnh đọc đề, làm chắc từng câu, BKFC NHC tin bạn làm được","points":["Tối nay đừng thức quá khuya","Chuẩn bị đồ từ trước khi ngủ","Không so đáp án linh tinh trước giờ thi"],"cta":"Thả một chú ong lấy vía tự tin.","icon":"heart.png","bee":"bee-goodluck.png"},
    {"no":"05","slug":"dgnl-test-day","date":"24/05/2026","phase":"ĐGNL ĐỢT 2","tag":"HÔM NAY THI","title":"CHÚC SĨ TỬ VỮNG TÂM","subtitle":"Đi chậm một chút, đọc kỹ một chút, tự tin thêm một chút","points":["Kiểm tra giấy tờ trước khi ra khỏi nhà","Đến điểm thi sớm","Giữ bình tĩnh khi gặp câu khó"],"cta":"BKFC NHC chúc bạn thi thật tốt!","icon":"calendar.png","bee":"bee-main.png"},
    {"no":"06","slug":"tnthpt-one-week-checklist","date":"04/06/2026","phase":"TN THPT 2026","tag":"1 TUẦN CUỐI","title":"ÔN GỌN - NGỦ ĐỦ","subtitle":"Tuần cuối không phải để học lại tất cả, mà để giữ phong độ","points":["Ôn trọng tâm theo đề cương","Sửa lỗi sai cũ","Ngủ đều giờ","Không đổi phương pháp quá gấp"],"cta":"Gửi cho đứa bạn đang cày quá sức.","icon":"book.png","bee":"bee-study.png"},
    {"no":"07","slug":"dgnl-result-next-steps","date":"06/06/2026","phase":"ĐGNL ĐỢT 2","tag":"SAU KHI CÓ ĐIỂM","title":"BƯỚC TIẾP THEO LÀ GÌ?","subtitle":"Có điểm rồi, đừng hoang mang — hãy kiểm tra từng bước","points":["Lưu giấy báo điểm điện tử","So sánh với nguyện vọng dự kiến","Theo dõi thông tin xét tuyển chính thức","Hỏi khi chưa rõ, đừng tự đoán"],"cta":"Comment câu hỏi để BKFC NHC hỗ trợ.","icon":"result.png","bee":"bee-cool.png"},
    {"no":"08","slug":"tnthpt-final-checklist","date":"09/06/2026","phase":"TN THPT 2026","tag":"FINAL CHECKLIST","title":"TRƯỚC KHI VÀO THI","subtitle":"Một checklist ngắn để bạn không bỏ sót thứ quan trọng","points":["CCCD / thẻ dự thi","Bút viết, bút chì, tẩy, máy tính được phép","Nước uống, áo khoác mỏng nếu cần","Xem trước đường đi đến điểm thi"],"cta":"Lưu lại ngay, đừng tin trí nhớ lúc run.","icon":"checklist.png","bee":"bee-study.png"},
    {"no":"09","slug":"tnthpt-night-before","date":"10/06/2026","phase":"TN THPT 2026","tag":"ĐÊM TRƯỚC NGÀY THI","title":"NGỦ SỚM NHA","subtitle":"Bạn đã đi rất xa rồi. Ngày mai chỉ cần bình tĩnh thể hiện thôi","points":["Xếp sẵn đồ vào một túi","Đặt báo thức kép","Không học thêm quá khuya","Tin vào quá trình của mình"],"cta":"BKFC NHC gửi bạn một cái ôm tinh thần.","icon":"heart.png","bee":"bee-goodluck.png"},
    {"no":"10","slug":"tnthpt-test-day-one","date":"11/06/2026","phase":"TN THPT 2026","tag":"NGÀY 1","title":"VỮNG TÂM VÀO PHÒNG THI","subtitle":"Làm chắc phần mình biết, không để một câu khó kéo tâm trạng xuống","points":["Đọc kỹ yêu cầu đề","Phân bổ thời gian hợp lý","Không hoảng khi gặp câu lạ"],"cta":"Chúc các sĩ tử Nguyễn Hữu Cảnh thi thật tốt!","icon":"calendar.png","bee":"bee-main.png"},
    {"no":"11","slug":"tnthpt-test-day-two","date":"12/06/2026","phase":"TN THPT 2026","tag":"NGÀY 2","title":"CỐ THÊM MỘT CHÚT","subtitle":"Chặng cuối rồi, giữ nhịp ổn định đến phút cuối cùng","points":["Ăn sáng nhẹ, đủ năng lượng","Đến điểm thi sớm","Thi xong môn nào, tạm gác môn đó"],"cta":"BKFC NHC luôn ở đây tiếp sức cho bạn.","icon":"calendar.png","bee":"bee-cool.png"},
    {"no":"12","slug":"tnthpt-result-day","date":"01/07/2026","phase":"TN THPT 2026","tag":"TRA CỨU KẾT QUẢ","title":"CÓ ĐIỂM RỒI!","subtitle":"Bình tĩnh xem điểm, lưu lại kết quả và chuẩn bị bước xét tuyển tiếp theo","points":["Tra cứu từ nguồn chính thức","Chụp/lưu kết quả","Theo dõi mốc phúc khảo nếu cần","Rà lại nguyện vọng xét tuyển"],"cta":"Có thắc mắc cứ nhắn BKFC NHC.","icon":"result.png","bee":"bee-main.png"},
]

CSS = """
:root{--red:#D40008;--deep-red:#A51D0F;--blue:#030391;--sky:#1488DB;--orange:#FFAF00;--yellow:#FFE564;--cream:#FFF7E6;--ink:#09225A}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#1b1b1b;font-family:Arial,Helvetica,sans-serif;display:grid;place-items:center}
.poster{width:1080px;height:1350px;position:relative;overflow:hidden;background:linear-gradient(rgba(255,255,255,.82),rgba(255,255,255,.82)),repeating-linear-gradient(0deg,transparent 0 37px,rgba(185,80,80,.22) 38px 40px),repeating-linear-gradient(90deg,transparent 0 37px,rgba(185,80,80,.22) 38px 40px),var(--cream);color:var(--ink)}
.checker-top,.checker-bottom{position:absolute;left:0;right:0;height:82px;z-index:5;background:linear-gradient(45deg,var(--red) 25%,transparent 25%) 0 0/56px 56px,linear-gradient(45deg,transparent 75%,var(--red) 75%) 0 0/56px 56px,linear-gradient(45deg,transparent 75%,var(--deep-red) 75%) 28px 28px/56px 56px,linear-gradient(45deg,var(--deep-red) 25%,transparent 25%) 28px 28px/56px 56px,#fff}
.checker-top{top:0}.checker-bottom{bottom:0}
.school-logo{position:absolute;top:108px;left:72px;width:118px;height:118px;object-fit:contain;background:#fff;padding:14px;border-radius:28px;box-shadow:0 12px 0 rgba(9,34,90,.12);z-index:20}
.brand-text{position:absolute;top:112px;left:210px;right:70px;height:92px;display:flex;flex-direction:column;justify-content:center;z-index:20}
.brand-text .small{font-weight:900;font-size:28px;letter-spacing:1px;color:var(--blue)}
.brand-text .big{font-weight:900;font-size:44px;color:var(--red);text-transform:uppercase}
.season-pill{position:absolute;top:232px;left:72px;right:72px;display:flex;justify-content:space-between;align-items:center;gap:20px;z-index:20}
.phase{background:var(--blue);color:white;padding:18px 28px;font-weight:900;border-radius:24px;font-size:28px;letter-spacing:.6px}
.date{background:#fff;border:5px solid var(--orange);color:var(--deep-red);padding:14px 24px;font-weight:900;border-radius:24px;font-size:34px;box-shadow:9px 9px 0 rgba(212,0,8,.15)}
.tag{position:absolute;top:326px;left:88px;z-index:20;transform:rotate(-2deg);display:inline-block;background:var(--yellow);border:5px solid var(--orange);color:var(--deep-red);padding:16px 26px;border-radius:20px;font-size:31px;font-weight:900;text-transform:uppercase}
.title-panel{position:absolute;top:408px;left:72px;width:936px;z-index:18;background:var(--red);border-radius:62px;padding:42px 52px 50px;color:#fff;box-shadow:18px 18px 0 rgba(3,43,145,.16);transform:rotate(-1.5deg)}
.title{font-size:86px;line-height:.94;margin:0;font-weight:1000;letter-spacing:-2px;text-transform:uppercase;text-shadow:4px 4px 0 rgba(0,0,0,.15)}
.subtitle{margin:24px 0 0;font-size:37px;line-height:1.2;font-weight:800}
.content-card{position:absolute;left:72px;right:72px;top:720px;min-height:390px;z-index:18;background:rgba(255,255,255,.94);border:6px solid var(--orange);border-radius:36px;padding:44px 42px 38px;box-shadow:14px 14px 0 rgba(212,0,8,.15)}
.icon-box{position:absolute;right:44px;top:-78px;width:156px;height:156px;border-radius:36px;background:#fff;padding:24px;border:6px solid var(--blue);box-shadow:10px 10px 0 rgba(3,43,145,.15)}
.icon-box img{width:100%;height:100%;object-fit:contain}
.point{display:grid;grid-template-columns:54px 1fr;gap:18px;align-items:start;margin:0 0 23px;font-size:32px;font-weight:800;line-height:1.2}
.point::before{content:"";width:42px;height:42px;margin-top:-1px;background:var(--red);border:8px solid var(--orange);border-radius:50%;box-shadow:5px 5px 0 rgba(3,43,145,.12)}
.cta{margin-top:28px;background:var(--blue);color:#fff;border-radius:24px;padding:22px 28px;font-size:31px;line-height:1.18;font-weight:900}
.bee{position:absolute;width:285px;right:38px;bottom:88px;z-index:22;filter:drop-shadow(10px 16px 0 rgba(9,34,90,.12))}
.theme-bees{position:absolute;left:50px;bottom:82px;width:580px;opacity:.22;z-index:10}
.sparkles{position:absolute;left:-40px;top:865px;width:250px;opacity:.65;z-index:12}
.corner-a,.corner-b{position:absolute;width:250px;height:250px;z-index:8;opacity:.95}
.corner-a{right:0;top:82px}.corner-b{left:0;bottom:82px;transform:rotate(180deg)}
.footer{position:absolute;left:76px;bottom:112px;width:640px;z-index:20;color:#111;font-weight:900;font-size:23px;line-height:1.35;text-transform:uppercase}
.footer span{color:var(--red)}
.safe-note{position:absolute;top:1270px;left:0;right:0;text-align:center;font-size:18px;color:rgba(0,0,0,.42);z-index:30}
@media print{body{background:white}.poster{transform:none}}
"""

def html_poster(post: dict) -> str:
    points = "\n".join(f'<div class="point"><span>{html.escape(p)}</span></div>' for p in post["points"])
    return f"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1080, initial-scale=1">
<title>{post['no']} - {html.escape(post['title'])}</title>
<style>{CSS}</style>
</head>
<body>
<main class="poster">
<div class="checker-top"></div><div class="checker-bottom"></div>
<img class="corner-a" src="../assets/theme/checker-corner.png" alt="">
<img class="corner-b" src="../assets/theme/checker-corner.png" alt="">
<img class="school-logo" src="../assets/school-icon.png" alt="School icon PNG placeholder">
<section class="brand-text"><div class="small">BKFC NGUYỄN HỮU CẢNH</div><div class="big">Tôi Yêu Bách Khoa</div></section>
<section class="season-pill"><div class="phase">{html.escape(post['phase'])}</div><div class="date">{html.escape(post['date'])}</div></section>
<div class="tag">{html.escape(post['tag'])}</div>
<section class="title-panel"><h1 class="title">{html.escape(post['title'])}</h1><p class="subtitle">{html.escape(post['subtitle'])}</p></section>
<section class="content-card"><div class="icon-box"><img src="../assets/icons/{post['icon']}" alt=""></div>{points}<div class="cta">{html.escape(post['cta'])}</div></section>
<img class="sparkles" src="../assets/theme/yellow-sparkles.png" alt="">
<img class="theme-bees" src="../assets/theme/theme-bees.png" alt="">
<img class="bee" src="../assets/illustrations/{post['bee']}" alt="Bee PNG placeholder">
<div class="footer"><span>#BKFC</span> #ToiYeuBachKhoa #HCMUT<br>#BKFCNguyenHuuCanh #BKFCNHC</div>
<div class="safe-note">PNG assets only • replace files in /assets with your final PNG resources</div>
</main>
</body>
</html>"""

def caption(post: dict) -> str:
    lines = [f"📌 {post['tag']} | {post['phase']}", "", post["subtitle"], ""]
    lines.extend([f"• {p}" for p in post["points"]])
    lines += ["", f"👉 {post['cta']}", "", "#BKFC #ToiYeuBachKhoa #HCMUT #BKFCNguyenHuuCanh #BKFCNHC #THPTNguyenHuuCanh #TuyenSinh2026"]
    return "\n".join(lines)

def build(root: Path) -> None:
    for folder in ["html","captions","assets","assets/icons","assets/illustrations","assets/theme","exports","tools"]:
        (root / folder).mkdir(parents=True, exist_ok=True)

    make_school_icon(root / "assets" / "school-icon.png")
    make_bee(root / "assets" / "illustrations" / "bee-main.png", "main")
    make_bee(root / "assets" / "illustrations" / "bee-study.png", "study")
    make_bee(root / "assets" / "illustrations" / "bee-cool.png", "cool")
    make_bee(root / "assets" / "illustrations" / "bee-goodluck.png", "goodluck")
    make_theme_bees(root / "assets" / "theme" / "theme-bees.png")
    make_sparkles(root / "assets" / "theme" / "yellow-sparkles.png")
    make_corner_checkers(root / "assets" / "theme" / "checker-corner.png")
    for kind in ["calendar", "checklist", "ticket", "result", "heart", "book", "alarm"]:
        make_icon(root / "assets" / "icons" / f"{kind}.png", kind)

    for post in POSTS:
        filename = f"{post['no']}-{post['slug']}"
        (root / "html" / f"{filename}.html").write_text(html_poster(post), encoding="utf-8")
        (root / "captions" / f"{filename}.txt").write_text(caption(post), encoding="utf-8")

    with (root / "schedule.csv").open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["No", "Date", "Phase", "Post", "HTML", "Caption", "Icon PNG", "Bee PNG"])
        for post in POSTS:
            filename = f"{post['no']}-{post['slug']}"
            writer.writerow([post["no"], post["date"], post["phase"], post["title"], f"html/{filename}.html", f"captions/{filename}.txt", f"assets/icons/{post['icon']}", f"assets/illustrations/{post['bee']}"])

    cards = []
    for post in POSTS:
        filename = f"{post['no']}-{post['slug']}"
        cards.append(f"""
<a class="card" href="html/{filename}.html" target="_blank">
  <div class="date">{html.escape(post['date'])}</div>
  <div class="tag">{html.escape(post['phase'])}</div>
  <h2>{post['no']}. {html.escape(post['title'])}</h2>
  <p>{html.escape(post['subtitle'])}</p>
  <code>{filename}.html</code>
</a>""")
    index = f"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BKFC NHC Poster Index</title>
<style>
body{{font-family:Arial,Helvetica,sans-serif;margin:0;background:#fff7e6;color:#09225A}}
header{{padding:34px 44px;background:#D40008;color:white}}
header h1{{margin:0;font-size:42px}} header p{{margin:10px 0 0;font-size:18px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;padding:28px}}
.card{{display:block;text-decoration:none;color:#09225A;background:white;border:4px solid #FFAF00;border-radius:24px;padding:22px;box-shadow:9px 9px 0 rgba(212,0,8,.16)}}
.card h2{{margin:12px 0 8px;color:#D40008;font-size:26px}}
.card p{{font-weight:700;line-height:1.35}}
.date{{display:inline-block;background:#030391;color:white;padding:8px 12px;border-radius:12px;font-weight:900;margin-right:8px}}
.tag{{display:inline-block;background:#FFE564;color:#A51D0F;padding:8px 12px;border-radius:12px;font-weight:900}}
code{{display:block;background:#f3f3f3;padding:9px;border-radius:10px;overflow:auto}}
.note{{padding:0 44px 32px;font-size:18px;line-height:1.5}}
</style>
</head>
<body>
<header><h1>BKFC NHC — Low-effort Exam Poster Pack</h1><p>Red/white checker moodboard, grid-paper background, bee key visual, PNG-only assets. School icon only; no club icon.</p></header>
<div class="grid">{''.join(cards)}</div>
<section class="note"><b>Replace PNG resources:</b> overwrite <code>assets/school-icon.png</code>, <code>assets/illustrations/*.png</code>, <code>assets/icons/*.png</code>, and <code>assets/theme/*.png</code>. Keep the same filenames and the HTML updates automatically.</section>
</body>
</html>"""
    (root / "index.html").write_text(index, encoding="utf-8")

    readme = """BKFC NHC Poster Pack — PNG Moodboard Version

Generated folders:
- html: one HTML poster per post
- captions: caption text files ready to copy
- assets: PNG resources only
- exports: optional PNG poster exports
- tools: Python builder and export helper

Important:
1. There is ONLY one logo placeholder: assets/school-icon.png
2. There is NO club-icon file and no club-icon reference in the HTML.
3. All image resources are PNG. No SVG files are generated.
4. To replace resources, keep the same filename:
   - assets/school-icon.png
   - assets/illustrations/bee-main.png
   - assets/illustrations/bee-study.png
   - assets/illustrations/bee-cool.png
   - assets/illustrations/bee-goodluck.png
   - assets/theme/theme-bees.png
   - assets/theme/yellow-sparkles.png
   - assets/theme/checker-corner.png
   - assets/icons/*.png

How to use:
1. Open index.html
2. Click a poster
3. Replace PNG assets if needed
4. Copy caption from captions folder
5. Optional: run tools\\Export-Posters-With-Edge.ps1 to export poster PNG screenshots
"""
    (root / "README.txt").write_text(readme, encoding="utf-8")

    export_ps1 = r"""$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$HtmlDir = Join-Path $Root "html"
$ExportDir = Join-Path $Root "exports"
New-Item -ItemType Directory -Force -Path $ExportDir | Out-Null

$Candidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
)

$Browser = $Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Browser) {
  throw "Could not find Microsoft Edge or Google Chrome. Open the HTML manually and screenshot/export instead."
}

Get-ChildItem $HtmlDir -Filter "*.html" | ForEach-Object {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
  $out = Join-Path $ExportDir ($name + ".png")
  $url = "file:///" + ($_.FullName -replace "\\","/")
  & $Browser --headless --disable-gpu --hide-scrollbars --screenshot="$out" --window-size=1080,1350 "$url" | Out-Null
  Write-Host "Exported $out"
}

Write-Host ""
Write-Host "Done. PNG poster exports are in: $ExportDir"
"""
    (root / "tools" / "Export-Posters-With-Edge.ps1").write_text(export_ps1, encoding="utf-8")

    print(f"BKFC poster pack generated at: {root}")
    print("Open index.html to preview.")
    print("All resources are PNG. No club icon generated.")

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(Path.home() / "Desktop" / "BKFC post"))
    args = parser.parse_args()
    build(Path(args.root))

if __name__ == "__main__":
    main()

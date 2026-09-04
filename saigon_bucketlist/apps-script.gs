/* ============================================================
   So Ve - Google Apps Script
   So ve gio chi chua CHO DE GHE o Sai Gon. Khong con cot `loai`,
   `category` la phan loai duy nhat.

   Dan de len TOAN BO code cu trong Apps Script editor, roi chay theo thu tu:
     1. previewCleanup()     -> chi in ra se sua gi, khong dong vao du lieu
     2. ensureColumns()      -> them cot lat / lng / visits neu chua co (an toan)
     3. cleanUpAndLabel()    -> gan/kiem lai nhan category cho moi hang (an toan)
     4. removeLoaiColumn()   -> XOA cot `loai` (KHONG hoan tac duoc)
     5. Deploy > Manage deployments > Edit (but chi) > Version: New version > Deploy
        (giu nguyen URL /exec dang dung trong index.html)
   Nen File > Make a copy de sao luu truoc khi chay buoc 4.
   ============================================================ */

var VALID_CATEGORIES = ['eat', 'hangout', 'casual', 'adventure', 'culture', 'selfcare'];
var DEFAULT_CATEGORY = 'casual';

/* Cot app can co. `visits` la nhat ky ghe, moi dong "dd/MM HH:mm|ten".
   `lat`/`lng` dung cho ban do va bo loc "gan toi". */
var REQUIRED_COLUMNS = ['category', 'lat', 'lng', 'visits'];

/* id -> category cho 49 cho hien co tren Sheet. */
var CATEGORY_MAP = {
  // --- 18 dia diem co san trong app ---
  'sg-1': 'adventure',                 // Ngắm hoàng hôn ở Bitexco Skydeck
  'sg-2': 'adventure',                 // Đài quan sát Landmark 81 Skyview
  'sg-3': 'hangout',                   // Dạo phố đi bộ Nguyễn Huệ buổi tối
  'sg-4': 'hangout',                   // Khám phá phố Tây Bùi Viện
  'sg-5': 'eat',                       // Dạo chợ Bến Thành
  'sg-6': 'eat',                       // Cà phê ngắm Hồ Con Rùa
  'sg-7': 'casual',                    // Thăm Thảo Cầm Viên Sài Gòn
  'sg-8': 'adventure',                 // Chơi cả ngày ở Đầm Sen
  'sg-9': 'adventure',                 // Khám phá Suối Tiên
  'sg-10': 'culture',                  // Tham quan Địa đạo Củ Chi
  'sg-11': 'culture',                  // Bảo tàng Chứng tích Chiến tranh
  'sg-12': 'culture',                  // Check-in Nhà thờ Đức Bà & Bưu điện Thành phố
  'sg-13': 'adventure',                // Đi thuyền buýt sông Sài Gòn (Waterbus)
  'sg-14': 'hangout',                  // Trượt băng ở Vincom Ice Rink Landmark 81
  'sg-15': 'casual',                   // Dạo & tập thể dục ở Công viên Tao Đàn
  'sg-16': 'culture',                  // Tham quan Dinh Độc Lập
  'sg-17': 'culture',                  // Ngắm tranh ở Bảo tàng Mỹ thuật TP.HCM
  'sg-18': 'adventure',                // Chèo SUP / đạp xe quanh Bán đảo Thanh Đa
  // --- 31 cho da them vao ---
  'custom-1788238515655-27': 'culture', // Di bao tang
  'custom-1788244215355': 'eat',       // Nem Nuong Nha Trang Co Diep
  'custom-1788324262051-0': 'eat',     // Fast Feel
  'custom-1788324265486-1': 'eat',     // Elan Cafe
  'custom-1788324269070-2': 'eat',     // BanTianYao
  'custom-1788324273088-3': 'eat',     // Buffet Cuon
  'custom-1788324275837-4': 'eat',     // Banh trang nuong co Thao
  'custom-1788324278400-5': 'eat',     // My Quang Phu Chiem
  'custom-1788324280840-6': 'eat',     // Mi Tron - Bun Thai ALuan
  'custom-1788324283357-7': 'eat',     // Hyakumi Ramen
  'custom-1788324286699-8': 'eat',     // Banh uot chong dia
  'custom-1788324290074-9': 'eat',     // Tra Nha Buoi Plus
  'custom-1788324292731-10': 'eat',    // Tiem Mi A Chinh
  'custom-1788324324407-11': 'eat',    // Lau 69K Ho Gia
  'custom-1788324328880-12': 'eat',    // Banh ep Hue Go Vap
  'custom-1788324331297-13': 'eat',    // Quan Chay Thong Dong
  'custom-1788324334053-14': 'eat',    // Daddy Cool Diner
  'custom-1788507372489-0': 'hangout', // Couplecinema 3 Thang 2
  'custom-1788507376059-1': 'eat',     // Cafe Sai Gon Xua 3 Thang 2
  'custom-1788507378594-2': 'eat',     // The Thousand Beans - Lab Coffee
  'custom-1788507382185-3': 'eat',     // Chu Tuyen - ca phe nghe thuat
  'custom-1788507386183-4': 'eat',     // Thai Market Restaurant
  'custom-1788507389187-5': 'eat',     // Aroy Thai
  'custom-1788507392177-6': 'eat',     // Oc Han
  'custom-1788507398185-7': 'eat',     // RASA - Buffet Lau
  'custom-1788507401190-8': 'hangout', // TTTM Van Hanh
  'custom-1788507404191-9': 'eat',     // O Bun Cha - Quan 10
  'custom-1788507408182-10': 'hangout', // Aeon Mall Binh Tan
  'custom-1788507411189-11': 'eat',    // Nha Hang Chay Nhan Duyen
  'custom-1788507415188-12': 'casual', // Vuon Lan Ten Lua
  'custom-1788507419182-13': 'eat',    // Panda Ten Lua
};

/* ---------- Web app API ---------- */

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
  var rows = data.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    if (!obj.category) obj.category = DEFAULT_CATEGORY;
    return obj;
  });
  return json({ ok: true, items: rows });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idCol = headers.indexOf('id');

    if (body.action === 'update') {
      var rowIndex = -1;
      for (var i = 1; i < data.length; i++) {
        if (data[i][idCol] === body.id) { rowIndex = i; break; }
      }
      if (rowIndex === -1) return json({ ok: false, error: 'not_found' });

      ['trangthai', 'danhgia', 'ghichu', 'category', 'lat', 'lng', 'visits'].forEach(function (field) {
        if (body[field] !== undefined) {
          var col = headers.indexOf(field);
          if (col > -1) sheet.getRange(rowIndex + 1, col + 1).setValue(body[field]);
        }
      });
      return json({ ok: true });
    }

    if (body.action === 'add') {
      ensureColumns_(sheet);
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (!body.category || VALID_CATEGORIES.indexOf(body.category) === -1) {
        body.category = DEFAULT_CATEGORY;
      }
      // Cot nao khong co trong body thi de trong -- ke ca `loai` neu ban chua xoa cot do.
      var newRow = headers.map(function (h) {
        return body[h] !== undefined ? body[h] : '';
      });
      sheet.appendRow(newRow);
      return json({ ok: true });
    }

    return json({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Bao tri: chay tay tu Apps Script editor ---------- */

/** Them bat ky cot nao trong REQUIRED_COLUMNS con thieu. Chay lai duoc nhieu lan. */
function ensureColumns_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var added = [];
  REQUIRED_COLUMNS.forEach(function (name) {
    if (headers.indexOf(name) > -1) return;
    var lastCol = sheet.getLastColumn();
    sheet.insertColumnAfter(lastCol);
    sheet.getRange(1, lastCol + 1).setValue(name);
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    added.push(name);
  });
  return added;
}

/** BUOC 2 - an toan. Them cot lat / lng / visits neu Sheet chua co. */
function ensureColumns() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var added = ensureColumns_(sheet);
  Logger.log(added.length ? 'Da them cot: ' + added.join(', ') : 'Du cot roi, khong can them gi.');
  return added.length ? 'Da them ' + added.join(', ') : 'Khong can them';
}

/** BUOC 1 - chi in ra, khong dong vao du lieu. */
function previewCleanup() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id'), tenCol = headers.indexOf('ten');
  var loaiCol = headers.indexOf('loai');

  var unmapped = [], blank = [];
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][idCol]).trim();
    if (!id) continue;
    if (!CATEGORY_MAP[id]) unmapped.push(id + ' (' + data[i][tenCol] + ')');
    var catCol = headers.indexOf('category');
    if (catCol > -1 && !String(data[i][catCol]).trim()) blank.push(id);
  }

  var missing = REQUIRED_COLUMNS.filter(function (c) { return headers.indexOf(c) === -1; });
  Logger.log('Tong hang: %s', data.length - 1);
  Logger.log('Cot con thieu: %s', missing.length ? missing.join(', ') + ' -- chay ensureColumns()' : 'khong thieu cot nao');
  Logger.log('Cot `loai`: %s', loaiCol > -1
    ? 'con o cot ' + (loaiCol + 1) + ' -- removeLoaiColumn() se xoa han'
    : 'da xoa roi');
  if (unmapped.length) Logger.log('Chua co trong CATEGORY_MAP (se dat casual): %s', unmapped.join(' | '));
  else Logger.log('Moi hang deu co trong CATEGORY_MAP.');
  if (blank.length) Logger.log('Hang dang trong nhan category: %s', blank.join(', '));
  return (data.length - 1) + ' hang';
}

/**
 * BUOC 2 - an toan, chay lai bao nhieu lan cung duoc.
 * Them cot `category` neu chua co, roi ghi nhan cho tung hang theo CATEGORY_MAP.
 * Hang la (vd. moi them tay tren Sheet) giu nguyen nhan dang co, chi hang trong
 * moi bi dat ve 'casual' -- de khong de len nhan ban tu sua.
 */
function cleanUpAndLabel() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  ensureColumns_(sheet);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var catCol = headers.indexOf('category') + 1;

  var idCol = headers.indexOf('id') + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Sheet rong';

  var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  var cur = sheet.getRange(2, catCol, lastRow - 1, 1).getValues();
  var out = [], mapped = 0, keptOwn = 0, counts = {};

  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i][0]).trim();
    var existing = String(cur[i][0]).trim();
    var cat = CATEGORY_MAP[id];
    if (cat) {
      mapped++;
    } else if (VALID_CATEGORIES.indexOf(existing) > -1) {
      cat = existing; keptOwn++;          // nhan ban tu dat, khong de len
    } else {
      cat = DEFAULT_CATEGORY;
    }
    counts[cat] = (counts[cat] || 0) + 1;
    out.push([cat]);
  }
  sheet.getRange(2, catCol, out.length, 1).setValues(out);

  Logger.log('Theo map: %s | giu nhan san co: %s | tong: %s', mapped, keptOwn, out.length);
  Logger.log('Phan bo: %s', JSON.stringify(counts));
  return 'OK ' + out.length + ' hang';
}

/**
 * BUOC 3 - XOA COT `loai`, KHONG THE HOAN TAC.
 * App khong con doc/ghi cot nay nua. Chay previewCleanup() truoc de xem,
 * va nen File > Make a copy de sao luu.
 */
function removeLoaiColumn() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var loaiCol = headers.indexOf('loai');
  if (loaiCol === -1) {
    Logger.log('Khong tim thay cot `loai` -- co le da xoa roi.');
    return 'Khong co gi de xoa';
  }
  sheet.deleteColumn(loaiCol + 1);
  var after = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('Da xoa cot `loai`. Cac cot con lai: %s', after.join(', '));
  return 'Da xoa cot loai';
}

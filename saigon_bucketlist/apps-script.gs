/* ============================================================
   So Ve - Google Apps Script (ban co cot `category`)
   Dan de len TOAN BO code cu trong Apps Script editor, roi chay theo thu tu:
     1. previewCleanup()      -> chi in ra se sua/xoa nhung gi, khong doi du lieu
     2. fixSaigonIds()        -> doi id sg-58..sg-75 thanh sg-1..sg-18
                                 (dang bi trung voi 18 muc co san trong app)
     3. cleanUpAndLabel()     -> them cot category + gan nhan cho moi hang
     4. removeDuplicateRows() -> xoa 10 hang trung/thua (KHONG hoan tac duoc)
     5. Deploy > Manage deployments > Edit (but chi) > Version: New version > Deploy
        (giu nguyen URL /exec dang dung trong index.html)
   Nen File > Make a copy de sao luu truoc khi chay buoc 2 va 4.
   ============================================================ */

var VALID_CATEGORIES = ['eat', 'hangout', 'casual', 'adventure', 'culture', 'selfcare'];
var DEFAULT_CATEGORY = 'casual';

/* id -> category, doi chieu theo ten + mo ta + mood cua tung hang. */
var CATEGORY_MAP = {
  // --- Dieu nho (base, 57 muc) ---
  'lt-1': 'casual',
  'lt-2': 'eat',
  'lt-3': 'casual',
  'lt-4': 'eat',
  'lt-5': 'casual',
  'lt-6': 'eat',
  'lt-7': 'casual',
  'lt-8': 'eat',
  'lt-9': 'hangout',
  'lt-10': 'selfcare',
  'lt-11': 'hangout',
  'lt-12': 'selfcare',
  'lt-14': 'eat',
  'lt-15': 'selfcare',
  'lt-16': 'selfcare',
  'lt-17': 'selfcare',
  'lt-20': 'eat',
  'lt-21': 'selfcare',
  'lt-22': 'casual',
  'lt-26': 'casual',
  'lt-28': 'adventure',
  'lt-29': 'casual',
  'lt-31': 'eat',
  'lt-33': 'eat',
  'lt-34': 'hangout',
  'lt-36': 'hangout',
  'lt-39': 'selfcare',
  'lt-41': 'eat',
  'lt-44': 'selfcare',
  'lt-45': 'selfcare',
  'lt-46': 'selfcare',
  'lt-47': 'selfcare',
  'lt-48': 'selfcare',
  'lt-49': 'selfcare',
  'lt-50': 'selfcare',
  'lt-51': 'selfcare',
  'lt-52': 'selfcare',
  'lt-53': 'selfcare',
  'lt-54': 'selfcare',
  'lt-55': 'selfcare',
  'lt-56': 'selfcare',
  'lt-58': 'culture',
  'lt-59': 'culture',
  'lt-60': 'culture',
  'lt-61': 'casual',
  'lt-62': 'casual',
  'lt-63': 'culture',
  'lt-69': 'casual',
  'lt-71': 'casual',
  'lt-75': 'casual',
  'lt-76': 'culture',
  'lt-77': 'casual',
  'lt-78': 'eat',
  'lt-79': 'hangout',
  'lt-80': 'adventure',
  'lt-81': 'adventure',
  'lt-82': 'casual',
  // --- Di & choi SG (base, 18 muc) ---
  'sg-1': 'adventure',
  'sg-2': 'adventure',
  'sg-3': 'hangout',
  'sg-4': 'hangout',
  'sg-5': 'eat',
  'sg-6': 'eat',
  'sg-7': 'casual',
  'sg-8': 'adventure',
  'sg-9': 'adventure',
  'sg-10': 'culture',
  'sg-11': 'culture',
  'sg-12': 'culture',
  'sg-13': 'adventure',
  'sg-14': 'hangout',
  'sg-15': 'casual',
  'sg-16': 'culture',
  'sg-17': 'culture',
  'sg-18': 'adventure',
  // --- Cac muc da import them (95 muc) ---
  'custom-1788238515655-27': 'culture',      // Di bao tang
  'custom-1788238515652-13': 'adventure',    // Du lich mot minh
  'custom-1788238515651-10': 'casual',       // Lam hinh nem giay boi
  'custom-1788238515650-8': 'selfcare',      // Cham soc ban than
  'custom-1788238515653-21': 'hangout',      // Viet thu tay
  'custom-1788238515653-18': 'culture',      // Hoc tu vung ngon ngu moi
  'custom-1788238515648-1': 'culture',       // Doc sach
  'custom-1788238515649-5': 'selfcare',      // Don dep va vut bot do dac
  'custom-1788238515655-26': 'selfcare',     // Sap xep lai phong
  'custom-1788238515649-3': 'adventure',     // Di bo duong dai
  'custom-1788238515653-19': 'adventure',    // Di dao bang phuong tien ca nhan
  'custom-1788238515653-20': 'eat',          // Nau an mot minh
  'custom-1788239363543-0': 'selfcare',      // Sua chua bon cau co ban
  'custom-1788239367699-1': 'selfcare',      // Bat/tat lai cau dao dien
  'custom-1788239372187-2': 'adventure',     // Lap lai xich xe dap
  'custom-1788239376187-3': 'selfcare',      // Hoc so cuu CPR
  'custom-1788239379185-4': 'adventure',     // Kich binh ac quy xe hoi
  'custom-1788239383293-5': 'adventure',     // Thay lop xe bi xep
  'custom-1788239386175-6': 'adventure',     // Lai xe so san
  'custom-1788239388790-7': 'selfcare',      // Tap the duc khong can dung cu
  'custom-1788239391741-8': 'selfcare',      // Hieu ve lai suat kep
  'custom-1788239395252-9': 'selfcare',      // Hieu co ban ve thue
  'custom-1788239398252-10': 'selfcare',     // Khau dinh lai cuc ao
  'custom-1788239401199-11': 'selfcare',     // Ui (la) ao so mi
  'custom-1788239404664-12': 'selfcare',     // Khoi dong lai binh nong lanh
  'custom-1788239408818-13': 'adventure',    // Lai xe may
  'custom-1788239411549-14': 'eat',          // Nau bit tet va nuong burger
  'custom-1788239415185-15': 'eat',          // Cat hat luu hanh tay
  'custom-1788239423181-16': 'eat',          // Nau com hoan hao
  'custom-1788239432190-17': 'adventure',    // Doc ban do
  'custom-1788239442380-18': 'adventure',    // Tim huong Bac khong can la ban
  'custom-1788239452740-19': 'adventure',    // Nhom va duy tri lua trai
  'custom-1788239457639-20': 'hangout',      // Bieu dien mot tiet muc van nghe
  'custom-1788239460751-21': 'hangout',      // Ke mot cau chuyen cuoi hay
  'custom-1788239464018-22': 'adventure',    // That cac nut day sinh ton
  'custom-1788239467115-23': 'hangout',      // Dua ra phan hoi xay dung
  'custom-1788239470664-24': 'hangout',      // Phat bieu trong bua tiec
  'custom-1788239474664-25': 'hangout',      // Ghi nho ten nguoi moi gap
  'custom-1788239479142-26': 'hangout',      // Gioi thieu hai nguoi ban voi nhau
  'custom-1788239482355-27': 'selfcare',     // Tu choi kheo cac loi moi
  'custom-1788239486108-28': 'selfcare',     // Xu ly chay dau mo bep
  'custom-1788239506180-29': 'selfcare',     // Cach an mac lich su
  'custom-1788239509183-30': 'hangout',      // Tro chuyen coi mo voi nguoi la
  'custom-1788239514186-31': 'selfcare',     // Nang do nang dung cach
  'custom-1788239517185-32': 'hangout',      // Bat dong quan diem van minh
  'custom-1788239520176-33': 'selfcare',     // Biet cach don nhan loi khen
  'custom-1788239530188-34': 'culture',      // Hoc cach hoc nhung dieu moi
  'custom-1788244215355': 'eat',             // Nem Nuong Nha Trang Co Diep
  'custom-1788324262051-0': 'eat',           // Fast Feel
  'custom-1788324265486-1': 'eat',           // Elan Cafe
  'custom-1788324269070-2': 'eat',           // BanTianYao
  'custom-1788324273088-3': 'eat',           // Buffet Cuon
  'custom-1788324275837-4': 'eat',           // Banh trang nuong co Thao
  'custom-1788324278400-5': 'eat',           // My Quang Phu Chiem
  'custom-1788324280840-6': 'eat',           // Mi Tron - Bun Thai ALuan
  'custom-1788324283357-7': 'eat',           // Hyakumi Ramen
  'custom-1788324286699-8': 'eat',           // Banh uot chong dia
  'custom-1788324290074-9': 'eat',           // Tra Nha Buoi Plus
  'custom-1788324292731-10': 'eat',          // Tiem Mi A Chinh
  'custom-1788324324407-11': 'eat',          // Lau 69K Ho Gia
  'custom-1788324328880-12': 'eat',          // Banh ep Hue Go Vap
  'custom-1788324331297-13': 'eat',          // Quan Chay Thong Dong
  'custom-1788324334053-14': 'eat',          // Daddy Cool Diner
  'custom-1788507372489-0': 'hangout',       // Couplecinema 3 Thang 2
  'custom-1788507376059-1': 'eat',           // Cafe Sai Gon Xua 3 Thang 2
  'custom-1788507378594-2': 'eat',           // The Thousand Beans - Lab Coffee
  'custom-1788507382185-3': 'eat',           // Chu Tuyen - ca phe nghe thuat
  'custom-1788507386183-4': 'eat',           // Thai Market Restaurant
  'custom-1788507389187-5': 'eat',           // Aroy Thai
  'custom-1788507392177-6': 'eat',           // Oc Han
  'custom-1788507398185-7': 'eat',           // RASA - Buffet Lau
  'custom-1788507401190-8': 'hangout',       // TTTM Van Hanh
  'custom-1788507404191-9': 'eat',           // O Bun Cha - Quan 10
  'custom-1788507408182-10': 'hangout',      // Aeon Mall Binh Tan
  'custom-1788507411189-11': 'eat',          // Nha Hang Chay Nhan Duyen
  'custom-1788507415188-12': 'casual',       // Vuon Lan Ten Lua
  'custom-1788507419182-13': 'eat',          // Panda Ten Lua
  'sg-58': 'adventure',                      // id cu cua sg-1
  'sg-59': 'adventure',                      // id cu cua sg-2
  'sg-60': 'hangout',                        // id cu cua sg-3
  'sg-61': 'hangout',                        // id cu cua sg-4
  'sg-62': 'eat',                            // id cu cua sg-5
  'sg-63': 'eat',                            // id cu cua sg-6
  'sg-64': 'casual',                         // id cu cua sg-7
  'sg-65': 'adventure',                      // id cu cua sg-8
  'sg-66': 'adventure',                      // id cu cua sg-9
  'sg-67': 'culture',                        // id cu cua sg-10
  'sg-68': 'culture',                        // id cu cua sg-11
  'sg-69': 'culture',                        // id cu cua sg-12
  'sg-70': 'adventure',                      // id cu cua sg-13
  'sg-71': 'hangout',                        // id cu cua sg-14
  'sg-72': 'casual',                         // id cu cua sg-15
  'sg-73': 'culture',                        // id cu cua sg-16
  'sg-74': 'culture',                        // id cu cua sg-17
  'sg-75': 'adventure',                      // id cu cua sg-18
};

/* Cac hang se bi xoa boi removeDuplicateRows(). */
var ROWS_TO_DELETE = [
  'custom-1788238881680-24',         // trung voi custom-1788239470664-24
  'custom-1788238881679-21',         // trung voi custom-1788239460751-21
  'custom-1788238881675-4',          // trung voi custom-1788239379185-4
  'custom-1788238881676-8',          // trung voi custom-1788239391741-8
  'custom-1788238881682-31',         // trung voi custom-1788239514186-31
  'custom-1788238881674-1',          // trung voi custom-1788239367699-1
  'custom-1788238881677-11',         // trung voi custom-1788239401199-11
  'custom-1788238881679-20',         // trung voi custom-1788239457639-20
  'custom-1788238881681-30',         // trung voi custom-1788239509183-30
  'custom-1788509771285',            // hang test tao nham khi kiem thu form Them muc
];

/* 18 dia diem Sai Gon dang mang id sg-58..sg-75 tren Sheet, nhung trong app
   chung la sg-1..sg-18 -> moi muc hien 2 lan. Doi id ve dung chuan cua app. */
var SG_ID_REMAP = [
  { from: 'sg-58', to: 'sg-1', ten: 'Ngắm hoàng hôn ở Bitexco Skydeck' },
  { from: 'sg-59', to: 'sg-2', ten: 'Đài quan sát Landmark 81 Skyview' },
  { from: 'sg-60', to: 'sg-3', ten: 'Dạo phố đi bộ Nguyễn Huệ buổi tối' },
  { from: 'sg-61', to: 'sg-4', ten: 'Khám phá phố Tây Bùi Viện' },
  { from: 'sg-62', to: 'sg-5', ten: 'Dạo chợ Bến Thành' },
  { from: 'sg-63', to: 'sg-6', ten: 'Cà phê ngắm Hồ Con Rùa' },
  { from: 'sg-64', to: 'sg-7', ten: 'Thăm Thảo Cầm Viên Sài Gòn' },
  { from: 'sg-65', to: 'sg-8', ten: 'Chơi cả ngày ở Đầm Sen' },
  { from: 'sg-66', to: 'sg-9', ten: 'Khám phá Suối Tiên' },
  { from: 'sg-67', to: 'sg-10', ten: 'Tham quan Địa đạo Củ Chi' },
  { from: 'sg-68', to: 'sg-11', ten: 'Bảo tàng Chứng tích Chiến tranh' },
  { from: 'sg-69', to: 'sg-12', ten: 'Check-in Nhà thờ Đức Bà & Bưu điện Thành phố' },
  { from: 'sg-70', to: 'sg-13', ten: 'Đi thuyền buýt sông Sài Gòn (Waterbus)' },
  { from: 'sg-71', to: 'sg-14', ten: 'Trượt băng ở Vincom Ice Rink Landmark 81' },
  { from: 'sg-72', to: 'sg-15', ten: 'Dạo & tập thể dục ở Công viên Tao Đàn' },
  { from: 'sg-73', to: 'sg-16', ten: 'Tham quan Dinh Độc Lập' },
  { from: 'sg-74', to: 'sg-17', ten: 'Ngắm tranh ở Bảo tàng Mỹ thuật TP.HCM' },
  { from: 'sg-75', to: 'sg-18', ten: 'Chèo SUP / đạp xe quanh Bán đảo Thanh Đa' },
];

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

      // 'category' duoc them vao danh sach truong cho phep cap nhat
      ['trangthai', 'danhgia', 'ghichu', 'category'].forEach(function (field) {
        if (body[field] !== undefined) {
          var col = headers.indexOf(field);
          if (col > -1) sheet.getRange(rowIndex + 1, col + 1).setValue(body[field]);
        }
      });
      return json({ ok: true });
    }

    if (body.action === 'add') {
      if (headers.indexOf('category') === -1) addCategoryColumn_(sheet);
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (!body.category || VALID_CATEGORIES.indexOf(body.category) === -1) {
        body.category = DEFAULT_CATEGORY;
      }
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

function addCategoryColumn_(sheet) {
  var lastCol = sheet.getLastColumn();
  sheet.insertColumnAfter(lastCol);
  sheet.getRange(1, lastCol + 1).setValue('category');
  return lastCol + 1;
}

/**
 * BUOC 2 - an toan, chay lai bao nhieu lan cung duoc.
 * Them cot `category` neu chua co, roi ghi nhan cho tung hang theo CATEGORY_MAP.
 * Hang khong nam trong map se lay 'casual' va duoc liet ke ra Logs de xem lai.
 */
function cleanUpAndLabel() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var catCol = headers.indexOf('category') + 1;
  if (catCol === 0) catCol = addCategoryColumn_(sheet);

  var idCol = headers.indexOf('id') + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Sheet rong';

  var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  var out = [], mapped = 0, fallback = [], counts = {};

  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i][0]).trim();
    var cat = CATEGORY_MAP[id];
    if (cat) { mapped++; } else { cat = DEFAULT_CATEGORY; if (id) fallback.push(id); }
    counts[cat] = (counts[cat] || 0) + 1;
    out.push([cat]);
  }
  sheet.getRange(2, catCol, out.length, 1).setValues(out);

  Logger.log('Da gan nhan %s / %s hang.', mapped, out.length);
  Logger.log('Phan bo: %s', JSON.stringify(counts));
  if (fallback.length) {
    Logger.log('Khong co trong CATEGORY_MAP (dat mac dinh casual): %s', fallback.join(', '));
  }
  return 'OK ' + mapped + '/' + out.length;
}

/**
 * BUOC 2 - doi id sg-58..sg-75 thanh sg-1..sg-18.
 * Chi doi khi CA id lan ten deu khop, nen an toan; ten khong khop se bi bo qua
 * va ghi ra Logs de kiem tra tay.
 */
function fixSaigonIds() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id'), tenCol = headers.indexOf('ten');

  var byFrom = {};
  SG_ID_REMAP.forEach(function (m) { byFrom[m.from] = m; });

  var changed = 0, skipped = [];
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][idCol]).trim();
    var m = byFrom[id];
    if (!m) continue;
    if (String(data[i][tenCol]).trim() !== m.ten) {
      skipped.push(id + ' (ten khong khop: ' + data[i][tenCol] + ')');
      continue;
    }
    sheet.getRange(i + 1, idCol + 1).setValue(m.to);
    changed++;
  }
  Logger.log('Da doi id cho %s hang.', changed);
  if (skipped.length) Logger.log('Bo qua: %s', skipped.join(' | '));
  return 'Da doi ' + changed + ' id';
}

/** BUOC 1 - chi in ra se sua/xoa nhung gi, khong dong vao du lieu. */
function previewCleanup() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id'), tenCol = headers.indexOf('ten');

  var byFrom = {};
  SG_ID_REMAP.forEach(function (m) { byFrom[m.from] = m; });

  var willRename = 0, willDelete = 0, unmapped = [];
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][idCol]).trim();
    if (byFrom[id]) {
      willRename++;
      Logger.log('DOI ID  hang %s | %s -> %s | %s', i + 1, id, byFrom[id].to, data[i][tenCol]);
    } else if (ROWS_TO_DELETE.indexOf(id) > -1) {
      willDelete++;
      Logger.log('XOA     hang %s | %s | %s', i + 1, id, data[i][tenCol]);
    } else if (!CATEGORY_MAP[id]) {
      unmapped.push(id + ' (' + data[i][tenCol] + ')');
    }
  }
  Logger.log('---');
  Logger.log('Se doi id: %s hang | Se xoa: %s hang | Tong hang hien tai: %s',
             willRename, willDelete, data.length - 1);
  if (unmapped.length) Logger.log('Chua co nhan, se dat casual: %s', unmapped.join(' | '));
  else Logger.log('Moi hang con lai deu da co nhan category.');
  return 'doi id ' + willRename + ', xoa ' + willDelete;
}

/**
 * BUOC 3 - XOA HANG, KHONG THE HOAN TAC.
 * Chi xoa dung cac id liet ke trong ROWS_TO_DELETE (9 hang trung lap + 1 hang test).
 * Nen File > Make a copy de sao luu truoc khi chay.
 */
function removeDuplicateRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idCol = headers.indexOf('id') + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Sheet rong';

  var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  var targets = [];
  for (var i = 0; i < ids.length; i++) {
    if (ROWS_TO_DELETE.indexOf(String(ids[i][0]).trim()) > -1) targets.push(i + 2);
  }
  targets.sort(function (a, b) { return b - a; });   // xoa tu duoi len de khong lech chi so
  targets.forEach(function (r) { sheet.deleteRow(r); });

  Logger.log('Da xoa %s hang: %s', targets.length, targets.join(', '));
  return 'Da xoa ' + targets.length + ' hang';
}

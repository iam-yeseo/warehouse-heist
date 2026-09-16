/** @OnlyCurrentDoc */
const SHEET_NAME = "시트1";
const HEADER_ROW = 2;
const EXPECTED_HEADERS = ["순번", "생성날짜", "생성시각", "난수 1", "난수 2", "난수 3", "정상여부"];

function response_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return response_({ ok: true, service: "warehouse-heist-reward-codes" });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e && e.postData ? e.postData.contents : "{}");
    const expectedSecret = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
    if (!expectedSecret || payload.secret !== expectedSecret) throw new Error("Unauthorized");

    const row = payload.row || {};
    const values = [
      Number(row.sequence),
      String(row.createdDate || ""),
      String(row.createdTime || ""),
      String(row.part1 || ""),
      String(row.part2 || ""),
      String(row.part3 || ""),
      String(row.valid || ""),
    ];
    if (!Number.isInteger(values[0]) || values[0] < 1) throw new Error("Invalid sequence");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values[1])) throw new Error("Invalid date");
    if (!/^\d{2}:\d{2}:\d{2}$/.test(values[2])) throw new Error("Invalid time");
    if (![values[3], values[4], values[5]].every((part) => /^[2-9A-HJKMNP-Z]{4}$/.test(part))) throw new Error("Invalid code");
    if (!["정상", "비정상"].includes(values[6])) throw new Error("Invalid status");

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      if (!spreadsheet) throw new Error("Bound spreadsheet not found");
      const sheet = spreadsheet.getSheetByName(SHEET_NAME);
      if (!sheet) throw new Error("Target sheet not found");
      const headers = sheet.getRange(HEADER_ROW, 1, 1, EXPECTED_HEADERS.length).getDisplayValues()[0];
      if (headers.join("|") !== EXPECTED_HEADERS.join("|")) throw new Error("Header mismatch");

      const firstDataRow = HEADER_ROW + 1;
      const dataRowCount = Math.max(0, sheet.getLastRow() - HEADER_ROW);
      let targetRow = null;
      if (dataRowCount > 0) {
        const match = sheet.getRange(firstDataRow, 1, dataRowCount, 1)
          .createTextFinder(String(values[0]))
          .matchEntireCell(true)
          .findNext();
        if (match) targetRow = match.getRow();
      }
      if (!targetRow) targetRow = Math.max(firstDataRow, sheet.getLastRow() + 1);
      const target = sheet.getRange(targetRow, 1, 1, EXPECTED_HEADERS.length);
      target.setValues([values]);
      target.setNumberFormats([["0", "@", "@", "@", "@", "@", "@"]]);
      SpreadsheetApp.flush();
      return response_({ ok: true, row: targetRow });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return response_({ ok: false, message: String(error.message || error) });
  }
}

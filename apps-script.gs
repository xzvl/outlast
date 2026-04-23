/**
 * ROOC Auction Roulette – Insert IGN
 *
 * HOW TO DEPLOY:
 *  1. Open the Google Sheet → Extensions → Apps Script
 *  2. Paste this entire file, replacing any existing code.
 *  3. Save (Ctrl+S).
 *  4. Click "Deploy" → "New deployment"
 *     - Type: Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  5. Click "Deploy", copy the web app URL.
 *  6. Paste that URL into APPS_SCRIPT_URL in app/page.js.
 *
 * The reward values the page sends:
 *   "LND"                      → column header must be  LND
 *   "TNS"                      → column header must be  TNS
 *   "Card Frag(Prio from Elite)" → column header must match exactly
 *
 * Make sure the ROOC Auction Roulette sheet has those exact header names
 * in row 1 (the first row).
 */

var SPREADSHEET_ID = "1Uyho2Vk0j45oAPiYu0GLCMHn7be3E7h92-bREAS443s";
var SHEET_NAME     = "ROOC Auction Roulette";

function doGet(e) {
  var result;

  try {
    var ign    = (e.parameter.ign    || "").trim();
    var reward = (e.parameter.reward || "").trim();

    if (!ign || !reward) {
      result = { error: "Missing ign or reward parameter." };
    } else {
      result = insertIGN(ign, reward);
    }
  } catch (err) {
    result = { error: err.message || String(err) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function insertIGN(ign, reward) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return { error: 'Sheet "' + SHEET_NAME + '" not found.' };
  }

  var lastCol  = sheet.getLastColumn();
  var headers  = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var colIndex = -1;

  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === reward) {
      colIndex = i;
      break;
    }
  }

  if (colIndex === -1) {
    return { error: 'Column "' + reward + '" not found in row 1 of the sheet.' };
  }

  // Find the first empty cell in that column starting from row 2
  var lastRow  = Math.max(sheet.getLastRow(), 1);
  var colData  = sheet.getRange(2, colIndex + 1, lastRow, 1).getValues();
  var targetRow = lastRow + 1; // default: append after last row

  for (var r = 0; r < colData.length; r++) {
    var cell = colData[r][0];
    if (cell === "" || cell === null || cell === undefined) {
      targetRow = r + 2; // +1 for 1-based, +1 to skip header
      break;
    }
  }

  sheet.getRange(targetRow, colIndex + 1).setValue(ign);
  SpreadsheetApp.flush();

  return { success: true, row: targetRow, column: headers[colIndex] };
}

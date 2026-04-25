/**
 * ROOC Auction Roulette API (Apps Script Web App)
 *
 * Supported actions via doGet:
 * - action=insertIgn
 *   params: ign, reward, gameId
 *
 * - action=randomize
 *   params: triggerIgn, gameId, timerSeconds
 */

var SPREADSHEET_ID = "1Uyho2Vk0j45oAPiYu0GLCMHn7be3E7h92-bREAS443s";
var AUCTION_SHEET_NAME = "ROOC Auction Roulette";
var MEMBERS_SHEET_NAME = "ROOC Members Data";
var TRIGGER_SHEET_NAME = "ROOC Auction Randomizer Trigger";

var REWARD_COLUMNS = [
  "LND",
  "TNS",
  "Card Frag(Prio from Elite)",
];

var OFFICER_ROLE_KEYWORDS = [
  "officer",
  "guild leader",
  "vice guild leader",
];

function doGet(e) {
  var result;

  try {
    var action = (e.parameter.action || "").trim();

    if (action === "insertIgn") {
      result = handleInsertIgn(e.parameter);
    } else if (action === "randomize") {
      result = handleRandomize(e.parameter);
    } else {
      result = { error: "Invalid action. Use action=insertIgn or action=randomize." };
    }
  } catch (err) {
    result = { error: err.message || String(err) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleInsertIgn(params) {
  var ign = (params.ign || "").trim();
  var reward = (params.reward || "").trim();
  var gameId = (params.gameId || "").trim();

  if (!ign || !reward || !gameId) {
    return { error: "Missing ign, reward, or gameId parameter." };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var membersSheet = ss.getSheetByName(MEMBERS_SHEET_NAME);
  var auctionSheet = ss.getSheetByName(AUCTION_SHEET_NAME);

  if (!membersSheet) {
    return { error: "Sheet \"" + MEMBERS_SHEET_NAME + "\" not found." };
  }

  if (!auctionSheet) {
    return { error: "Sheet \"" + AUCTION_SHEET_NAME + "\" not found." };
  }

  var memberCheck = validateOrSaveMemberGameIdByIgn(membersSheet, ign, gameId);
  if (!memberCheck.success) {
    return { error: memberCheck.error };
  }

  var headerInfo = getHeaderInfo(auctionSheet);
  var targetCol = headerInfo.indexByName[reward];

  if (!targetCol) {
    return { error: "Column \"" + reward + "\" not found in row 1." };
  }

  var targetRow = findFirstEmptyRow(auctionSheet, targetCol, 2);
  auctionSheet.getRange(targetRow, targetCol).setValue(ign);
  SpreadsheetApp.flush();

  return {
    success: true,
    row: targetRow,
    column: reward,
    gameIdStored: memberCheck.gameIdStored,
  };
}

function validateOrSaveMemberGameIdByIgn(membersSheet, ign, inputGameId) {
  var lastRow = membersSheet.getLastRow();
  if (lastRow < 1) {
    return { success: false, error: "ROOC Members Data is empty." };
  }

  var values = membersSheet.getRange(1, 1, lastRow, 2).getValues();
  var startRow = 1;
  if (values.length > 0 && String(values[0][0] || "").trim().toLowerCase() === "ign") {
    startRow = 2;
  }

  var targetRow = -1;
  for (var i = startRow - 1; i < values.length; i++) {
    var rowIgn = String(values[i][0] || "").trim();
    if (rowIgn && rowIgn.toLowerCase() === ign.toLowerCase()) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, error: "IGN not found in ROOC Members Data." };
  }

  var currentGameId = String(membersSheet.getRange(targetRow, 2).getValue() || "").trim();

  // If Game ID is blank in sheet, bind it to this IGN using submitted value.
  if (!currentGameId) {
    membersSheet.getRange(targetRow, 2).setValue(inputGameId);
    return { success: true, gameIdStored: true };
  }

  if (currentGameId !== inputGameId) {
    return { success: false, error: "Game ID does not match for this IGN." };
  }

  return { success: true, gameIdStored: false };
}

function handleRandomize(params) {
  var triggerIgn = (params.triggerIgn || "").trim();
  var gameId = (params.gameId || "").trim();
  var timerSeconds = Number(params.timerSeconds || 1);

  if (!triggerIgn || !gameId) {
    return { error: "Missing triggerIgn or gameId parameter." };
  }

  if (isNaN(timerSeconds) || timerSeconds <= 0) {
    timerSeconds = 1;
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var membersSheet = ss.getSheetByName(MEMBERS_SHEET_NAME);
  var auctionSheet = ss.getSheetByName(AUCTION_SHEET_NAME);
  var triggerSheet = ss.getSheetByName(TRIGGER_SHEET_NAME);

  if (!membersSheet) {
    return { error: "Sheet \"" + MEMBERS_SHEET_NAME + "\" not found." };
  }

  if (!auctionSheet) {
    return { error: "Sheet \"" + AUCTION_SHEET_NAME + "\" not found." };
  }

  if (!triggerSheet) {
    return { error: "Sheet \"" + TRIGGER_SHEET_NAME + "\" not found." };
  }

  var randomizerAuth = validateRandomizerAuth(membersSheet, triggerIgn, gameId);
  if (!randomizerAuth.success) {
    return { error: randomizerAuth.error };
  }

  var randomized = randomizeRewardColumns(auctionSheet);

  // Required log format: IGN trigger, Auction Date blank, Trigger Date and Time = now
  triggerSheet.appendRow([
    triggerIgn,
    "",
    new Date(),
  ]);

  SpreadsheetApp.flush();

  return {
    success: true,
    timerSeconds: timerSeconds,
    randomized: randomized,
  };
}

function randomizeRewardColumns(sheet) {
  var headerInfo = getHeaderInfo(sheet);
  var randomizedResult = {};

  for (var i = 0; i < REWARD_COLUMNS.length; i++) {
    var rewardName = REWARD_COLUMNS[i];
    var col = headerInfo.indexByName[rewardName];

    if (!col) {
      randomizedResult[rewardName] = [];
      continue;
    }

    var values = readNonEmptyColumnValues(sheet, col, 2);
    fisherYatesShuffle(values);

    clearColumnFromRow(sheet, col, 2);
    if (values.length > 0) {
      var output = values.map(function(name) { return [name]; });
      sheet.getRange(2, col, output.length, 1).setValues(output);
    }

    randomizedResult[rewardName] = values;
  }

  return randomizedResult;
}

function validateRandomizerAuth(membersSheet, triggerIgn, inputGameId) {
  var data = membersSheet.getDataRange().getValues();
  if (data.length < 2) {
    return { success: false, error: "ROOC Members Data is empty." };
  }

  // Per sheet contract: col1=IGN, col2=Game ID, col4=role/rank.
  var ignIndex = 0;
  var gameIdIndex = 1;
  var roleIndex = 3;
  var startRow = 1;
  if (String(data[0][ignIndex] || "").trim().toLowerCase() === "ign") {
    startRow = 2;
  }

  var triggerIgnNormalized = triggerIgn.toLowerCase();

  for (var rowIndex = startRow - 1; rowIndex < data.length; rowIndex++) {
    var row = data[rowIndex];
    var ignValue = String(row[ignIndex] || "").trim();
    var gameIdValue = String(row[gameIdIndex] || "").trim();
    var roleValue = String(row[roleIndex] || "").trim().toLowerCase();

    if (!ignValue) {
      continue;
    }

    if (ignValue.toLowerCase() !== triggerIgnNormalized) {
      continue;
    }

    var isOfficerRole = false;
    for (var k = 0; k < OFFICER_ROLE_KEYWORDS.length; k++) {
      if (roleValue.indexOf(OFFICER_ROLE_KEYWORDS[k]) !== -1) {
        isOfficerRole = true;
        break;
      }
    }

    if (!isOfficerRole) {
      return { success: false, error: "Only Officer, Guild Leader, and Vice Guild Leader can randomize." };
    }

    if (gameIdValue !== inputGameId) {
      return { success: false, error: "Game ID does not match for this IGN." };
    }

    return { success: true };
  }

  return { success: false, error: "IGN not found in ROOC Members Data." };
}

function getHeaderInfo(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var indexByName = {};

  for (var i = 0; i < headers.length; i++) {
    var name = String(headers[i] || "").trim();
    if (name) {
      indexByName[name] = i + 1;
    }
  }

  return {
    headers: headers,
    indexByName: indexByName,
  };
}

function findFirstEmptyRow(sheet, col, fromRow) {
  var maxRows = sheet.getMaxRows();
  var readCount = Math.max(maxRows - fromRow + 1, 1);
  var values = sheet.getRange(fromRow, col, readCount, 1).getValues();

  for (var i = 0; i < values.length; i++) {
    var cell = String(values[i][0] || "").trim();
    if (!cell) {
      return fromRow + i;
    }
  }

  return maxRows + 1;
}

function readNonEmptyColumnValues(sheet, col, fromRow) {
  var lastRow = sheet.getLastRow();
  if (lastRow < fromRow) {
    return [];
  }

  var rowCount = lastRow - fromRow + 1;
  var values = sheet.getRange(fromRow, col, rowCount, 1).getValues();

  return values
    .map(function(item) { return String(item[0] || "").trim(); })
    .filter(function(item) { return item.length > 0; });
}

function clearColumnFromRow(sheet, col, fromRow) {
  var maxRows = sheet.getMaxRows();
  var rowCount = Math.max(maxRows - fromRow + 1, 1);
  sheet.getRange(fromRow, col, rowCount, 1).clearContent();
}

function fisherYatesShuffle(items) {
  for (var i = items.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }
}

function findIndexByCandidates(headers, candidates) {
  var normalizedCandidates = candidates.map(function(candidate) {
    return String(candidate).toLowerCase().replace(/\s+/g, "");
  });

  for (var i = 0; i < headers.length; i++) {
    var normalizedHeader = String(headers[i] || "").toLowerCase().replace(/\s+/g, "");
    if (normalizedCandidates.indexOf(normalizedHeader) !== -1) {
      return i;
    }
  }

  return -1;
}

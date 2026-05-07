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
var AUCTION_DATA_SHEET_NAME = "ROOC Auction Data";

var PER_PLAYER_DEFAULTS_GS = {
  "LND": 6,
  "TNS": 10,
  "Card Frag(Prio from Elite)": 1,
};

var REWARD_COLUMNS = [
  "LND",
  "TNS",
  "Card Frag(Prio from Elite)",
];

var OVERRUN_GROUP_RANK_REWARDS = {
  "advanced": {
    "1": { "LND": 150, "TNS": 170, "Card Frag(Prio from Elite)": 20 },
    "2": { "LND": 140, "TNS": 160, "Card Frag(Prio from Elite)": 20 },
    "3": { "LND": 140, "TNS": 160, "Card Frag(Prio from Elite)": 20 },
    "4": { "LND": 120, "TNS": 150, "Card Frag(Prio from Elite)": 15 },
    "5": { "LND": 120, "TNS": 150, "Card Frag(Prio from Elite)": 15 },
    "6": { "LND": 120, "TNS": 150, "Card Frag(Prio from Elite)": 15 },
    "7": { "LND": 100, "TNS": 150, "Card Frag(Prio from Elite)": 12 },
    "8": { "LND": 100, "TNS": 150, "Card Frag(Prio from Elite)": 12 },
  },
  "beginner": {
    "1": { "LND": 80, "TNS": 140, "Card Frag(Prio from Elite)": 10 },
    "2": { "LND": 75, "TNS": 130, "Card Frag(Prio from Elite)": 9 },
    "3": { "LND": 70, "TNS": 120, "Card Frag(Prio from Elite)": 8 },
    "4": { "LND": 65, "TNS": 110, "Card Frag(Prio from Elite)": 5 },
    "5": { "LND": 60, "TNS": 100, "Card Frag(Prio from Elite)": 5 },
    "6": { "LND": 50, "TNS": 80, "Card Frag(Prio from Elite)": 5 },
    "7": { "LND": 30, "TNS": 30, "Card Frag(Prio from Elite)": 2 },
    "8+": { "LND": 20, "TNS": 20, "Card Frag(Prio from Elite)": 1 },
  },
};

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
    } else if (action === "clearAuctionData") {
      result = handleClearAuctionData(e.parameter);
    } else if (action === "generateOverrunRewards") {
      result = handleGenerateOverrunRewards(e.parameter);
    } else if (action === "claimAuctionDate") {
      result = handleClaimAuctionDate(e.parameter);
    } else {
      result = { error: "Invalid action. Use action=insertIgn, action=randomize, action=clearAuctionData, action=generateOverrunRewards, or action=claimAuctionDate." };
    }
  } catch (err) {
    result = { error: err.message || String(err) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleClaimAuctionDate(params) {
  var triggerIgn = (params.triggerIgn || "").trim();
  var gameId = (params.gameId || "").trim();
  var auctionDate = String(params.auctionDate || "").trim();
  var normalizedAuctionDate = normalizeAuctionDateValue(auctionDate);

  if (!triggerIgn || !gameId) {
    return { error: "Missing triggerIgn or gameId parameter." };
  }

  if (!auctionDate) {
    return { error: "Missing auctionDate parameter." };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var membersSheet = ss.getSheetByName(MEMBERS_SHEET_NAME);
  var dataSheet = ss.getSheetByName(AUCTION_DATA_SHEET_NAME);

  if (!membersSheet) {
    return { error: "Sheet \"" + MEMBERS_SHEET_NAME + "\" not found." };
  }

  if (!dataSheet) {
    return { error: "Sheet \"" + AUCTION_DATA_SHEET_NAME + "\" not found." };
  }

  var randomizerAuth = validateRandomizerAuth(membersSheet, triggerIgn, gameId);
  if (!randomizerAuth.success) {
    return { error: randomizerAuth.error };
  }

  var lastRow = dataSheet.getLastRow();
  if (lastRow < 2) {
    return {
      success: true,
      auctionDate: auctionDate,
      rowsUpdated: 0,
    };
  }

  var values = dataSheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var rowsUpdated = 0;

  for (var i = 0; i < values.length; i++) {
    var reward = String(values[i][1] || "").trim();
    var rowDate = normalizeAuctionDateValue(values[i][4]);
    if (!reward || !rowDate) {
      continue;
    }

    if (rowDate !== normalizedAuctionDate) {
      continue;
    }

    values[i][2] = "Claimed";
    rowsUpdated += 1;
  }

  if (rowsUpdated > 0) {
    var statusColumnValues = values.map(function(row) {
      return [row[2]];
    });
    dataSheet.getRange(2, 3, statusColumnValues.length, 1).setValues(statusColumnValues);
    SpreadsheetApp.flush();
  }

  return {
    success: true,
    auctionDate: auctionDate,
    rowsUpdated: rowsUpdated,
  };
}

function handleGenerateOverrunRewards(params) {
  var triggerIgn = (params.triggerIgn || "").trim();
  var gameId = (params.gameId || "").trim();
  var groupRanking = String(params.groupRanking || "").trim().toLowerCase();
  var guildRanking = String(params.guildRanking || "").trim();
  var officerCardBenefit = String(params.officerCardBenefit || "").trim().toLowerCase() === "true";
  var officerCardQuantityRequested = Math.max(0, Number(params.officerCardQuantity || 0));
  var officerCardRecipients = parseOfficerCardRecipients(params.officerCardRecipients);

  if (!triggerIgn || !gameId || !groupRanking || !guildRanking) {
    return { error: "Missing triggerIgn, gameId, groupRanking, or guildRanking parameter." };
  }

  var rankRewards = getOverrunRankRewards(groupRanking, guildRanking);
  if (!rankRewards) {
    return { error: "Invalid group or guild ranking." };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var membersSheet = ss.getSheetByName(MEMBERS_SHEET_NAME);
  var auctionSheet = ss.getSheetByName(AUCTION_SHEET_NAME);
  var dataSheet = ss.getSheetByName(AUCTION_DATA_SHEET_NAME);

  if (!membersSheet) {
    return { error: "Sheet \"" + MEMBERS_SHEET_NAME + "\" not found." };
  }

  if (!auctionSheet) {
    return { error: "Sheet \"" + AUCTION_SHEET_NAME + "\" not found." };
  }

  if (!dataSheet) {
    return { error: "Sheet \"" + AUCTION_DATA_SHEET_NAME + "\" not found." };
  }

  var randomizerAuth = validateRandomizerAuth(membersSheet, triggerIgn, gameId);
  if (!randomizerAuth.success) {
    return { error: randomizerAuth.error };
  }

  var weekDates = getWeekDates();
  var sundayDate = getCurrentWeekSundayDate();

  var overrunPlayerState = getOverrunPlayerStateByReward(auctionSheet, dataSheet, weekDates);
  var cardPlayers = ((overrunPlayerState.playersByReward || {})["Card Frag(Prio from Elite)"] || []).length;
  var totalCardRewards = Number(rankRewards["Card Frag(Prio from Elite)"] || 0);
  var succeedingCardRewards = Math.max(totalCardRewards - cardPlayers, 0);
  var officerCardQuantity = 0;
  if (officerCardBenefit && officerCardQuantityRequested > 0 && officerCardRecipients.length > 0) {
    officerCardQuantity = Math.min(officerCardQuantityRequested, succeedingCardRewards, officerCardRecipients.length);
  }

  var rewardsForPlayers = {
    "LND": Number(rankRewards["LND"] || 0),
    "TNS": Number(rankRewards["TNS"] || 0),
    "Card Frag(Prio from Elite)": Math.max(0, totalCardRewards - officerCardQuantity),
  };

  var distribution = buildOverrunDistribution(overrunPlayerState, rewardsForPlayers);

  var sundayRows = [];
  var featherRewards = ["LND", "TNS"];
  var featherSlot = 1;
  for (var r = 0; r < featherRewards.length; r++) {
    var rewardKey = featherRewards[r];
    var allocations = distribution.allocationsByReward[rewardKey] || [];

    for (var i = 0; i < allocations.length; i++) {
      var allocation = allocations[i];
      if (allocation.quantity <= 0) {
        continue;
      }

      var startSlot = featherSlot;
      var endSlot = featherSlot + allocation.quantity - 1;
      sundayRows.push([allocation.ign, rewardKey, "Unclaimed", computePageString(startSlot, endSlot), sundayDate]);
      featherSlot = endSlot + 1;
    }
  }

  var cardAllocations = distribution.allocationsByReward["Card Frag(Prio from Elite)"] || [];
  var cardSlot = 1;
  for (var c = 0; c < cardAllocations.length; c++) {
    var cardAllocation = cardAllocations[c];
    if (cardAllocation.quantity <= 0) {
      continue;
    }

    var cardStartSlot = cardSlot;
    var cardEndSlot = cardSlot + cardAllocation.quantity - 1;
    sundayRows.push([cardAllocation.ign, "Card Frag(Prio from Elite)", "Unclaimed", computePageString(cardStartSlot, cardEndSlot), sundayDate]);
    cardSlot = cardEndSlot + 1;
  }

  if (officerCardQuantity > 0) {
    for (var oc = 0; oc < officerCardQuantity; oc++) {
      var officerName = officerCardRecipients[oc];
      var officerCardStartSlot = cardSlot;
      var officerCardEndSlot = cardSlot;
      sundayRows.push([officerName, "Card Frag(Prio from Elite)", "Unclaimed", computePageString(officerCardStartSlot, officerCardEndSlot), sundayDate]);
      cardSlot = officerCardEndSlot + 1;
    }
  }

  if (sundayRows.length > 0) {
    var insertStart = dataSheet.getLastRow() + 1;
    dataSheet.getRange(insertStart, 1, sundayRows.length, 5).setValues(sundayRows);
  }

  var cycledRowsUpdated = applyCycleBackToExistingRows(dataSheet, distribution.leftoverByReward, weekDates);
  SpreadsheetApp.flush();

  return {
    success: true,
    groupRanking: groupRanking,
    guildRanking: guildRanking,
    sundayDate: sundayDate,
    rowsInserted: sundayRows.length,
    cycledRowsUpdated: cycledRowsUpdated,
    officerCardBenefit: officerCardBenefit,
    officerCardGranted: officerCardQuantity,
    officerCardRecipients: officerCardRecipients.slice(0, officerCardQuantity),
    distribution: distribution,
  };
}

function parseOfficerCardRecipients(rawValue) {
  var text = String(rawValue || "").trim();
  if (!text) {
    return [];
  }

  var parsed = [];
  try {
    var json = JSON.parse(text);
    if (Object.prototype.toString.call(json) === "[object Array]") {
      parsed = json;
    }
  } catch (err) {
    parsed = text.split(",");
  }

  var unique = [];
  var seen = {};
  for (var i = 0; i < parsed.length; i++) {
    var ign = String(parsed[i] || "").trim();
    if (!ign) {
      continue;
    }
    var key = ign.toLowerCase();
    if (seen[key]) {
      continue;
    }
    seen[key] = true;
    unique.push(ign);
  }

  return unique;
}

function getOverrunRankRewards(groupRanking, guildRanking) {
  var groupRewards = OVERRUN_GROUP_RANK_REWARDS[groupRanking];
  if (!groupRewards) {
    return null;
  }

  var rankKey = String(guildRanking || "").trim();
  if (groupRanking === "beginner" && Number(rankKey) >= 8) {
    rankKey = "8+";
  }

  if (!groupRewards[rankKey]) {
    return null;
  }

  return groupRewards[rankKey];
}

function handleClearAuctionData(params) {
  var triggerIgn = (params.triggerIgn || "").trim();
  var gameId = (params.gameId || "").trim();

  if (!triggerIgn || !gameId) {
    return { error: "Missing triggerIgn or gameId parameter." };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var membersSheet = ss.getSheetByName(MEMBERS_SHEET_NAME);
  var dataSheet = ss.getSheetByName(AUCTION_DATA_SHEET_NAME);
  var auctionSheet = ss.getSheetByName(AUCTION_SHEET_NAME);

  if (!membersSheet) {
    return { error: "Sheet \"" + MEMBERS_SHEET_NAME + "\" not found." };
  }

  if (!dataSheet) {
    return { error: "Sheet \"" + AUCTION_DATA_SHEET_NAME + "\" not found." };
  }

  if (!auctionSheet) {
    return { error: "Sheet \"" + AUCTION_SHEET_NAME + "\" not found." };
  }

  var randomizerAuth = validateRandomizerAuth(membersSheet, triggerIgn, gameId);
  if (!randomizerAuth.success) {
    return { error: randomizerAuth.error };
  }

  clearSheetDataFromRow(dataSheet, 2);
  clearSheetDataFromRow(auctionSheet, 2);
  SpreadsheetApp.flush();

  return {
    success: true,
    message: "ROOC Auction Data and ROOC Auction Roulette cleared successfully.",
  };
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
  var triggerIgn   = (params.triggerIgn   || "").trim();
  var gameId       = (params.gameId       || "").trim();
  var timerSeconds = Number(params.timerSeconds || 1);

  // Winner-per-GL and per-player counts sent from the client
  var winnerPerGLLND  = Math.max(0, Number(params.winnerPerGLLND  || 0));
  var winnerPerGLTNS  = Math.max(0, Number(params.winnerPerGLTNS  || 0));
  var winnerPerGLCard = Math.max(0, Number(params.winnerPerGLCard || 0));
  var perPlayerLND    = Math.max(1, Number(params.perPlayerLND    || PER_PLAYER_DEFAULTS_GS["LND"]));
  var perPlayerTNS    = Math.max(1, Number(params.perPlayerTNS    || PER_PLAYER_DEFAULTS_GS["TNS"]));
  var perPlayerCard   = Math.max(1, Number(params.perPlayerCard   || PER_PLAYER_DEFAULTS_GS["Card Frag(Prio from Elite)"]));

  if (!triggerIgn || !gameId) {
    return { error: "Missing triggerIgn or gameId parameter." };
  }

  if (isNaN(timerSeconds) || timerSeconds <= 0) {
    timerSeconds = 1;
  }

  var ss           = SpreadsheetApp.openById(SPREADSHEET_ID);
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

  // Save winners to ROOC Auction Data sheet
  var dataSheet = ss.getSheetByName(AUCTION_DATA_SHEET_NAME);
  if (dataSheet) {
    var weekDates = getWeekDates();
    var winnerCounts = {
      "LND": winnerPerGLLND,
      "TNS": winnerPerGLTNS,
      "Card Frag(Prio from Elite)": winnerPerGLCard,
    };
    var perPlayerCounts = {
      "LND": perPlayerLND,
      "TNS": perPlayerTNS,
      "Card Frag(Prio from Elite)": perPlayerCard,
    };
    saveWinnersToAuctionData(dataSheet, randomized, winnerCounts, perPlayerCounts, weekDates);
  }

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

function clearSheetDataFromRow(sheet, fromRow) {
  var maxRows = sheet.getMaxRows();
  var maxCols = sheet.getMaxColumns();
  var rowCount = Math.max(maxRows - fromRow + 1, 1);
  sheet.getRange(fromRow, 1, rowCount, maxCols).clearContent();
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

function getCurrentWeekSundayDate() {
  var now = new Date();
  var dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
  var daysUntilSunday = dayOfWeek === 0 ? 0 : (7 - dayOfWeek);
  var sunday = new Date(now);
  sunday.setDate(now.getDate() + daysUntilSunday);
  sunday.setHours(0, 0, 0, 0);

  return Utilities.formatDate(sunday, Session.getScriptTimeZone(), "MM/dd/yyyy");
}

function uniqueStrings(values) {
  var result = [];
  var seen = {};

  for (var i = 0; i < values.length; i++) {
    var raw = String(values[i] || "").trim();
    if (!raw) {
      continue;
    }
    var key = raw.toLowerCase();
    if (seen[key]) {
      continue;
    }
    seen[key] = true;
    result.push(raw);
  }

  return result;
}

function getOverrunPlayerStateByReward(auctionSheet, dataSheet, weekDates) {
  var headers = getHeaderInfo(auctionSheet).indexByName;
  var rewardOrder = ["LND", "TNS", "Card Frag(Prio from Elite)"];
  var playersByReward = {
    "LND": [],
    "TNS": [],
    "Card Frag(Prio from Elite)": [],
  };

  var existingWeekRecipientsByReward = {
    "LND": {},
    "TNS": {},
    "Card Frag(Prio from Elite)": {},
  };

  var weeklyTotalsByReward = {
    "LND": {},
    "TNS": {},
    "Card Frag(Prio from Elite)": {},
  };

  var lastRow = dataSheet.getLastRow();
  if (lastRow >= 2) {
    var values = dataSheet.getRange(2, 1, lastRow - 1, 5).getValues();
    for (var i = 0; i < values.length; i++) {
      var ign = String(values[i][0] || "").trim();
      var reward = String(values[i][1] || "").trim();
      var pages = String(values[i][3] || "").trim();
      var date = normalizeAuctionDateValue(values[i][4]);
      if (!ign || !weeklyTotalsByReward[reward]) {
        continue;
      }
      if (!weekDates) {
        continue;
      }
      if (date !== weekDates.tuesday && date !== weekDates.thursday) {
        continue;
      }

      var ignKey = ign.toLowerCase();
      existingWeekRecipientsByReward[reward][ignKey] = true;

      var quantity = countSlotsFromPageString(pages);
      if (!weeklyTotalsByReward[reward][ignKey]) {
        weeklyTotalsByReward[reward][ignKey] = 0;
      }
      weeklyTotalsByReward[reward][ignKey] += quantity;
    }
  }

  for (var r = 0; r < rewardOrder.length; r++) {
    var rewardKey = rewardOrder[r];
    var col = headers[rewardKey];
    if (!col) {
      continue;
    }

    var uniquePlayers = uniqueStrings(readNonEmptyColumnValues(auctionSheet, col, 2));
    if (rewardKey === "Card Frag(Prio from Elite)") {
      playersByReward[rewardKey] = uniquePlayers.filter(function(ign) {
        return !existingWeekRecipientsByReward[rewardKey][String(ign || "").toLowerCase()];
      });
    } else {
      playersByReward[rewardKey] = uniquePlayers;
    }
  }

  return {
    playersByReward: playersByReward,
    weeklyTotalsByReward: weeklyTotalsByReward,
  };
}

function countSlotsFromPageString(pageString) {
  var text = String(pageString || "").trim();
  if (!text) {
    return 0;
  }

  var total = 0;
  var pattern = /Page\s+\d+(?:\s*\(([^)]*)\))?/g;
  var match;

  while ((match = pattern.exec(text)) !== null) {
    var qualifier = String(match[1] || "").trim();
    if (!qualifier) {
      total += 4;
      continue;
    }

    var ordinalMatches = qualifier.match(/1st|2nd|3rd|4th/g);
    total += ordinalMatches ? ordinalMatches.length : 0;
  }

  return total;
}

function buildBalancedQuantities(players, currentTotalsMap, totalRewards) {
  var quantities = [];
  var runningTotals = [];

  for (var i = 0; i < players.length; i++) {
    quantities.push(0);
    runningTotals.push(Number(currentTotalsMap[players[i].toLowerCase()] || 0));
  }

  for (var rewardUnit = 0; rewardUnit < totalRewards; rewardUnit++) {
    var targetIndex = 0;
    for (var j = 1; j < runningTotals.length; j++) {
      if (runningTotals[j] < runningTotals[targetIndex]) {
        targetIndex = j;
      }
    }

    quantities[targetIndex] += 1;
    runningTotals[targetIndex] += 1;
  }

  return quantities;
}

function buildOverrunDistribution(overrunPlayerState, rankRewards) {
  var rewardOrder = ["LND", "TNS", "Card Frag(Prio from Elite)"];
  var playersByReward = (overrunPlayerState && overrunPlayerState.playersByReward) || {
    "LND": [],
    "TNS": [],
    "Card Frag(Prio from Elite)": [],
  };
  var weeklyTotalsByReward = (overrunPlayerState && overrunPlayerState.weeklyTotalsByReward) || {
    "LND": {},
    "TNS": {},
    "Card Frag(Prio from Elite)": {},
  };

  var allocationsByReward = {
    "LND": [],
    "TNS": [],
    "Card Frag(Prio from Elite)": [],
  };
  var leftoverByReward = {
    "LND": 0,
    "TNS": 0,
    "Card Frag(Prio from Elite)": 0,
  };

  for (var r = 0; r < rewardOrder.length; r++) {
    var rewardKey = rewardOrder[r];
    var players = playersByReward[rewardKey] || [];
    var totalRewards = Number(rankRewards[rewardKey] || 0);

    if (players.length === 0 || totalRewards <= 0) {
      leftoverByReward[rewardKey] = Math.max(totalRewards, 0);
      continue;
    }

    var quantities = buildBalancedQuantities(players, weeklyTotalsByReward[rewardKey] || {}, totalRewards);

    var allocations = [];
    for (var p = 0; p < players.length; p++) {
      allocations.push({
        ign: players[p],
        quantity: Number(quantities[p] || 0),
      });
    }

    allocationsByReward[rewardKey] = allocations;
    leftoverByReward[rewardKey] = 0; // No leftovers with fair division
  }

  return {
    allocationsByReward: allocationsByReward,
    leftoverByReward: leftoverByReward,
  };
}

function applyCycleBackToExistingRows(dataSheet, leftoverByReward, weekDates) {
  var lastRow = dataSheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  var values = dataSheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var rewardOrder = ["LND", "TNS", "Card Frag(Prio from Elite)"];
  var updatedRows = {};

  for (var r = 0; r < rewardOrder.length; r++) {
    var rewardKey = rewardOrder[r];
    var leftovers = Number(leftoverByReward[rewardKey] || 0);
    if (leftovers <= 0) {
      continue;
    }

    var recipients = [];
    for (var i = 0; i < values.length; i++) {
      var rowReward = String(values[i][1] || "").trim();
      var rowDate = normalizeAuctionDateValue(values[i][4]);
      if (rowReward !== rewardKey) {
        continue;
      }
      if (rowDate !== weekDates.tuesday && rowDate !== weekDates.thursday) {
        continue;
      }

      recipients.push({
        rowNumber: i + 2,
        pages: String(values[i][3] || "").trim(),
        bonusCount: 0,
      });
    }

    if (recipients.length === 0) {
      continue;
    }

    for (var x = 0; x < leftovers; x++) {
      recipients[x % recipients.length].bonusCount += 1;
    }

    for (var y = 0; y < recipients.length; y++) {
      var recipient = recipients[y];
      if (recipient.bonusCount <= 0) {
        continue;
      }

      var bonusText = "Sunday Cycle +" + recipient.bonusCount + "pc";
      var nextPages = recipient.pages ? (recipient.pages + " | " + bonusText) : bonusText;
      dataSheet.getRange(recipient.rowNumber, 4).setValue(nextPages);
      updatedRows[recipient.rowNumber] = true;
    }
  }

  return Object.keys(updatedRows).length;
}

/**
 * Returns a page-range string given the absolute startSlot and endSlot
 * within a day's continuous slot sequence. Each page holds 4 slots.
 * e.g. startSlot=1, endSlot=6  → "Page 1, Page 2 (1st & 2nd ONLY)"
 *      startSlot=31, endSlot=40 → "Page 8 (3rd & 4th ONLY), Page 9, Page 10"
 */
function computePageString(startSlot, endSlot) {
  var startPage = Math.ceil(startSlot / 4);
  var endPage   = Math.ceil(endSlot   / 4);

  var ordinals = ["1st", "2nd", "3rd", "4th"];
  var parts    = [];

  for (var page = startPage; page <= endPage; page++) {
    var pageStart = (page - 1) * 4 + 1;
    var pageEnd   = page * 4;

    var usedStart = Math.max(startSlot, pageStart);
    var usedEnd   = Math.min(endSlot,   pageEnd);
    var usedCount = usedEnd - usedStart + 1;

    if (usedCount === 4) {
      parts.push("Page " + page);
    } else {
      var labels = [];
      for (var item = usedStart; item <= usedEnd; item++) {
        labels.push(ordinals[item - pageStart]);
      }
      var qualifier;
      if (labels.length === 1) {
        qualifier = labels[0] + " ONLY";
      } else {
        qualifier = labels.slice(0, -1).join(", ") + " & " + labels[labels.length - 1] + " ONLY";
      }
      parts.push("Page " + page + " (" + qualifier + ")");
    }
  }

  return parts.join(", ");
}

/**
 * Returns { tuesday: "MM/dd/yyyy", thursday: "MM/dd/yyyy" } for the current week.
 */
function getWeekDates() {
  var now = new Date();
  var dayOfWeek = now.getDay(); // 0=Sun … 6=Sat
  var mondayOffset = dayOfWeek === 0 ? -6 : (1 - dayOfWeek);

  // Tuesday of this week where week ordering is Monday -> Sunday.
  var monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  var tuesday = new Date(monday);
  tuesday.setDate(monday.getDate() + 1);
  tuesday.setHours(0, 0, 0, 0);

  var thursday = new Date(tuesday);
  thursday.setDate(tuesday.getDate() + 2);

  var tz  = Session.getScriptTimeZone();
  var fmt = "MM/dd/yyyy";
  return {
    tuesday:  Utilities.formatDate(tuesday,  tz, fmt),
    thursday: Utilities.formatDate(thursday, tz, fmt),
  };
}

function normalizeAuctionDateValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  var tz = Session.getScriptTimeZone();
  var fmt = "MM/dd/yyyy";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, tz, fmt);
  }

  var text = String(value).trim();
  if (!text) {
    return "";
  }

  // Try parsing strings like "Sun May 03 2026 ..." and normalize to MM/dd/yyyy.
  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, tz, fmt);
  }

  return text;
}

/**
 * Appends winner rows to the "ROOC Auction Data" sheet.
 *
 * Row order: Tuesday batch first (LND × N, TNS × N, Card × N), then Thursday batch.
 * Pages are continuous across all rewards within a single day's slot sequence.
 *
 * @param {Sheet}   dataSheet      - the target sheet
 * @param {Object}  randomized     - { LND: [...], TNS: [...], "Card Frag...": [...] }
 * @param {Object}  winnerCounts   - { LND: n, TNS: n, "Card Frag...": n }
 * @param {Object}  perPlayerCounts- { LND: n, TNS: n, "Card Frag...": n }
 * @param {Object}  weekDates      - { tuesday: "MM/dd/yyyy", thursday: "MM/dd/yyyy" }
 */
function saveWinnersToAuctionData(dataSheet, randomized, winnerCounts, perPlayerCounts, weekDates) {
  var rewardOrder = ["LND", "TNS", "Card Frag(Prio from Elite)"];
  var dayDates = [weekDates.tuesday, weekDates.thursday];

  var allRows = [];

  // Feathers = LND + TNS share a continuous slot sequence per day.
  // Cards = own slot sequence starting from Page 1 each day.
  var FEATHER_REWARDS = ["LND", "TNS"];
  var CARD_REWARDS    = ["Card Frag(Prio from Elite)"];

  for (var day = 0; day < 2; day++) {
    var date = dayDates[day];

    // --- Feathers (LND then TNS, continuous slots) ---
    var featherSlotOffset = 0;
    for (var r = 0; r < FEATHER_REWARDS.length; r++) {
      var rewardKey = FEATHER_REWARDS[r];
      var winners   = randomized[rewardKey] || [];
      var winnerN   = winnerCounts[rewardKey]    || 0;
      var perPlayer = perPlayerCounts[rewardKey] || 1;
      var dayStart  = day * winnerN;

      if (winners.length === 0 || winnerN <= 0) {
        featherSlotOffset += winnerN * perPlayer;
        continue;
      }

      for (var i = 0; i < winnerN; i++) {
        var listIdx = (dayStart + i) % winners.length;
        var ign       = winners[listIdx];
        var startSlot = featherSlotOffset + i * perPlayer + 1;
        var endSlot   = featherSlotOffset + (i + 1) * perPlayer;
        allRows.push([ign, rewardKey, "Unclaimed", computePageString(startSlot, endSlot), date]);
      }

      featherSlotOffset += winnerN * perPlayer;
    }

    // --- Cards (own slot sequence, resets to 1 each day) ---
    var cardSlotOffset = 0;
    for (var rc = 0; rc < CARD_REWARDS.length; rc++) {
      var rewardKey = CARD_REWARDS[rc];
      var winners   = randomized[rewardKey] || [];
      var winnerN   = winnerCounts[rewardKey]    || 0;
      var perPlayer = perPlayerCounts[rewardKey] || 1;
      var dayStart  = day * winnerN;

      if (winners.length === 0 || winnerN <= 0) {
        cardSlotOffset += winnerN * perPlayer;
        continue;
      }

      for (var i = 0; i < winnerN; i++) {
        var listIdx = (dayStart + i) % winners.length;
        var ign       = winners[listIdx];
        var startSlot = cardSlotOffset + i * perPlayer + 1;
        var endSlot   = cardSlotOffset + (i + 1) * perPlayer;
        allRows.push([ign, rewardKey, "Unclaimed", computePageString(startSlot, endSlot), date]);
      }

      cardSlotOffset += winnerN * perPlayer;
    }
  }

  if (allRows.length > 0) {
    var startRow = dataSheet.getLastRow() + 1;
    dataSheet.getRange(startRow, 1, allRows.length, 5).setValues(allRows);
  }
}

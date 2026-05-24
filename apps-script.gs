/**
 * ROOC Auction Roulette API (Apps Script Web App)
 *
 * Supported actions via doGet:
 * - action=insertIgn
 *   params: ign, reward, gameId
 *
 * - action=changeIgnJob
 *   params: ign, changeType, newIgn, newClass, gameId
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
  "LND": 3,
  "TNS": 5,
  "Card Fragment": 1,
};

var REWARD_COLUMNS = [
  "LND",
  "TNS",
  "Card Fragment",
];

var OVERRUN_GROUP_RANK_REWARDS = {
  "advanced": {
    "1": { "LND": 150, "TNS": 170, "Card Fragment": 20 },
    "2": { "LND": 140, "TNS": 160, "Card Fragment": 20 },
    "3": { "LND": 140, "TNS": 160, "Card Fragment": 20 },
    "4": { "LND": 120, "TNS": 150, "Card Fragment": 15 },
    "5": { "LND": 120, "TNS": 150, "Card Fragment": 15 },
    "6": { "LND": 120, "TNS": 150, "Card Fragment": 15 },
    "7": { "LND": 100, "TNS": 150, "Card Fragment": 12 },
    "8": { "LND": 100, "TNS": 150, "Card Fragment": 12 },
  },
  "beginner": {
    "1": { "LND": 80, "TNS": 140, "Card Fragment": 10 },
    "2": { "LND": 75, "TNS": 130, "Card Fragment": 9 },
    "3": { "LND": 70, "TNS": 120, "Card Fragment": 8 },
    "4": { "LND": 65, "TNS": 110, "Card Fragment": 5 },
    "5": { "LND": 60, "TNS": 100, "Card Fragment": 5 },
    "6": { "LND": 50, "TNS": 80, "Card Fragment": 5 },
    "7": { "LND": 30, "TNS": 30, "Card Fragment": 2 },
    "8+": { "LND": 20, "TNS": 20, "Card Fragment": 1 },
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
    } else if (action === "changeIgnJob") {
      result = handleChangeIgnJob(e.parameter);
    } else if (action === "randomize") {
      result = handleRandomize(e.parameter);
    } else if (action === "clearAuctionData") {
      result = handleClearAuctionData(e.parameter);
    } else if (action === "generateOverrunRewards") {
      result = handleGenerateOverrunRewards(e.parameter);
    } else if (action === "claimAuctionDate") {
      result = handleClaimAuctionDate(e.parameter);
    } else {
      result = { error: "Invalid action. Use action=insertIgn, action=changeIgnJob, action=randomize, action=clearAuctionData, action=generateOverrunRewards, or action=claimAuctionDate." };
    }
  } catch (err) {
    result = { error: err.message || String(err) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAuctionDataRowMeta(row) {
  var hasTabShape = normalizeAuctionDateValue(row[5]) !== "";
  return {
    reward: String(row[1] || "").trim(),
    tab: String((hasTabShape ? row[2] : "") || "").trim(),
    status: String((hasTabShape ? row[3] : row[2]) || "").trim(),
    pages: String((hasTabShape ? row[4] : row[3]) || "").trim(),
    date: normalizeAuctionDateValue(hasTabShape ? row[5] : row[4]),
    statusColumn: hasTabShape ? 4 : 3,
    pagesColumn: hasTabShape ? 5 : 4,
  };
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

  var values = dataSheet.getRange(2, 1, lastRow - 1, 6).getValues();
  var rowsUpdated = 0;

  for (var i = 0; i < values.length; i++) {
    var rowMeta = getAuctionDataRowMeta(values[i]);
    if (!rowMeta.reward || !rowMeta.date) {
      continue;
    }

    if (rowMeta.date !== normalizedAuctionDate) {
      continue;
    }

    dataSheet.getRange(i + 2, rowMeta.statusColumn).setValue("Claimed");
    rowsUpdated += 1;
  }

  if (rowsUpdated > 0) {
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
  var perPlayerLND = Math.max(1, Number(params.perPlayerLND || PER_PLAYER_DEFAULTS_GS["LND"] || 1));
  var perPlayerTNS = Math.max(1, Number(params.perPlayerTNS || PER_PLAYER_DEFAULTS_GS["TNS"] || 1));
  var perPlayerCard = Math.max(1, Number(params.perPlayerCard || PER_PLAYER_DEFAULTS_GS["Card Fragment"] || 1));
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
  var overrunCycleOffsets = getOverrunCycleStartIndexes(overrunPlayerState, dataSheet, weekDates);
  var cardPlayers = ((overrunPlayerState.playersByReward || {})["Card Fragment"] || []).length;
  var totalCardRewards = Number(rankRewards["Card Fragment"] || 0);
  var featherWinnerCount = Math.min(
    Math.floor(Number(rankRewards["LND"] || 0) / perPlayerLND),
    Math.floor(Number(rankRewards["TNS"] || 0) / perPlayerTNS)
  );
  var totalCardWinnerCount = Math.floor(totalCardRewards / perPlayerCard);
  var succeedingCardRewards = Math.max(totalCardWinnerCount - cardPlayers, 0);
  var officerCardQuantity = 0;
  if (officerCardBenefit && officerCardQuantityRequested > 0 && officerCardRecipients.length > 0) {
    officerCardQuantity = Math.min(officerCardQuantityRequested, succeedingCardRewards, officerCardRecipients.length);
  }

  var winnerCounts = {
    "LND": Math.max(featherWinnerCount, 0),
    "TNS": Math.max(featherWinnerCount, 0),
    "Card Fragment": Math.max(0, totalCardWinnerCount - officerCardQuantity),
  };
  var perPlayerCounts = {
    "LND": perPlayerLND,
    "TNS": perPlayerTNS,
    "Card Fragment": perPlayerCard,
  };

  var rewardsForDistribution = {
    "LND": Number(rankRewards["LND"] || 0),
    "TNS": Number(rankRewards["TNS"] || 0),
    "Card Fragment": Math.max(0, totalCardRewards - (officerCardQuantity * perPlayerCounts["Card Fragment"])),
  };

  var distribution = buildOverrunDistribution(overrunPlayerState, rewardsForDistribution, winnerCounts, perPlayerCounts, overrunCycleOffsets);

  var sundayRows = [];

  // Build combined Feather rows (LND + TNS per IGN) for Emperium Overrun
  var featherPartsByIgn = {};
  var featherOrder = [];
  var featherRewards = ["LND", "TNS"];
  var featherSlotsByReward = {
    "LND": 1,
    "TNS": Number(rankRewards["LND"] || 0) + 1,
  };
  for (var r = 0; r < featherRewards.length; r++) {
    var rewardKey = featherRewards[r];
    var allocations = distribution.allocationsByReward[rewardKey] || [];

    for (var i = 0; i < allocations.length; i++) {
      var allocation = allocations[i];
      if (allocation.quantity <= 0) {
        continue;
      }

      var startSlot = featherSlotsByReward[rewardKey];
      var endSlot = featherSlotsByReward[rewardKey] + (allocation.quantity * perPlayerCounts[rewardKey]) - 1;
      var pageLabel = computePageString(startSlot, endSlot);
      featherSlotsByReward[rewardKey] = endSlot + 1;

      var ignKey = allocation.ign.toLowerCase();
      if (!featherPartsByIgn[ignKey]) {
        featherPartsByIgn[ignKey] = { ign: allocation.ign, lnd: [], tns: [] };
        featherOrder.push(ignKey);
      }
      if (rewardKey === "LND") {
        featherPartsByIgn[ignKey].lnd.push(pageLabel);
      } else {
        featherPartsByIgn[ignKey].tns.push(pageLabel);
      }
    }
  }

  for (var f = 0; f < featherOrder.length; f++) {
    var featherEntry = featherPartsByIgn[featherOrder[f]];
    var featherParts = [];
    if (featherEntry.lnd.length > 0) {
      featherParts.push("LND: " + featherEntry.lnd.join(", "));
    }
    if (featherEntry.tns.length > 0) {
      featherParts.push("TNS: " + featherEntry.tns.join(", "));
    }
    if (featherParts.length === 0) {
      continue;
    }
    var featherPageText = featherParts.filter(function(part) {
      return String(part || "").trim().length > 0 && !String(part || "").match(/^(LND|TNS):\s*$/);
    }).join(" | ");
    if (featherPageText.trim().length > 0) {
      sundayRows.push([featherEntry.ign, "Feather", "Emperium Overrun", "Unclaim", featherPageText, sundayDate]);
    }
  }

  var cardAllocations = distribution.allocationsByReward["Card Fragment"] || [];
  var cardSlot = 1;
  for (var c = 0; c < cardAllocations.length; c++) {
    var cardAllocation = cardAllocations[c];
    if (cardAllocation.quantity <= 0) {
      continue;
    }

    var cardStartSlot = cardSlot;
    var cardEndSlot = cardSlot + (cardAllocation.quantity * perPlayerCounts["Card Fragment"]) - 1;
    sundayRows.push([cardAllocation.ign, "Card", "Emperium Overrun", "Unclaim", computePageString(cardStartSlot, cardEndSlot), sundayDate]);
    cardSlot = cardEndSlot + 1;
  }

  if (officerCardQuantity > 0) {
    for (var oc = 0; oc < officerCardQuantity; oc++) {
      var officerName = officerCardRecipients[oc];
      var officerCardStartSlot = cardSlot;
      var officerCardEndSlot = cardSlot + perPlayerCounts["Card Fragment"] - 1;
      sundayRows.push([officerName, "Card", "Emperium Overrun", "Unclaim", computePageString(officerCardStartSlot, officerCardEndSlot), sundayDate]);
      cardSlot = officerCardEndSlot + 1;
    }
  }

  var freeForAllCounter = 1;
  var freeForAllLndLeftover = Number(distribution.leftoverByReward["LND"] || 0);
  var freeForAllTnsLeftover = Number(distribution.leftoverByReward["TNS"] || 0);
  while (freeForAllLndLeftover > 0 || freeForAllTnsLeftover > 0) {
    var freeForAllFeatherParts = [];

    if (freeForAllLndLeftover > 0) {
      var lndChunk = Math.min(perPlayerCounts["LND"], freeForAllLndLeftover);
      var lndStartSlot = featherSlotsByReward["LND"];
      var lndEndSlot = lndStartSlot + lndChunk - 1;
      freeForAllFeatherParts.push("LND: " + computePageString(lndStartSlot, lndEndSlot));
      featherSlotsByReward["LND"] = lndEndSlot + 1;
      freeForAllLndLeftover -= lndChunk;
    }

    if (freeForAllTnsLeftover > 0) {
      var tnsChunk = Math.min(perPlayerCounts["TNS"], freeForAllTnsLeftover);
      var tnsStartSlot = featherSlotsByReward["TNS"];
      var tnsEndSlot = tnsStartSlot + tnsChunk - 1;
      freeForAllFeatherParts.push("TNS: " + computePageString(tnsStartSlot, tnsEndSlot));
      featherSlotsByReward["TNS"] = tnsEndSlot + 1;
      freeForAllTnsLeftover -= tnsChunk;
    }

    if (freeForAllFeatherParts.length > 0) {
      var freeForAllPageText = freeForAllFeatherParts.filter(function(part) {
        return String(part || "").trim().length > 0 && !String(part || "").match(/^(LND|TNS):\s*$/);
      }).join(" | ");
      if (freeForAllPageText.trim().length > 0) {
        sundayRows.push(["To be announce - " + freeForAllCounter, "Feather", "Emperium Overrun", "Unclaim", freeForAllPageText, sundayDate]);
        freeForAllCounter += 1;
      }
    }
  }

  var freeForAllCardLeftover = Number(distribution.leftoverByReward["Card Fragment"] || 0);
  while (freeForAllCardLeftover > 0) {
    var cardChunk = Math.min(perPlayerCounts["Card Fragment"], freeForAllCardLeftover);
    sundayRows.push(["To be announce - " + freeForAllCounter, "Card", "Emperium Overrun", "Unclaim", computePageString(cardSlot, cardSlot + cardChunk - 1), sundayDate]);
    cardSlot += cardChunk;
    freeForAllCardLeftover -= cardChunk;
    freeForAllCounter += 1;
  }

  if (sundayRows.length > 0) {
    var insertStart = dataSheet.getLastRow() + 1;
    dataSheet.getRange(insertStart, 1, sundayRows.length, 6).setValues(sundayRows);
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    groupRanking: groupRanking,
    guildRanking: guildRanking,
    sundayDate: sundayDate,
    rowsInserted: sundayRows.length,
    cycledRowsUpdated: 0,
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

function normalizeAuctionDataRewardKeys(reward) {
  var normalized = String(reward || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!normalized) {
    return [];
  }

  if (normalized === "feather") {
    return ["LND", "TNS"];
  }

  if (normalized === "lnd" || normalized.indexOf("lightanddark") !== -1) {
    return ["LND"];
  }

  if (normalized === "tns" || normalized.indexOf("timeandspace") !== -1) {
    return ["TNS"];
  }

  if (normalized === "card" || normalized.indexOf("cardfrag") !== -1 || normalized.indexOf("cardfragment") !== -1) {
    return ["Card Fragment"];
  }

  if (normalized.indexOf("leagueprize") !== -1) {
    return ["League Prize"];
  }

  if (normalized.indexOf("illusionfragment") !== -1 || (normalized.indexOf("illusion") !== -1 && normalized.indexOf("fragmentpack") !== -1)) {
    return ["Illusion Fragment"];
  }

  return [];
}

function getAuctionDataPagesByReward(reward, pages) {
  var pageText = String(pages || "").trim();
  if (!pageText) {
    return {};
  }

  if (String(reward || "").trim().toLowerCase() !== "feather") {
    var rewardKeys = normalizeAuctionDataRewardKeys(reward);
    if (rewardKeys.length === 0) {
      return {};
    }
    var singleResult = {};
    singleResult[rewardKeys[0]] = pageText;
    return singleResult;
  }

  var segments = pageText.split("|");
  var result = {};

  for (var i = 0; i < segments.length; i++) {
    var segment = String(segments[i] || "").trim();
    if (!segment) {
      continue;
    }

    var separatorIndex = segment.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    var rewardName = segment.slice(0, separatorIndex).trim();
    var pageValue = segment.slice(separatorIndex + 1).trim();
    var rewardKeys = normalizeAuctionDataRewardKeys(rewardName);
    if (rewardKeys.length > 0 && pageValue) {
      result[rewardKeys[0]] = pageValue;
    }
  }

  return result;
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
  var normalizedReward = String(reward || "").trim().toLowerCase();
  var targetColumns = [];

  if (normalizedReward === "feather") {
    var featherCol = getRewardColumnIndexByAliases(headerInfo, "Feather");
    if (featherCol) {
      targetColumns.push({ reward: "Feather", column: featherCol });
    } else {
      // Backward compatibility for old layouts with split LND/TNS columns.
      var lndCol = getRewardColumnIndexByAliases(headerInfo, "LND");
      var tnsCol = getRewardColumnIndexByAliases(headerInfo, "TNS");

      if (!lndCol || !tnsCol) {
        return { error: "Column \"Feather\" not found in row 1." };
      }

      targetColumns.push({ reward: "LND", column: lndCol });
      targetColumns.push({ reward: "TNS", column: tnsCol });
    }
  } else {
    var targetCol = getRewardColumnIndexByAliases(headerInfo, reward);
    if (!targetCol) {
      return { error: "Column \"" + reward + "\" not found in row 1." };
    }

    targetColumns.push({
      reward: reward,
      column: targetCol,
    });
  }

  var insertedRows = [];
  for (var c = 0; c < targetColumns.length; c++) {
    var targetInfo = targetColumns[c];
    var targetRow = findFirstEmptyRow(auctionSheet, targetInfo.column, 2);
    auctionSheet.getRange(targetRow, targetInfo.column).setValue(ign);
    insertedRows.push(targetRow);
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    row: insertedRows.length > 0 ? insertedRows[0] : 0,
    rowsInserted: insertedRows,
    column: targetColumns.length === 1 ? targetColumns[0].reward : "Feather",
    columnsInserted: targetColumns.map(function(item) { return item.reward; }),
    gameIdStored: memberCheck.gameIdStored,
  };
}

function handleChangeIgnJob(params) {
  var ign = (params.ign || "").trim();
  var changeType = String(params.changeType || "").trim().toLowerCase();
  var newIgn = (params.newIgn || "").trim();
  var newClass = (params.newClass || "").trim();
  var gameId = (params.gameId || "").trim();

  if (!ign || !changeType || !gameId) {
    return { error: "Missing ign, changeType, or gameId parameter." };
  }

  if (changeType !== "ign" && changeType !== "job") {
    return { error: "Invalid changeType. Use ign or job." };
  }

  if (changeType === "ign" && !newIgn) {
    return { error: "Missing newIgn parameter." };
  }

  if (changeType === "job" && !newClass) {
    return { error: "Missing newClass parameter." };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var membersSheet = ss.getSheetByName(MEMBERS_SHEET_NAME);

  if (!membersSheet) {
    return { error: "Sheet \"" + MEMBERS_SHEET_NAME + "\" not found." };
  }

  var memberCheck = validateOrSaveMemberGameIdByIgn(membersSheet, ign, gameId);
  if (!memberCheck.success) {
    return { error: memberCheck.error };
  }

  var targetRow = findMemberRowByIgn(membersSheet, ign);
  if (targetRow === -1) {
    return { error: "IGN not found in ROOC Members Data." };
  }

  if (changeType === "ign") {
    var newIgnRow = findMemberRowByIgn(membersSheet, newIgn);
    if (newIgnRow !== -1 && newIgnRow !== targetRow) {
      return { error: "New IGN already exists in ROOC Members Data." };
    }

    membersSheet.getRange(targetRow, 5).setValue(ign);
    membersSheet.getRange(targetRow, 1).setValue(newIgn);

    SpreadsheetApp.flush();
    return {
      success: true,
      changeType: "ign",
      previousIgn: ign,
      updatedIgn: newIgn,
      row: targetRow,
      gameIdStored: memberCheck.gameIdStored,
    };
  }

  membersSheet.getRange(targetRow, 3).setValue(newClass);
  SpreadsheetApp.flush();
  return {
    success: true,
    changeType: "job",
    ign: ign,
    updatedClass: newClass,
    row: targetRow,
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

function findMemberRowByIgn(membersSheet, ign) {
  var lastRow = membersSheet.getLastRow();
  if (lastRow < 1) {
    return -1;
  }

  var values = membersSheet.getRange(1, 1, lastRow, 1).getValues();
  var startRow = 1;
  if (values.length > 0 && String(values[0][0] || "").trim().toLowerCase() === "ign") {
    startRow = 2;
  }

  var targetIgn = String(ign || "").trim().toLowerCase();
  if (!targetIgn) {
    return -1;
  }

  for (var i = startRow - 1; i < values.length; i++) {
    var rowIgn = String(values[i][0] || "").trim().toLowerCase();
    if (rowIgn && rowIgn === targetIgn) {
      return i + 1;
    }
  }

  return -1;
}

function handleRandomize(params) {
  var triggerIgn   = (params.triggerIgn   || "").trim();
  var gameId       = (params.gameId       || "").trim();
  var selectedDay  = String(params.day || "").trim().toLowerCase();
  var guildLeagueResult = String(params.guildLeagueResult || "").trim().toLowerCase();
  var pointDifference = Math.max(0, Number(params.pointDifference || 0));
  var timerSeconds = Number(params.timerSeconds || 1);

  // Winner-per-GL and per-player counts sent from the client
  var winnerPerGLLND  = Math.max(0, Number(params.winnerPerGLLND  || 0));
  var winnerPerGLTNS  = Math.max(0, Number(params.winnerPerGLTNS  || 0));
  var winnerPerGLCard = Math.max(0, Number(params.winnerPerGLCard || 0));
  var perPlayerLND    = Math.max(1, Number(params.perPlayerLND    || PER_PLAYER_DEFAULTS_GS["LND"]));
  var perPlayerTNS    = Math.max(1, Number(params.perPlayerTNS    || PER_PLAYER_DEFAULTS_GS["TNS"]));
  var perPlayerCard   = Math.max(1, Number(params.perPlayerCard   || PER_PLAYER_DEFAULTS_GS["Card Fragment"]));

  if (!triggerIgn || !gameId) {
    return { error: "Missing triggerIgn or gameId parameter." };
  }

  if (isNaN(timerSeconds) || timerSeconds <= 0) {
    timerSeconds = 1;
  }

  if (selectedDay !== "tuesday" && selectedDay !== "thursday") {
    selectedDay = "tuesday";
  }

  var legacyIncludeLeaguePrize = String(params.guildLeagueWinner || params.includeLeaguePrizeTab || "").trim().toLowerCase() === "true";
  var leaguePrizeConfig = getLeaguePrizeConfig(guildLeagueResult, pointDifference, legacyIncludeLeaguePrize);

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

  var shouldShuffle = selectedDay === "tuesday";
  var randomized = randomizeRewardColumns(auctionSheet, shouldShuffle);

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
    var auctionDate = selectedDay === "thursday" ? weekDates.thursday : weekDates.tuesday;
    var winnerCounts = {
      "LND": winnerPerGLLND,
      "TNS": winnerPerGLTNS,
      "Card Fragment": winnerPerGLCard,
    };
    var perPlayerCounts = {
      "LND": perPlayerLND,
      "TNS": perPlayerTNS,
      "Card Fragment": perPlayerCard,
    };
    saveWinnersToAuctionData(dataSheet, randomized, winnerCounts, perPlayerCounts, auctionDate, leaguePrizeConfig, selectedDay, weekDates);
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    timerSeconds: timerSeconds,
    guildLeagueResult: guildLeagueResult,
    pointDifference: pointDifference,
    selectedDay: selectedDay,
    shuffled: shouldShuffle,
    leaguePrize: leaguePrizeConfig,
    randomized: randomized,
  };
}

function getLeaguePrizeConfig(guildLeagueResult, pointDifference, legacyIncludeLeaguePrize) {
  var result = String(guildLeagueResult || "").trim().toLowerCase();
  var diff = Math.max(0, Number(pointDifference || 0));

  if (result === "won") {
    return { enabled: true, multiplier: 1.0, reason: "victory" };
  }

  if (result === "lost") {
    if (diff < 500) {
      return { enabled: true, multiplier: 0.7, reason: "loss-under-500" };
    }

    if (diff < 1500) {
      return { enabled: true, multiplier: 0.5, reason: "loss-under-1500" };
    }

    return { enabled: false, multiplier: 0, reason: "loss-1500-or-more" };
  }

  return {
    enabled: !!legacyIncludeLeaguePrize,
    multiplier: legacyIncludeLeaguePrize ? 1.0 : 0,
    reason: legacyIncludeLeaguePrize ? "legacy-enabled" : "legacy-disabled",
  };
}

function randomizeRewardColumns(sheet, shouldShuffle) {
  var headerInfo = getHeaderInfo(sheet);
  var randomizedResult = {};
  var shuffleEnabled = shouldShuffle !== false;
  var sharedFeatherColumn = getRewardColumnIndexByAliases(headerInfo, "Feather");
  var sharedFeatherValues = null;

  if (sharedFeatherColumn) {
    sharedFeatherValues = readNonEmptyColumnValues(sheet, sharedFeatherColumn, 2);
    if (shuffleEnabled) {
      fisherYatesShuffle(sharedFeatherValues);

      clearColumnFromRow(sheet, sharedFeatherColumn, 2);
      if (sharedFeatherValues.length > 0) {
        var featherOutput = sharedFeatherValues.map(function(name) { return [name]; });
        sheet.getRange(2, sharedFeatherColumn, featherOutput.length, 1).setValues(featherOutput);
      }
    }
  }

  for (var i = 0; i < REWARD_COLUMNS.length; i++) {
    var rewardName = REWARD_COLUMNS[i];

    if ((rewardName === "LND" || rewardName === "TNS") && sharedFeatherValues !== null) {
      randomizedResult[rewardName] = sharedFeatherValues.slice();
      continue;
    }

    var col = getRewardColumnIndexByAliases(headerInfo, rewardName);

    if (!col) {
      randomizedResult[rewardName] = [];
      continue;
    }

    var values = readNonEmptyColumnValues(sheet, col, 2);
    if (shuffleEnabled) {
      fisherYatesShuffle(values);

      clearColumnFromRow(sheet, col, 2);
      if (values.length > 0) {
        var output = values.map(function(name) { return [name]; });
        sheet.getRange(2, col, output.length, 1).setValues(output);
      }
    }

    randomizedResult[rewardName] = values;
  }

  return randomizedResult;
}

function getRewardColumnIndexByAliases(headerInfo, rewardName) {
  var headers = (headerInfo && headerInfo.headers) || [];
  var normalizedHeaders = [];
  for (var i = 0; i < headers.length; i++) {
    normalizedHeaders.push(String(headers[i] || "").toLowerCase().replace(/\s+/g, ""));
  }

  var candidatesByReward = {
    "Feather": ["feather", "lnd", "tns", "lightanddark", "timeandspace"],
    "LND": ["lnd", "lightanddark"],
    "TNS": ["tns", "timeandspace"],
    "Card Fragment": ["cardfragment", "cardfrag", "card"],
  };

  var candidates = candidatesByReward[rewardName] || [String(rewardName || "").toLowerCase().replace(/\s+/g, "")];

  for (var c = 0; c < candidates.length; c++) {
    var candidate = candidates[c];
    for (var h = 0; h < normalizedHeaders.length; h++) {
      if (normalizedHeaders[h] === candidate) {
        return h + 1;
      }
    }
  }

  return 0;
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
  var randomizedColumns = randomizeRewardColumns(auctionSheet, false);
  var rewardOrder = ["LND", "TNS", "Card Fragment"];
  var playersByReward = {
    "LND": [],
    "TNS": [],
    "Card Fragment": [],
  };
  var sourcePlayersByReward = {
    "LND": [],
    "TNS": [],
    "Card Fragment": [],
  };

  var existingWeekRecipientsByReward = {
    "LND": {},
    "TNS": {},
    "Card Fragment": {},
  };

  var weeklyTotalsByReward = {
    "LND": {},
    "TNS": {},
    "Card Fragment": {},
  };

  var lastRow = dataSheet.getLastRow();
  if (lastRow >= 2) {
    var values = dataSheet.getRange(2, 1, lastRow - 1, 6).getValues();
    for (var i = 0; i < values.length; i++) {
      var ign = String(values[i][0] || "").trim();
      var rowMeta = getAuctionDataRowMeta(values[i]);
      var reward = rowMeta.reward;
      var pages = rowMeta.pages;
      var date = rowMeta.date;
      var rewardKeys = normalizeAuctionDataRewardKeys(reward);
      if (!ign || rewardKeys.length === 0) {
        continue;
      }
      if (!weekDates) {
        continue;
      }
      if (date !== weekDates.tuesday && date !== weekDates.thursday) {
        continue;
      }

      var ignKey = ign.toLowerCase();
      var pagesByReward = getAuctionDataPagesByReward(reward, pages);

      for (var rk = 0; rk < rewardKeys.length; rk++) {
        var rewardKey = rewardKeys[rk];
        if (!weeklyTotalsByReward[rewardKey]) {
          continue;
        }

        existingWeekRecipientsByReward[rewardKey][ignKey] = true;

        var rewardPages = String(pagesByReward[rewardKey] || pages || "").trim();
        var quantity = countSlotsFromPageString(rewardPages);
        if (!weeklyTotalsByReward[rewardKey][ignKey]) {
          weeklyTotalsByReward[rewardKey][ignKey] = 0;
        }
        weeklyTotalsByReward[rewardKey][ignKey] += quantity;
      }
    }
  }

  for (var r = 0; r < rewardOrder.length; r++) {
    var rewardKey = rewardOrder[r];
    var uniquePlayers = uniqueStrings(randomizedColumns[rewardKey] || []);
    sourcePlayersByReward[rewardKey] = uniquePlayers.slice();
    if (rewardKey === "Card Fragment") {
      playersByReward[rewardKey] = uniquePlayers.filter(function(ign) {
        return !existingWeekRecipientsByReward[rewardKey][String(ign || "").toLowerCase()];
      });
    } else {
      playersByReward[rewardKey] = uniquePlayers;
    }
  }

  return {
    playersByReward: playersByReward,
    sourcePlayersByReward: sourcePlayersByReward,
    weeklyTotalsByReward: weeklyTotalsByReward,
  };
}

function getLastAwardedIgnByReward(dataSheet, weekDates) {
  var lastAwardedByReward = {
    "LND": "",
    "TNS": "",
    "Card Fragment": "",
  };

  if (!weekDates || !weekDates.tuesday || !weekDates.thursday) {
    return lastAwardedByReward;
  }

  var lastRow = dataSheet.getLastRow();
  if (lastRow < 2) {
    return lastAwardedByReward;
  }

  var values = dataSheet.getRange(2, 1, lastRow - 1, 6).getValues();
  for (var i = 0; i < values.length; i++) {
    var ign = String(values[i][0] || "").trim();
    var rowMeta = getAuctionDataRowMeta(values[i]);
    if (!ign || (rowMeta.date !== weekDates.tuesday && rowMeta.date !== weekDates.thursday)) {
      continue;
    }

    var rewardKeys = normalizeAuctionDataRewardKeys(rowMeta.reward);
    for (var rk = 0; rk < rewardKeys.length; rk++) {
      if (Object.prototype.hasOwnProperty.call(lastAwardedByReward, rewardKeys[rk])) {
        lastAwardedByReward[rewardKeys[rk]] = ign;
      }
    }
  }

  return lastAwardedByReward;
}

function getOverrunCycleStartIndexes(overrunPlayerState, dataSheet, weekDates) {
  var rewardOrder = ["LND", "TNS", "Card Fragment"];
  var playersByReward = (overrunPlayerState && overrunPlayerState.playersByReward) || {};
  var sourcePlayersByReward = (overrunPlayerState && overrunPlayerState.sourcePlayersByReward) || {};
  var lastAwardedByReward = getLastAwardedIgnByReward(dataSheet, weekDates);
  var startIndexes = {
    "LND": 0,
    "TNS": 0,
    "Card Fragment": 0,
  };

  for (var r = 0; r < rewardOrder.length; r++) {
    var rewardKey = rewardOrder[r];
    var eligiblePlayers = playersByReward[rewardKey] || [];
    var sourcePlayers = sourcePlayersByReward[rewardKey] || eligiblePlayers;
    var lastIgn = String(lastAwardedByReward[rewardKey] || "").trim();

    if (eligiblePlayers.length === 0 || sourcePlayers.length === 0 || !lastIgn) {
      continue;
    }

    var eligibleIndexByIgn = {};
    for (var i = 0; i < eligiblePlayers.length; i++) {
      eligibleIndexByIgn[eligiblePlayers[i].toLowerCase()] = i;
    }

    var lastSourceIndex = -1;
    for (var x = 0; x < sourcePlayers.length; x++) {
      if (String(sourcePlayers[x] || "").toLowerCase() === lastIgn.toLowerCase()) {
        lastSourceIndex = x;
        break;
      }
    }

    if (lastSourceIndex === -1) {
      continue;
    }

    for (var step = 1; step <= sourcePlayers.length; step++) {
      var nextIgn = String(sourcePlayers[(lastSourceIndex + step) % sourcePlayers.length] || "").trim();
      var nextEligibleIndex = eligibleIndexByIgn[nextIgn.toLowerCase()];
      if (nextIgn && nextEligibleIndex !== undefined) {
        startIndexes[rewardKey] = nextEligibleIndex;
        break;
      }
    }
  }

  return startIndexes;
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

function buildCycledQuantities(players, totalRewards, startOffset) {
  var quantities = [];
  for (var i = 0; i < players.length; i++) {
    quantities.push(0);
  }

  var offset = Math.max(0, Number(startOffset || 0));
  for (var rewardUnit = 0; rewardUnit < totalRewards; rewardUnit++) {
    var targetIndex = (offset + rewardUnit) % players.length;
    quantities[targetIndex] += 1;
  }

  return quantities;
}

function buildSequentialQuantities(players, totalWinners, startOffset) {
  var quantities = [];
  for (var i = 0; i < players.length; i++) {
    quantities.push(0);
  }

  if (players.length === 0 || totalWinners <= 0) {
    return quantities;
  }

  var offset = Math.max(0, Number(startOffset || 0)) % players.length;
  var winnersToAssign = Math.min(totalWinners, players.length);

  for (var rewardUnit = 0; rewardUnit < winnersToAssign; rewardUnit++) {
    var targetIndex = (offset + rewardUnit) % players.length;
    quantities[targetIndex] = 1;
  }

  return quantities;
}

function buildOverrunDistribution(overrunPlayerState, rankRewards, winnerCountsByReward, perPlayerCounts, cycleOffsetsByReward) {
  var rewardOrder = ["LND", "TNS", "Card Fragment"];
  var playersByReward = (overrunPlayerState && overrunPlayerState.playersByReward) || {
    "LND": [],
    "TNS": [],
    "Card Fragment": [],
  };
  var weeklyTotalsByReward = (overrunPlayerState && overrunPlayerState.weeklyTotalsByReward) || {
    "LND": {},
    "TNS": {},
    "Card Fragment": {},
  };
  var cycleOffsets = cycleOffsetsByReward || {
    "LND": 0,
    "TNS": 0,
    "Card Fragment": 0,
  };

  var allocationsByReward = {
    "LND": [],
    "TNS": [],
    "Card Fragment": [],
  };
  var leftoverByReward = {
    "LND": 0,
    "TNS": 0,
    "Card Fragment": 0,
  };

  for (var r = 0; r < rewardOrder.length; r++) {
    var rewardKey = rewardOrder[r];
    var players = playersByReward[rewardKey] || [];
    var totalRewards = Number(rankRewards[rewardKey] || 0);
    var totalWinners = Number((winnerCountsByReward && winnerCountsByReward[rewardKey]) || 0);
    var perPlayer = Math.max(1, Number((perPlayerCounts && perPlayerCounts[rewardKey]) || 1));

    if (players.length === 0 || totalWinners <= 0) {
      leftoverByReward[rewardKey] = Math.max(totalRewards, 0);
      continue;
    }

    var quantities = buildSequentialQuantities(players, totalWinners, cycleOffsets[rewardKey] || 0);

    var allocations = [];
    for (var p = 0; p < players.length; p++) {
      allocations.push({
        ign: players[p],
        quantity: Number(quantities[p] || 0),
      });
    }

    allocationsByReward[rewardKey] = allocations;
    leftoverByReward[rewardKey] = Math.max(totalRewards - (Math.min(totalWinners, players.length) * perPlayer), 0);
  }

  return {
    allocationsByReward: allocationsByReward,
    leftoverByReward: leftoverByReward,
  };
}

function applyCycleBackToExistingRows(dataSheet, leftoverByReward, weekDates) {
  return 0;
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
function saveWinnersToAuctionData(dataSheet, randomized, winnerCounts, perPlayerCounts, auctionDate, leaguePrizeConfig, selectedDay, weekDates) {
  var allRows = [];
  var baseOffsets = getGuildLeagueCycleOffsets(dataSheet, selectedDay, weekDates, perPlayerCounts);

  var guildLeagueRows = buildGuildAuctionRowsByTab("Guild League", randomized, winnerCounts, perPlayerCounts, auctionDate, baseOffsets);
  allRows = allRows.concat(guildLeagueRows);

  var leaguePrizeEnabled = false;
  var leaguePrizeMultiplier = 0;
  if (typeof leaguePrizeConfig === "boolean") {
    leaguePrizeEnabled = leaguePrizeConfig;
    leaguePrizeMultiplier = leaguePrizeConfig ? 1 : 0;
  } else {
    leaguePrizeEnabled = !!(leaguePrizeConfig && leaguePrizeConfig.enabled);
    leaguePrizeMultiplier = Number((leaguePrizeConfig && leaguePrizeConfig.multiplier) || 0);
  }

  if (leaguePrizeEnabled && leaguePrizeMultiplier > 0) {
    var scaledWinnerCounts = {
      "LND": Math.ceil(Number(winnerCounts["LND"] || 0) * leaguePrizeMultiplier),
      "TNS": Math.ceil(Number(winnerCounts["TNS"] || 0) * leaguePrizeMultiplier),
      "Card Fragment": Math.ceil(Number(winnerCounts["Card Fragment"] || 0) * leaguePrizeMultiplier),
    };

    var leaguePrizeOffsets = {
      "LND": Number(baseOffsets["LND"] || 0) + Number(winnerCounts["LND"] || 0),
      "TNS": Number(baseOffsets["TNS"] || 0) + Number(winnerCounts["TNS"] || 0),
      "Card Fragment": Number(baseOffsets["Card Fragment"] || 0) + Number(winnerCounts["Card Fragment"] || 0),
    };

    var leaguePrizeRows = buildGuildAuctionRowsByTab("League Prize", randomized, scaledWinnerCounts, perPlayerCounts, auctionDate, leaguePrizeOffsets);
    allRows = allRows.concat(leaguePrizeRows);
  }

  if (allRows.length > 0) {
    var startRow = dataSheet.getLastRow() + 1;
    dataSheet.getRange(startRow, 1, allRows.length, 6).setValues(allRows);
  }
}

function getGuildLeagueCycleOffsets(dataSheet, selectedDay, weekDates, perPlayerCounts) {
  var offsets = {
    "LND": 0,
    "TNS": 0,
    "Card Fragment": 0,
  };
  var perPlayer = {
    "LND": Math.max(1, Number((perPlayerCounts && perPlayerCounts["LND"]) || PER_PLAYER_DEFAULTS_GS["LND"] || 1)),
    "TNS": Math.max(1, Number((perPlayerCounts && perPlayerCounts["TNS"]) || PER_PLAYER_DEFAULTS_GS["TNS"] || 1)),
    "Card Fragment": Math.max(1, Number((perPlayerCounts && perPlayerCounts["Card Fragment"]) || PER_PLAYER_DEFAULTS_GS["Card Fragment"] || 1)),
  };

  if (String(selectedDay || "").toLowerCase() !== "thursday") {
    return offsets;
  }

  if (!weekDates || !weekDates.tuesday || !weekDates.thursday) {
    return offsets;
  }

  var lastRow = dataSheet.getLastRow();
  if (lastRow < 2) {
    return offsets;
  }

  var values = dataSheet.getRange(2, 1, lastRow - 1, 6).getValues();
  for (var i = 0; i < values.length; i++) {
    var rowMeta = getAuctionDataRowMeta(values[i]);
    var rowDate = rowMeta.date;
    if (rowDate !== weekDates.tuesday && rowDate !== weekDates.thursday) {
      continue;
    }

    var pagesByReward = getAuctionDataPagesByReward(rowMeta.reward, rowMeta.pages);
    if (pagesByReward["LND"]) {
      offsets["LND"] += Math.ceil(countSlotsFromPageString(pagesByReward["LND"]) / perPlayer["LND"]);
    }
    if (pagesByReward["TNS"]) {
      offsets["TNS"] += Math.ceil(countSlotsFromPageString(pagesByReward["TNS"]) / perPlayer["TNS"]);
    }
    if (pagesByReward["Card Fragment"]) {
      offsets["Card Fragment"] += Math.ceil(countSlotsFromPageString(pagesByReward["Card Fragment"]) / perPlayer["Card Fragment"]);
    }
  }

  return offsets;
}

function buildGuildAuctionRowsByTab(tabName, randomized, winnerCounts, perPlayerCounts, auctionDate, winnerOffsets) {
  var rows = [];
  var featherPartsByIgn = {};
  var featherOrder = [];
  var featherRewards = ["LND", "TNS"];
  var featherSlotOffset = 0;
  var offsets = winnerOffsets || {};

  for (var r = 0; r < featherRewards.length; r++) {
    var featherRewardKey = featherRewards[r];
    var featherWinners = randomized[featherRewardKey] || [];
    var featherWinnerN = Number(winnerCounts[featherRewardKey] || 0);
    var featherPerPlayer = Number(perPlayerCounts[featherRewardKey] || 1);

    if (featherWinners.length === 0 || featherWinnerN <= 0) {
      featherSlotOffset += featherWinnerN * featherPerPlayer;
      continue;
    }

    for (var i = 0; i < featherWinnerN; i++) {
      var listIdx = (Number(offsets[featherRewardKey] || 0) + i) % featherWinners.length;
      var ign = String(featherWinners[listIdx] || "").trim();
      if (!ign) {
        continue;
      }

      var startSlot = featherSlotOffset + i * featherPerPlayer + 1;
      var endSlot = featherSlotOffset + (i + 1) * featherPerPlayer;
      var pageLabel = computePageString(startSlot, endSlot);

      var ignKey = ign.toLowerCase();
      if (!featherPartsByIgn[ignKey]) {
        featherPartsByIgn[ignKey] = {
          ign: ign,
          lnd: [],
          tns: [],
        };
        featherOrder.push(ignKey);
      }

      if (featherRewardKey === "LND") {
        featherPartsByIgn[ignKey].lnd.push(pageLabel);
      } else {
        featherPartsByIgn[ignKey].tns.push(pageLabel);
      }
    }

    featherSlotOffset += featherWinnerN * featherPerPlayer;
  }

  for (var f = 0; f < featherOrder.length; f++) {
    var featherEntry = featherPartsByIgn[featherOrder[f]];
    var featherParts = [];
    if (featherEntry.lnd.length > 0) {
      featherParts.push("LND: " + featherEntry.lnd.join(", "));
    }
    if (featherEntry.tns.length > 0) {
      featherParts.push("TNS: " + featherEntry.tns.join(", "));
    }
    if (featherParts.length === 0) {
      continue;
    }

    rows.push([
      featherEntry.ign,
      "Feather",
      tabName,
      "Unclaim",
      featherParts.join(" | "),
      auctionDate,
    ]);
  }

  var cardWinners = randomized["Card Fragment"] || [];
  var cardWinnerN = Number(winnerCounts["Card Fragment"] || 0);
  var cardPerPlayer = Number(perPlayerCounts["Card Fragment"] || 1);
  var cardSlotOffset = 0;

  if (cardWinners.length > 0 && cardWinnerN > 0) {
    for (var c = 0; c < cardWinnerN; c++) {
      var cardListIdx = (Number(offsets["Card Fragment"] || 0) + c) % cardWinners.length;
      var cardIgn = String(cardWinners[cardListIdx] || "").trim();
      if (!cardIgn) {
        continue;
      }

      var cardStartSlot = cardSlotOffset + c * cardPerPlayer + 1;
      var cardEndSlot = cardSlotOffset + (c + 1) * cardPerPlayer;
      rows.push([
        cardIgn,
        "Card",
        tabName,
        "Unclaim",
        computePageString(cardStartSlot, cardEndSlot),
        auctionDate,
      ]);
    }
  }

  return rows;
}

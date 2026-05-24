"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logoImage from "./assets/logo.png";

const SHEET_ID = "1Uyho2Vk0j45oAPiYu0GLCMHn7be3E7h92-bREAS443s";
const SHEET_NAME = "ROOC Auction Roulette";
const MAIN_SHEET_GID = "946119161";
const AUCTION_DATA_GID = "1683453103";
const MEMBERS_SHEET_NAME = "ROOC Members Data";
const MEMBERS_DATA_GID = "114714217";
const TRIGGER_SHEET_GID = "1887602829";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwuAN32PCUIf1IBl_TLro32XGdpN9BBqobrVpxBn6XBMJwZuLeuYuy-_g1Bfugo8cRSKA/exec";

const REWARD_OPTIONS = [
  { label: "Light and Dark", value: "LND" },
  { label: "Time and Space", value: "TNS" },
  { label: "Card Fragment", value: "Card Fragment" },
];

const INSERT_REWARD_OPTIONS = [
  { label: "Feather", value: "Feather", badge: "LND and TNS" },
  { label: "Card Fragment", value: "Card Fragment", badge: "Card Fragment" },
];

const CHANGE_FIELD_OPTIONS = [
  { label: "IGN", value: "ign" },
  { label: "Job", value: "job" },
];

const CHANGE_CLASS_OPTIONS = [
  { label: "Lord Knight", value: "Lord Knight" },
  { label: "Paladin", value: "Paladin" },
  { label: "High Priest", value: "High Priest" },
  { label: "Champion", value: "Champion" },
  { label: "Assassin Cross", value: "Assassin Cross" },
  { label: "Stalker", value: "Stalker" },
  { label: "Whitesmith", value: "Whitesmith" },
  { label: "Biochemist", value: "Biochemist" },
  { label: "Sniper", value: "Sniper" },
  { label: "Minstrel", value: "Minstrel" },
  { label: "Gypsy", value: "Gypsy" },
  { label: "High Wizard", value: "High Wizard" },
  { label: "Professor", value: "Professor" },
  { label: "Summoner", value: "Summoner" },
];

const PER_PLAYER_DEFAULTS = {
  LND: 3,
  TNS: 5,
  "Card Fragment": 1,
};

const GL_TIER_OPTIONS = [
  { label: "Bronze",        value: "Bronze",        totals: { LND: 30,  TNS: 50,  "Card Fragment": 2 } },
  { label: "Silver",        value: "Silver",        totals: { LND: 35,  TNS: 60,  "Card Fragment": 2 } },
  { label: "Gold",          value: "Gold",          totals: { LND: 40,  TNS: 70,  "Card Fragment": 2 } },
  { label: "Platinum",      value: "Platinum",      totals: { LND: 45,  TNS: 80,  "Card Fragment": 2 } },
  { label: "Shinning Stars",value: "Shinning Stars",totals: { LND: 47,  TNS: 85,  "Card Fragment": 2 } },
  { label: "Glorious Moon", value: "Glorious Moon", totals: { LND: 50,  TNS: 90,  "Card Fragment": 2 } },
  { label: "Bright Sun",    value: "Bright Sun",    totals: { LND: 55,  TNS: 100, "Card Fragment": 2 } },
];

const ADVANCED_OVERRUN_RANK_OPTIONS = [
  { label: "Rank 1", value: "1" },
  { label: "Rank 2", value: "2" },
  { label: "Rank 3", value: "3" },
  { label: "Rank 4", value: "4" },
  { label: "Rank 5", value: "5" },
  { label: "Rank 6", value: "6" },
  { label: "Rank 7", value: "7" },
  { label: "Rank 8", value: "8" },
];

const BEGINNER_OVERRUN_RANK_OPTIONS = [
  { label: "Rank 1", value: "1" },
  { label: "Rank 2", value: "2" },
  { label: "Rank 3", value: "3" },
  { label: "Rank 4", value: "4" },
  { label: "Rank 5", value: "5" },
  { label: "Rank 6", value: "6" },
  { label: "Rank 7", value: "7" },
  { label: "Rank 8 and below", value: "8+" },
];

const OVERRUN_GROUP_OPTIONS = [
  { label: "Advanced Group", value: "advanced" },
  { label: "Beginner Group", value: "beginner" },
];

const OVERRUN_GROUP_RANK_REWARDS = {
  advanced: {
    "1": { LND: 150, TNS: 170, "Card Fragment": 20 },
    "2": { LND: 140, TNS: 160, "Card Fragment": 20 },
    "3": { LND: 140, TNS: 160, "Card Fragment": 20 },
    "4": { LND: 120, TNS: 150, "Card Fragment": 15 },
    "5": { LND: 120, TNS: 150, "Card Fragment": 15 },
    "6": { LND: 120, TNS: 150, "Card Fragment": 15 },
    "7": { LND: 100, TNS: 150, "Card Fragment": 12 },
    "8": { LND: 100, TNS: 150, "Card Fragment": 12 },
  },
  beginner: {
    "1": { LND: 80, TNS: 140, "Card Fragment": 10 },
    "2": { LND: 75, TNS: 130, "Card Fragment": 9 },
    "3": { LND: 70, TNS: 120, "Card Fragment": 8 },
    "4": { LND: 65, TNS: 110, "Card Fragment": 5 },
    "5": { LND: 60, TNS: 100, "Card Fragment": 5 },
    "6": { LND: 50, TNS: 80, "Card Fragment": 5 },
    "7": { LND: 30, TNS: 30, "Card Fragment": 2 },
    "8+": { LND: 20, TNS: 20, "Card Fragment": 1 },
  },
};

function createEmptyRewardColumns() {
  return {
    LND: [],
    TNS: [],
    "Card Fragment": [],
  };
}

function createDefaultRewardFields() {
  return {
    LND: { perPlayer: String(PER_PLAYER_DEFAULTS.LND), total: "0", winnerPerGL: "0" },
    TNS: { perPlayer: String(PER_PLAYER_DEFAULTS.TNS), total: "0", winnerPerGL: "0" },
    "Card Fragment": { perPlayer: String(PER_PLAYER_DEFAULTS["Card Fragment"]), total: "0", winnerPerGL: "0" },
  };
}

function createDefaultOverrunRewardFields() {
  return {
    LND: { perPlayer: String(PER_PLAYER_DEFAULTS.LND) },
    TNS: { perPlayer: String(PER_PLAYER_DEFAULTS.TNS) },
    "Card Fragment": { perPlayer: String(PER_PLAYER_DEFAULTS["Card Fragment"]) },
  };
}

function computeGreatestCommonDivisor(leftValue, rightValue) {
  let a = Math.abs(parseNonNegativeInteger(leftValue));
  let b = Math.abs(parseNonNegativeInteger(rightValue));

  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }

  return a;
}

function getBestOverrunFeatherPlayerCount(totalLnd, totalTns) {
  const lnd = parseNonNegativeInteger(totalLnd);
  const tns = parseNonNegativeInteger(totalTns);
  if (lnd <= 0 || tns <= 0) {
    return 0;
  }

  const gcd = computeGreatestCommonDivisor(lnd, tns);
  if (gcd <= 0) {
    return 0;
  }

  // Keep Overrun winners manageable while preserving exact integer limits.
  let best = 0;
  for (let count = 1; count <= gcd; count += 1) {
    if (gcd % count !== 0) {
      continue;
    }

    if (count <= 10) {
      best = count;
    }
  }

  return best > 0 ? best : gcd;
}

const OFFICER_ROLE_KEYWORDS = ["officer", "guild leader", "vice guild leader"];

function normalizeValue(cell) {
  if (!cell) {
    return "";
  }

  if (typeof cell.f === "string" && cell.f.trim()) {
    return cell.f.trim();
  }

  if (cell.v === null || cell.v === undefined) {
    return "";
  }

  return String(cell.v).trim();
}

function extractRows(table) {
  return (table?.rows || []).map((row) => (row.c || []).map(normalizeValue));
}

function getColumnLabels(table, fallbackRows) {
  const labels = (table?.cols || []).map((col, index) => {
    const label = String(col?.label || "").trim();
    return label || `Column ${index + 1}`;
  });

  const hasMeaningfulLabels = labels.some((label) => {
    if (!label) {
      return false;
    }

    // gviz may return generic labels like A, B, C or Column N.
    if (/^Column\s+\d+$/i.test(label)) {
      return false;
    }

    if (/^[A-Z]+$/.test(label)) {
      return false;
    }

    return true;
  });

  if (hasMeaningfulLabels) {
    return labels;
  }

  if (fallbackRows.length > 0) {
    return fallbackRows[0].map((value, index) => value || `Column ${index + 1}`);
  }

  return labels;
}

function findColumnIndexByNames(columns, candidateNames) {
  const normalizedCandidates = candidateNames.map((name) => name.toLowerCase().replace(/\s+/g, ""));

  return columns.findIndex((column) => {
    const normalized = String(column || "").toLowerCase().replace(/\s+/g, "");
    return normalizedCandidates.includes(normalized);
  });
}

function normalizeRewardKey(value) {
  const normalized = String(value || "").toLowerCase().replace(/\s+/g, "");

  if (!normalized) {
    return "";
  }

  if (normalized === "lnd" || normalized.includes("lightanddark")) {
    return "LND";
  }

  if (normalized === "tns" || normalized.includes("timeandspace")) {
    return "TNS";
  }

  if (normalized === "card" || normalized.includes("cardfrag") || normalized.includes("cardfragment")) {
    return "Card Fragment";
  }

  return "";
}

function expandAuctionDataRewardKeys(reward) {
  const normalized = String(reward || "").toLowerCase().replace(/\s+/g, "");

  if (!normalized) {
    return [];
  }

  if (normalized === "feather") {
    return ["LND", "TNS"];
  }

  const key = normalizeRewardKey(reward);
  return key ? [key] : [];
}

function splitAuctionDataPages(reward, pages) {
  const pageText = String(pages || "").trim();
  if (!pageText) {
    return {};
  }

  if (String(reward || "").trim().toLowerCase() !== "feather") {
    const rewardKey = normalizeRewardKey(reward) || String(reward || "").trim();
    return rewardKey ? { [rewardKey]: pageText } : {};
  }

  const segments = pageText.split("|").map((segment) => segment.trim()).filter(Boolean);
  const pagesByReward = {};

  for (const segment of segments) {
    const separatorIndex = segment.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const rewardName = segment.slice(0, separatorIndex).trim();
    const pageValue = segment.slice(separatorIndex + 1).trim();
    const rewardKey = normalizeRewardKey(rewardName);
    if (rewardKey && pageValue) {
      pagesByReward[rewardKey] = pageValue;
    }
  }

  return pagesByReward;
}

function createEmptyAuctionTabs() {
  return {
    "Emperium Overrun": createEmptyRewardColumns(),
    "Guild League": createEmptyRewardColumns(),
    "League Prize": createEmptyRewardColumns(),
  };
}

function normalizeAuctionTab(value) {
  const normalized = String(value || "").toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("leagueprize")) {
    return "League Prize";
  }

  if (normalized.includes("overrun")) {
    return "Emperium Overrun";
  }

  return "Guild League";
}

function combineFeatherEntries(lndEntries, tnsEntries) {
  const orderedKeys = [];
  const byIgn = new Map();

  function ensureEntry(entry) {
    const ign = String(entry?.ign || "").trim();
    if (!ign) {
      return null;
    }

    const key = ign.toLowerCase();
    if (!byIgn.has(key)) {
      byIgn.set(key, {
        ign,
        lndPages: "",
        tnsPages: "",
        lndStatus: "",
        tnsStatus: "",
      });
      orderedKeys.push(key);
    }

    return byIgn.get(key);
  }

  function extractPages(rawPages, rewardType) {
    const pageStr = String(rawPages || "").trim();
    if (!pageStr) return "";
    
    // Check if the value contains the requested reward type
    // Handle both single values ("LND: Page 33") and pipe-separated ("LND: Page 1 | TNS: Page 2")
    const parts = pageStr.split("|").map((p) => p.trim());
    for (const part of parts) {
      if (part.match(new RegExp(`^${rewardType}:\\s*`, "i"))) {
        // Found the correct reward type, extract the page part
        return part.replace(new RegExp(`^${rewardType}:\\s*`, "i"), "");
      }
    }
    
    // If we found the reward type elsewhere (wrong type), return empty
    if (pageStr.match(/^(LND|TNS):/i)) {
      return "";
    }
    
    // Otherwise return the original (shouldn't happen with correct data)
    return pageStr;
  }

  for (const entry of lndEntries || []) {
    const mergedEntry = ensureEntry(entry);
    if (!mergedEntry) {
      continue;
    }
    mergedEntry.lndPages = extractPages(entry.pages, "LND");
    mergedEntry.lndStatus = String(entry.status || "").trim();
  }

  for (const entry of tnsEntries || []) {
    const mergedEntry = ensureEntry(entry);
    if (!mergedEntry) {
      continue;
    }
    mergedEntry.tnsPages = extractPages(entry.pages, "TNS");
    mergedEntry.tnsStatus = String(entry.status || "").trim();
  }

  return orderedKeys.map((key) => byIgn.get(key));
}

function compareValues(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function parseNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function getDayLabelFromDateString(dateString) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return "Date";
  }

  return parsed.toLocaleDateString(undefined, { weekday: "long" });
}

function isThursdayFromDateString(dateString) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getDay() === 4;
}

function isTuesdayFromDateString(dateString) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getDay() === 2;
}

function isSundayFromDateString(dateString) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getDay() === 0;
}

function extractTableData(table) {
  const rawColumns = (table.cols || []).map((col, index) => col.label?.trim() || `Column ${index + 1}`);
  const rawRows = (table.rows || []).map((row) => (row.c || []).map(normalizeValue));

  if (rawRows.length > 0) {
    return {
      columns: rawRows[0].map((value, index) => value || `Column ${index + 1}`),
      rows: rawRows.slice(1),
    };
  }

  return {
    columns: rawColumns,
    rows: rawRows,
  };
}

function createJsonpLoader() {
  let activeScript = null;

  return function loadJsonp({ gid, callbackName, onResponse, onError }) {
    if (activeScript) {
      activeScript.remove();
      activeScript = null;
    }

    window[callbackName] = (response) => {
      onResponse(response);
      if (activeScript) {
        activeScript.remove();
        activeScript = null;
      }
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
    };

    const cacheBuster = Date.now();
    const script = document.createElement("script");
    script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:${callbackName}&gid=${gid}&cacheBust=${cacheBuster}`;
    script.onerror = () => {
      onError?.();
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
      if (activeScript) {
        activeScript.remove();
        activeScript = null;
      }
    };

    activeScript = script;
    document.body.appendChild(script);

    return () => {
      if (activeScript) {
        activeScript.remove();
        activeScript = null;
      }
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
    };
  };
}

function SelectField({ options, value, onChange, placeholder, searchPlaceholder, toLabel, toValue, toBadge, disabled }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return options.filter((option) => {
      const label = toLabel(option).toLowerCase();
      const candidateValue = toValue(option).toLowerCase();
      return label.includes(query) || candidateValue.includes(query);
    });
  }, [options, search, toLabel, toValue]);

  const selectedLabel = useMemo(() => {
    const found = options.find((option) => toValue(option) === value);
    return found ? toLabel(found) : "";
  }, [options, value, toLabel, toValue]);

  useEffect(() => {
    function handleOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div className="ss-wrap" ref={wrapRef}>
      <button
        type="button"
        className="ss-trigger"
        onClick={() => setOpen((state) => !state)}
        disabled={disabled}
      >
        <span className={selectedLabel ? "ss-selected" : "ss-placeholder"}>{selectedLabel || placeholder}</span>
        <span className="ss-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && !disabled && (
        <div className="ss-dropdown">
          <input
            className="ss-search"
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
          <div className="ss-list">
            {filtered.length === 0 ? (
              <div className="ss-empty">No matches</div>
            ) : (
              filtered.map((option) => {
                const optionValue = toValue(option);
                const optionLabel = toLabel(option);
                const optionBadge = toBadge ? toBadge(option) : optionValue;
                return (
                  <div
                    key={optionValue}
                    className={`ss-option${value === optionValue ? " ss-option--active" : ""}`}
                    onClick={() => {
                      onChange(optionValue);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="ss-opt-label">{optionLabel}</span>
                    <span className="ss-opt-badge">{optionBadge}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [isError, setIsError] = useState(false);
  const [auctionDataRows, setAuctionDataRows] = useState([]);
  const [lastShuffledAt, setLastShuffledAt] = useState("Shuffled last [-]");

  const [showInsertModal, setShowInsertModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [memberOptions, setMemberOptions] = useState([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [selectedIGN, setSelectedIGN] = useState("");
  const [selectedReward, setSelectedReward] = useState("");
  const [insertGameId, setInsertGameId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [selectedChangeIGN, setSelectedChangeIGN] = useState("");
  const [selectedChangeField, setSelectedChangeField] = useState("");
  const [newChangeIGN, setNewChangeIGN] = useState("");
  const [newChangeClass, setNewChangeClass] = useState("");
  const [changeGameId, setChangeGameId] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const [changeResult, setChangeResult] = useState(null);

  const [showRandomizerModal, setShowRandomizerModal] = useState(false);
  const [officerOptions, setOfficerOptions] = useState([]);
  const [selectedOfficerIGN, setSelectedOfficerIGN] = useState("");
  const [randomizerGameId, setRandomizerGameId] = useState("");
  const [selectedGLDay, setSelectedGLDay] = useState("tuesday");
  const [selectedGLTier, setSelectedGLTier] = useState("");
  const [timerInput, setTimerInput] = useState("00:00:05");
  const [guildLeagueResult, setGuildLeagueResult] = useState("");
  const [pointDifference, setPointDifference] = useState("3000");
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [randomizerResult, setRandomizerResult] = useState(null);
  const [randomizedColumns, setRandomizedColumns] = useState(createEmptyRewardColumns);
  const [displayedColumns, setDisplayedColumns] = useState(createEmptyRewardColumns);
  const [rewardFields, setRewardFields] = useState(createDefaultRewardFields);

  const [showOverrunModal, setShowOverrunModal] = useState(false);
  const [overrunOfficerIGN, setOverrunOfficerIGN] = useState("");
  const [overrunGameId, setOverrunGameId] = useState("");
  const [selectedOverrunGroup, setSelectedOverrunGroup] = useState("");
  const [selectedOverrunRank, setSelectedOverrunRank] = useState("");
  const [overrunRewardFields, setOverrunRewardFields] = useState(createDefaultOverrunRewardFields);
  const [officerCardBenefitEnabled, setOfficerCardBenefitEnabled] = useState(false);
  const [selectedOfficerCardRecipients, setSelectedOfficerCardRecipients] = useState([]);
  const [isGeneratingOverrun, setIsGeneratingOverrun] = useState(false);
  const [overrunResult, setOverrunResult] = useState(null);

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearOfficerIGN, setClearOfficerIGN] = useState("");
  const [clearGameId, setClearGameId] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimOfficerIGN, setClaimOfficerIGN] = useState("");
  const [claimGameId, setClaimGameId] = useState("");
  const [claimAuctionDate, setClaimAuctionDate] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState(null);
  const [isCopyToastVisible, setIsCopyToastVisible] = useState(false);

  const isFirstLoadRef = useRef(true);
  const lastSignatureRef = useRef("");
  const mainSheetLoaderRef = useRef(createJsonpLoader());
  const auctionDataLoaderRef = useRef(createJsonpLoader());
  const triggerSheetLoaderRef = useRef(createJsonpLoader());
  const membersLoaderRef = useRef(createJsonpLoader());
  const auctionNamesLoaderRef = useRef(createJsonpLoader());
  const shuffleIntervalRef = useRef(null);
  const shuffleTimeoutRef = useRef(null);
  const copyToastTimeoutRef = useRef(null);

  const filteredRows = useMemo(() => rows, [rows]);

  const fetchMembersData = useCallback(() => {
    setIsFetchingMembers(true);

    const pending = {
      memberOptions: null,
      officerNames: null,
      auctionNameSet: null,
    };

    const tryFinish = () => {
      if (!pending.memberOptions || !pending.officerNames || !pending.auctionNameSet) {
        return;
      }

      const filteredMemberOptions = pending.memberOptions.filter(
        (option) => !pending.auctionNameSet.has(option.ign.toLowerCase())
      );

      setMemberOptions(filteredMemberOptions);
      setOfficerOptions(pending.officerNames);
      setIsFetchingMembers(false);
    };

    membersLoaderRef.current({
      gid: MEMBERS_DATA_GID,
      callbackName: "__membersDataResponse",
      onResponse: (response) => {
        const table = response?.table;
        const rawRows = extractRows(table);

        if (rawRows.length === 0) {
          pending.memberOptions = [];
          pending.officerNames = [];
          tryFinish();
          return;
        }

        // Per sheet contract: IGN is always the first column.
        const ignIndex = 0;
        const isHeaderRow = String(rawRows[0][ignIndex] || "").trim().toLowerCase() === "ign";
        const dataRows = isHeaderRow ? rawRows.slice(1) : rawRows;

        // Insert IGN uses only the IGN column from ROOC Members Data.
        const badgeIndex = 2;
        const nextOptions = [];
        const seenIgn = new Set();

        for (let i = 0; i < dataRows.length; i += 1) {
          const row = dataRows[i] || [];
          const ign = String(row[ignIndex] || "").trim();
          const badge = String(row[badgeIndex] || "").trim();
          const normalizedBadge = badge.toLowerCase().replace(/[^a-z0-9]/g, "");
          const isExMember = normalizedBadge.includes("exmember");
          if (!ign || seenIgn.has(ign.toLowerCase())) {
            continue;
          }

          if (isExMember) {
            continue;
          }

          seenIgn.add(ign.toLowerCase());
          nextOptions.push({
            ign,
            badge,
          });
        }

        pending.memberOptions = nextOptions;

        // Per sheet contract: role rank for randomizer auth is in the 4th column.
        const roleIndex = 3;
        const officerRows = dataRows.filter((row) => {
          const role = String(row[roleIndex] || "").toLowerCase();
          return OFFICER_ROLE_KEYWORDS.some((keyword) => role.includes(keyword));
        });

        const officers = [...new Set(officerRows.map((row) => row[ignIndex]).filter(Boolean))];
        pending.officerNames = officers;
        tryFinish();
      },
      onError: () => {
        pending.memberOptions = [];
        pending.officerNames = [];
        tryFinish();
      },
    });

    auctionNamesLoaderRef.current({
      gid: MAIN_SHEET_GID,
      callbackName: "__auctionNamesResponse",
      onResponse: (response) => {
        const table = response?.table;
        const rawRows = extractRows(table);
        const namesInAuction = rawRows
          .slice(1)
          .flatMap((row) => row)
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .map((value) => value.toLowerCase());

        pending.auctionNameSet = new Set(namesInAuction);
        tryFinish();
      },
      onError: () => {
        pending.auctionNameSet = new Set();
        tryFinish();
      },
    });
  }, []);

  const handleMainSheetResponse = useCallback((response) => {
    const table = response?.table;

    if (!table) {
      setIsError(true);
      return;
    }

    const nextData = extractTableData(table);
    setColumns(nextData.columns);
    setRows(nextData.rows);

    setIsError(false);
    isFirstLoadRef.current = false;
  }, []);

  const loadAuctionData = useCallback(() => {
    auctionDataLoaderRef.current({
      gid: AUCTION_DATA_GID,
      callbackName: "__auctionDataResponse",
      onResponse: (response) => {
        const rawRows = extractRows(response?.table);
        if (rawRows.length === 0) {
          setAuctionDataRows([]);
          return;
        }

        // Check if row 0 looks like a header by examining the first row's content.
        // Headers typically contain column names like "IGN", "Reward", "Status", etc.
        const firstRow = rawRows[0] || [];
        const looksLikeHeader = firstRow[0] === "IGN" || firstRow[0] === "ign";
        
        // If the first row is a header, skip it. Otherwise, use all rows as data.
        const rowsOnly = looksLikeHeader ? rawRows.slice(1) : rawRows;
        
        const cleaned = rowsOnly
          .map((row) => [
            String(row[0] || "").trim(),
            String(row[1] || "").trim(),
            String(row[2] || "").trim(),
            String(row[3] || "").trim(),
            String(row[4] || "").trim(),
            String(row[5] || "").trim(),
          ])
          .filter((row) => row.some(Boolean));

        setAuctionDataRows(cleaned);
      },
      onError: () => {
        setAuctionDataRows([]);
      },
    });
  }, []);

  const loadTriggerTimestamp = useCallback(() => {
    triggerSheetLoaderRef.current({
      gid: TRIGGER_SHEET_GID,
      callbackName: "__triggerSheetResponse",
      onResponse: (response) => {
        const rawRows = extractRows(response?.table);
        const rowsOnly = rawRows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim()));
        if (rowsOnly.length === 0) {
          setLastShuffledAt("Shuffled last [-]");
          return;
        }

        const lastRow = rowsOnly[rowsOnly.length - 1] || [];
        const triggerValue = String(lastRow[2] || "").trim();
        setLastShuffledAt(`Shuffled last [${triggerValue || "-"}]`);
      },
      onError: () => {
        setLastShuffledAt("Shuffled last [-]");
      },
    });
  }, []);

  const loadSheet = useCallback(() => {
    setIsError(false);

    mainSheetLoaderRef.current({
      gid: MAIN_SHEET_GID,
      callbackName: "__membersTableResponse",
      onResponse: handleMainSheetResponse,
      onError: () => {
        setIsError(true);
      },
    });

    loadAuctionData();
    loadTriggerTimestamp();
  }, [handleMainSheetResponse, loadAuctionData, loadTriggerTimestamp]);

  const handleOpenInsert = useCallback(() => {
    setShowInsertModal(true);
    setSelectedIGN("");
    setSelectedReward("");
    setInsertGameId("");
    setSubmitResult(null);
    fetchMembersData();
  }, [fetchMembersData]);

  const handleOpenChange = useCallback(() => {
    setShowChangeModal(true);
    setSelectedChangeIGN("");
    setSelectedChangeField("");
    setNewChangeIGN("");
    setNewChangeClass("");
    setChangeGameId("");
    setChangeResult(null);
    fetchMembersData();
  }, [fetchMembersData]);

  const handleCloseChange = useCallback(() => {
    if (isChanging) {
      return;
    }
    setShowChangeModal(false);
  }, [isChanging]);

  const handleCloseInsert = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    setShowInsertModal(false);
  }, [isSubmitting]);

  const handleSubmitIGN = useCallback(() => {
    if (!selectedIGN || !selectedReward || !insertGameId || isSubmitting) {
      return;
    }

    if (!APPS_SCRIPT_URL) {
      setSubmitResult({ type: "error", message: "APPS_SCRIPT_URL is not set in page.js." });
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    const params = new URLSearchParams({
      action: "insertIgn",
      ign: selectedIGN,
      reward: selectedReward,
      gameId: insertGameId,
    });

    fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, { redirect: "follow" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setIsSubmitting(false);
        if (data.success) {
          setSubmitResult({ type: "success", message: `${selectedIGN} added successfully.` });
          setTimeout(() => {
            setShowInsertModal(false);
            loadSheet();
          }, 1200);
        } else {
          setSubmitResult({ type: "error", message: data.error || "An error occurred while inserting." });
        }
      })
      .catch((error) => {
        setIsSubmitting(false);
        setSubmitResult({ type: "error", message: `Request failed: ${error.message}. Make sure the Apps Script URL is valid and deployed as Anyone.` });
      });
  }, [insertGameId, isSubmitting, loadSheet, selectedIGN, selectedReward]);

  const handleSubmitChange = useCallback(() => {
    const requiresIgn = selectedChangeField === "ign";
    const requiresJob = selectedChangeField === "job";
    const hasChangeValue = (requiresIgn && newChangeIGN.trim()) || (requiresJob && newChangeClass);

    if (!selectedChangeIGN || !selectedChangeField || !changeGameId || !hasChangeValue || isChanging) {
      return;
    }

    if (!APPS_SCRIPT_URL) {
      setChangeResult({ type: "error", message: "APPS_SCRIPT_URL is not set in page.js." });
      return;
    }

    setIsChanging(true);
    setChangeResult(null);

    const params = new URLSearchParams({
      action: "changeIgnJob",
      ign: selectedChangeIGN,
      changeType: selectedChangeField,
      newIgn: newChangeIGN.trim(),
      newClass: newChangeClass,
      gameId: changeGameId,
    });

    fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, { redirect: "follow" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setIsChanging(false);
        if (data.success) {
          setChangeResult({ type: "success", message: "Member record updated successfully." });
          setTimeout(() => {
            setShowChangeModal(false);
            loadSheet();
          }, 1200);
        } else {
          setChangeResult({ type: "error", message: data.error || "An error occurred while updating member data." });
        }
      })
      .catch((error) => {
        setIsChanging(false);
        setChangeResult({ type: "error", message: `Request failed: ${error.message}. Make sure the Apps Script URL is valid and deployed as Anyone.` });
      });
  }, [changeGameId, isChanging, loadSheet, newChangeClass, newChangeIGN, selectedChangeField, selectedChangeIGN]);

  const handleGLTierChange = useCallback((tierValue) => {
    setSelectedGLTier(tierValue);
    const tier = GL_TIER_OPTIONS.find((t) => t.value === tierValue);
    if (!tier) {
      return;
    }
    setRewardFields({
      LND: {
        perPlayer: String(PER_PLAYER_DEFAULTS.LND),
        total: String(tier.totals.LND),
        winnerPerGL: String(Math.floor(tier.totals.LND / PER_PLAYER_DEFAULTS.LND)),
      },
      TNS: {
        perPlayer: String(PER_PLAYER_DEFAULTS.TNS),
        total: String(tier.totals.TNS),
        winnerPerGL: String(Math.floor(tier.totals.TNS / PER_PLAYER_DEFAULTS.TNS)),
      },
      "Card Fragment": {
        perPlayer: String(PER_PLAYER_DEFAULTS["Card Fragment"]),
        total: String(tier.totals["Card Fragment"]),
        winnerPerGL: String(Math.floor(tier.totals["Card Fragment"] / PER_PLAYER_DEFAULTS["Card Fragment"])),
      },
    });
  }, []);

  const handleOpenRandomizer = useCallback(() => {
    setShowRandomizerModal(true);
    setSelectedOfficerIGN("");
    setRandomizerGameId("");
    setSelectedGLDay("tuesday");
    setSelectedGLTier("");
    setTimerInput("00:00:05");
    setGuildLeagueResult("");
    setPointDifference("3000");
    setRandomizerResult(null);
    setRandomizedColumns(createEmptyRewardColumns());
    setDisplayedColumns(createEmptyRewardColumns());
    setRewardFields(createDefaultRewardFields());
    fetchMembersData();
  }, [fetchMembersData]);

  const stopShuffleAnimation = useCallback(() => {
    if (shuffleIntervalRef.current) {
      window.clearInterval(shuffleIntervalRef.current);
      shuffleIntervalRef.current = null;
    }

    if (shuffleTimeoutRef.current) {
      window.clearTimeout(shuffleTimeoutRef.current);
      shuffleTimeoutRef.current = null;
    }
  }, []);

  const shuffleNames = useCallback((names) => {
    const next = [...names];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  }, []);

  const runShuffleAnimation = useCallback((finalColumns, durationSeconds) => {
    stopShuffleAnimation();

    const durationMs = Math.max(durationSeconds, 1) * 1000;
    const stepMs = 120;

    setDisplayedColumns({
      LND: shuffleNames(finalColumns.LND || []),
      TNS: shuffleNames(finalColumns.TNS || []),
      "Card Fragment": shuffleNames(finalColumns["Card Fragment"] || []),
    });

    if (durationMs <= stepMs) {
      setDisplayedColumns(finalColumns);
      return;
    }

    shuffleIntervalRef.current = window.setInterval(() => {
      setDisplayedColumns({
        LND: shuffleNames(finalColumns.LND || []),
        TNS: shuffleNames(finalColumns.TNS || []),
          "Card Fragment": shuffleNames(finalColumns["Card Fragment"] || []),
      });
    }, stepMs);

    shuffleTimeoutRef.current = window.setTimeout(() => {
      stopShuffleAnimation();
      setDisplayedColumns(finalColumns);
    }, durationMs);
  }, [shuffleNames, stopShuffleAnimation]);

  const handlePurchaseLimitChange = useCallback((rewardKey, nextValue) => {
    if (!/^\d*$/.test(nextValue)) {
      return;
    }

    setRewardFields((current) => ({
      ...current,
      [rewardKey]: {
        ...(current[rewardKey] || { perPlayer: "1", total: "0", winnerPerGL: "0" }),
        perPlayer: nextValue,
        winnerPerGL: parseNonNegativeInteger(nextValue) > 0
          ? String(Math.floor(parseNonNegativeInteger((current[rewardKey] || {}).total) / parseNonNegativeInteger(nextValue)))
          : "0",
      },
    }));
  }, []);

  const handleOverrunPurchaseLimitChange = useCallback((rewardKey, nextValue) => {
    if (!/^\d*$/.test(nextValue)) {
      return;
    }

    setOverrunRewardFields((current) => ({
      ...current,
      [rewardKey]: {
        ...(current[rewardKey] || { perPlayer: "1" }),
        perPlayer: nextValue,
      },
    }));
  }, []);

  const getWinnerCount = useCallback((rewardKey) => {
    const config = rewardFields[rewardKey] || { winnerPerGL: "0" };
    return parseNonNegativeInteger(config.winnerPerGL);
  }, [rewardFields]);

  const handleCloseRandomizer = useCallback(() => {
    if (isRandomizing) {
      return;
    }
    stopShuffleAnimation();
    setShowRandomizerModal(false);
  }, [isRandomizing, stopShuffleAnimation]);

  const parsedAnimationSeconds = useMemo(() => {
    const parts = timerInput.split(":").map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part) || part < 0)) {
      return 1;
    }

    const [hours, minutes, seconds] = parts;
    const total = (hours * 3600) + (minutes * 60) + seconds;
    return total > 0 ? total : 1;
  }, [timerInput]);

  const parsedPointDifference = useMemo(() => {
    if (guildLeagueResult !== "lost") {
      return 0;
    }

    return parseNonNegativeInteger(pointDifference);
  }, [guildLeagueResult, pointDifference]);

  const shouldShowLeaguePrizeTab = useMemo(
    () => guildLeagueResult === "won" || (guildLeagueResult === "lost" && parsedPointDifference < 1500),
    [guildLeagueResult, parsedPointDifference]
  );

  const leaguePrizeMultiplier = useMemo(() => {
    if (guildLeagueResult === "won") {
      return 1;
    }

    if (guildLeagueResult === "lost") {
      if (parsedPointDifference < 500) {
        return 0.7;
      }

      if (parsedPointDifference < 1500) {
        return 0.5;
      }
    }

    return 0;
  }, [guildLeagueResult, parsedPointDifference]);

  const shouldShowPreviewAnimation = selectedGLDay !== "thursday";

  const getCircularRewardNames = useCallback((rewardKey, count, offset = 0, sourceColumns = displayedColumns) => {
    const names = sourceColumns[rewardKey] || [];
    if (names.length === 0 || count <= 0) {
      return [];
    }

    const result = [];
    for (let index = 0; index < count; index += 1) {
      result.push(names[(offset + index) % names.length]);
    }

    return result;
  }, [displayedColumns]);

  const getCircularFeatherNames = useCallback((count, offset = 0, sourceColumns = displayedColumns) => {
    const names = (sourceColumns.LND && sourceColumns.LND.length > 0)
      ? sourceColumns.LND
      : (sourceColumns.TNS || []);
    if (names.length === 0 || count <= 0) {
      return [];
    }

    const result = [];
    for (let index = 0; index < count; index += 1) {
      result.push(names[(offset + index) % names.length]);
    }

    return result;
  }, [displayedColumns]);

  const guildLeaguePreview = useMemo(() => ({
    LND: getCircularRewardNames("LND", getWinnerCount("LND")),
    TNS: getCircularRewardNames("TNS", getWinnerCount("TNS")),
    "Card Fragment": getCircularRewardNames("Card Fragment", getWinnerCount("Card Fragment")),
  }), [getCircularRewardNames, getWinnerCount]);

  const leaguePrizePreview = useMemo(() => ({
    LND: getCircularRewardNames("LND", Math.ceil(getWinnerCount("LND") * leaguePrizeMultiplier), getWinnerCount("LND")),
    TNS: getCircularRewardNames("TNS", Math.ceil(getWinnerCount("TNS") * leaguePrizeMultiplier), getWinnerCount("TNS")),
    "Card Fragment": getCircularRewardNames("Card Fragment", Math.ceil(getWinnerCount("Card Fragment") * leaguePrizeMultiplier), getWinnerCount("Card Fragment")),
  }), [getCircularRewardNames, getWinnerCount, leaguePrizeMultiplier]);

  const featherGuildLeagueWinnerCount = useMemo(
    () => Math.max(getWinnerCount("LND"), getWinnerCount("TNS")),
    [getWinnerCount]
  );

  const featherLeaguePrizeWinnerCount = useMemo(() => {
    if (!shouldShowLeaguePrizeTab) {
      return 0;
    }
    return Math.max(
      Math.ceil(getWinnerCount("LND") * leaguePrizeMultiplier),
      Math.ceil(getWinnerCount("TNS") * leaguePrizeMultiplier)
    );
  }, [getWinnerCount, leaguePrizeMultiplier, shouldShowLeaguePrizeTab]);

  const featherGuildLeaguePreview = useMemo(
    () => getCircularFeatherNames(featherGuildLeagueWinnerCount, 0),
    [featherGuildLeagueWinnerCount, getCircularFeatherNames]
  );

  const featherLeaguePrizePreview = useMemo(
    () => getCircularFeatherNames(featherLeaguePrizeWinnerCount, featherGuildLeagueWinnerCount),
    [featherGuildLeagueWinnerCount, featherLeaguePrizeWinnerCount, getCircularFeatherNames]
  );

  const displayedWinnerCounts = useMemo(() => {
    const baseLND = getWinnerCount("LND");
    const baseTNS = getWinnerCount("TNS");
    const baseCard = getWinnerCount("Card Fragment");
    const bonusLND = shouldShowLeaguePrizeTab ? Math.ceil(baseLND * leaguePrizeMultiplier) : 0;
    const bonusTNS = shouldShowLeaguePrizeTab ? Math.ceil(baseTNS * leaguePrizeMultiplier) : 0;
    const bonusCard = shouldShowLeaguePrizeTab ? Math.ceil(baseCard * leaguePrizeMultiplier) : 0;

    return {
      LND: baseLND + bonusLND,
      TNS: baseTNS + bonusTNS,
      "Card Fragment": baseCard + bonusCard,
    };
  }, [getWinnerCount, leaguePrizeMultiplier, shouldShowLeaguePrizeTab]);

  const handleRandomize = useCallback(() => {
    if (!selectedOfficerIGN || !randomizerGameId || isRandomizing) {
      return;
    }

    if (!APPS_SCRIPT_URL) {
      setRandomizerResult({ type: "error", message: "APPS_SCRIPT_URL is not set in page.js." });
      return;
    }

    setIsRandomizing(true);
    setRandomizerResult(null);
    stopShuffleAnimation();

    const params = new URLSearchParams({
      action: "randomize",
      triggerIgn: selectedOfficerIGN,
      gameId: randomizerGameId,
      day: selectedGLDay,
      guildLeagueResult,
      pointDifference: guildLeagueResult === "lost" ? String(parsedPointDifference) : "",
      includeLeaguePrizeTab: shouldShowLeaguePrizeTab ? "true" : "false",
      timerSeconds: String(parsedAnimationSeconds),
      winnerPerGLLND:  String(parseNonNegativeInteger((rewardFields["LND"]                        || {}).winnerPerGL)),
      winnerPerGLTNS:  String(parseNonNegativeInteger((rewardFields["TNS"]                        || {}).winnerPerGL)),
      winnerPerGLCard: String(parseNonNegativeInteger((rewardFields["Card Fragment"] || {}).winnerPerGL)),
      perPlayerLND:    String(PER_PLAYER_DEFAULTS.LND),
      perPlayerTNS:    String(PER_PLAYER_DEFAULTS.TNS),
      perPlayerCard:   String(PER_PLAYER_DEFAULTS["Card Fragment"]),
      guildLeagueWinner: shouldShowLeaguePrizeTab ? "true" : "false",
    });

    fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, { redirect: "follow" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setIsRandomizing(false);

        if (!data.success) {
          setRandomizerResult({ type: "error", message: data.error || "Randomizer failed." });
          return;
        }

        const finalColumns = {
          LND: data.randomized?.LND || [],
          TNS: data.randomized?.TNS || [],
          "Card Fragment": data.randomized?.["Card Fragment"] || [],
        };

        setRandomizedColumns(finalColumns);
        if (selectedGLDay === "tuesday") {
          runShuffleAnimation(finalColumns, parsedAnimationSeconds);
        } else {
          setDisplayedColumns(finalColumns);
        }

        setRandomizerResult({
          type: "success",
          message: `Randomized by ${selectedOfficerIGN}. Trigger log saved successfully.`,
        });
        loadSheet();
      })
      .catch((error) => {
        setIsRandomizing(false);
        setRandomizerResult({ type: "error", message: `Request failed: ${error.message}` });
      });
  }, [
    guildLeagueResult,
    loadSheet,
    parsedAnimationSeconds,
    parsedPointDifference,
    pointDifference,
    randomizerGameId,
    rewardFields,
    runShuffleAnimation,
    selectedGLDay,
    selectedOfficerIGN,
    isRandomizing,
    shouldShowLeaguePrizeTab,
    stopShuffleAnimation,
  ]);

  const handleOpenClearModal = useCallback(() => {
    setShowClearModal(true);
    setClearOfficerIGN("");
    setClearGameId("");
    setClearResult(null);
    fetchMembersData();
  }, [fetchMembersData]);

  const handleOpenClaimModal = useCallback((auctionDate) => {
    setShowClaimModal(true);
    setClaimOfficerIGN("");
    setClaimGameId("");
    setClaimAuctionDate(auctionDate);
    setClaimResult(null);
    fetchMembersData();
  }, [fetchMembersData]);

  const handleOpenOverrunModal = useCallback(() => {
    setShowOverrunModal(true);
    setOverrunOfficerIGN("");
    setOverrunGameId("");
    setSelectedOverrunGroup("");
    setSelectedOverrunRank("");
    setOverrunRewardFields(createDefaultOverrunRewardFields());
    setOfficerCardBenefitEnabled(false);
    setSelectedOfficerCardRecipients([]);
    setOverrunResult(null);
    fetchMembersData();
  }, [fetchMembersData]);

  const handleCloseOverrunModal = useCallback(() => {
    if (isGeneratingOverrun) {
      return;
    }
    setShowOverrunModal(false);
  }, [isGeneratingOverrun]);

  const handleCloseClearModal = useCallback(() => {
    if (isClearing) {
      return;
    }
    setShowClearModal(false);
  }, [isClearing]);

  const handleCloseClaimModal = useCallback(() => {
    if (isClaiming) {
      return;
    }
    setShowClaimModal(false);
  }, [isClaiming]);

  const handleClearAuctionData = useCallback(() => {
    if (!clearOfficerIGN || !clearGameId || isClearing) {
      return;
    }

    if (!APPS_SCRIPT_URL) {
      setClearResult({ type: "error", message: "APPS_SCRIPT_URL is not set in page.js." });
      return;
    }

    setIsClearing(true);
    setClearResult(null);

    const params = new URLSearchParams({
      action: "clearAuctionData",
      triggerIgn: clearOfficerIGN,
      gameId: clearGameId,
    });

    fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, { redirect: "follow" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setIsClearing(false);
        if (!data.success) {
          setClearResult({ type: "error", message: data.error || "Clear failed." });
          return;
        }

        setClearResult({ type: "success", message: "ROOC Auction Data and ROOC Auction Roulette cleared." });
        loadSheet();
        window.setTimeout(() => {
          setShowClearModal(false);
        }, 900);
      })
      .catch((error) => {
        setIsClearing(false);
        setClearResult({ type: "error", message: `Request failed: ${error.message}` });
      });
  }, [clearGameId, clearOfficerIGN, isClearing, loadSheet]);

  const handleClaimDate = useCallback(() => {
    if (!claimAuctionDate || !claimOfficerIGN || !claimGameId || isClaiming) {
      return;
    }

    if (!APPS_SCRIPT_URL) {
      setClaimResult({ type: "error", message: "APPS_SCRIPT_URL is not set in page.js." });
      return;
    }

    setIsClaiming(true);
    setClaimResult(null);
    const params = new URLSearchParams({
      action: "claimAuctionDate",
      triggerIgn: claimOfficerIGN,
      gameId: claimGameId,
      auctionDate: claimAuctionDate,
    });

    fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, { redirect: "follow" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setIsClaiming(false);
        if (!data.success) {
          setClaimResult({ type: "error", message: data.error || "Claim failed." });
          return;
        }

        setClaimResult({ type: "success", message: `Auction date ${claimAuctionDate} marked as claimed.` });
        loadSheet();
        window.setTimeout(() => {
          setShowClaimModal(false);
        }, 900);
      })
      .catch((error) => {
        setIsClaiming(false);
        setClaimResult({ type: "error", message: `Request failed: ${error.message}` });
      });
  }, [claimAuctionDate, claimGameId, claimOfficerIGN, isClaiming, loadSheet]);

  const triggerCopyToast = useCallback(() => {
    if (copyToastTimeoutRef.current) {
      window.clearTimeout(copyToastTimeoutRef.current);
    }
    setIsCopyToastVisible(true);
    copyToastTimeoutRef.current = window.setTimeout(() => {
      setIsCopyToastVisible(false);
      copyToastTimeoutRef.current = null;
    }, 1300);
  }, []);

  const handleCopyRewardData = useCallback(async (dayTabs, date) => {
    const buildSectionLines = (title, entries) => {
      const output = [title];
      if (!entries || entries.length === 0) {
        output.push("-");
        return output;
      }

      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i] || {};
        output.push(`@${entry.ign || "-"} = ${entry.pages || "-"}`);
      }
      return output;
    };

    const buildTabLines = (tabTitle, tabData) => {
      const cardEntries = tabData?.["Card Fragment"] || [];
      const lndEntries = tabData?.LND || [];
      const tnsEntries = tabData?.TNS || [];

      return [
        tabTitle,
        ...buildSectionLines("FOR CARDS", cardEntries),
        "",
        ...buildSectionLines("FOR LND", lndEntries),
        "",
        ...buildSectionLines("FOR TNS", tnsEntries),
      ];
    };

    let sections;
    if (isSundayFromDateString(date)) {
      const overrunData = dayTabs?.["Emperium Overrun"] || createEmptyRewardColumns();
      sections = [...buildTabLines("Emperium Overrun Tab", overrunData)];
    } else {
      const guildLeagueData = dayTabs?.["Guild League"] || createEmptyRewardColumns();
      const leaguePrizeData = dayTabs?.["League Prize"] || createEmptyRewardColumns();
      sections = [
        ...buildTabLines("Guild League Tab", guildLeagueData),
        "",
        ...buildTabLines("League Prize Tab", leaguePrizeData),
      ];
    }
    const text = sections.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      triggerCopyToast();
    } catch {
      // Fallback for browsers where async clipboard is unavailable.
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        triggerCopyToast();
      } catch {
        // Ignore clipboard failures silently.
      }
    }
  }, [triggerCopyToast]);

  const auctionRowsByDate = useMemo(() => {
    const byDate = new Map();
    for (let i = 0; i < auctionDataRows.length; i += 1) {
      const row = auctionDataRows[i] || [];
      const ign = String(row[0] || "").trim();
      const reward = String(row[1] || "").trim();
      const hasTabShape = String(row[5] || "").trim().length > 0;
      const tab = hasTabShape ? String(row[2] || "").trim() : "Guild League";
      const status = String((hasTabShape ? row[3] : row[2]) || "").trim();
      const pages = String((hasTabShape ? row[4] : row[3]) || "").trim();
      const date = String((hasTabShape ? row[5] : row[4]) || "").trim();
      if (!ign || !reward || !date) {
        continue;
      }
      if (!byDate.has(date)) {
        byDate.set(date, createEmptyAuctionTabs());
      }
      const rewardKeys = expandAuctionDataRewardKeys(reward);
      if (rewardKeys.length === 0) {
        continue;
      }

      const tabKey = normalizeAuctionTab(tab);
      const tabRows = byDate.get(date)?.[tabKey] || createEmptyRewardColumns();

      const pagesByReward = splitAuctionDataPages(reward, pages);
      for (const rewardKey of rewardKeys) {
        tabRows[rewardKey].push({
          ign,
          status,
          pages: pagesByReward[rewardKey] || pages,
        });
      }
    }
    return byDate;
  }, [auctionDataRows]);

  const orderedAuctionDates = useMemo(() => {
    const dates = Array.from(auctionRowsByDate.keys());
    dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return dates;
  }, [auctionRowsByDate]);
  const hasTuesdayAuctionDate = useMemo(
    () => orderedAuctionDates.some((date) => isTuesdayFromDateString(date)),
    [orderedAuctionDates]
  );
  const hasThursdayAuctionDate = useMemo(
    () => orderedAuctionDates.some((date) => isThursdayFromDateString(date)),
    [orderedAuctionDates]
  );
  const hasAuctionDataRecords = auctionDataRows.length > 0;
  const hasAuctionData = orderedAuctionDates.length > 0;

  const pendingRouletteByReward = useMemo(() => {
    const featherColumnIndex = findColumnIndexByNames(columns, ["Feather"]);
    const rewardColumnIndexes = {
      LND: featherColumnIndex >= 0 ? featherColumnIndex : findColumnIndexByNames(columns, ["LND", "Light and Dark"]),
      TNS: featherColumnIndex >= 0 ? featherColumnIndex : findColumnIndexByNames(columns, ["TNS", "Time and Space"]),
      "Card Fragment": findColumnIndexByNames(columns, ["Card Fragment", "Card Frag(Prio from Elite)", "Card Frag"]),
    };

    const rouletteByReward = createEmptyRewardColumns();
    const seenRouletteNames = {
      LND: new Set(),
      TNS: new Set(),
      "Card Fragment": new Set(),
    };

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || [];
      for (const rewardKey of ["LND", "TNS", "Card Fragment"]) {
        const columnIndex = rewardColumnIndexes[rewardKey];
        if (columnIndex < 0) {
          continue;
        }

        const ign = String(row[columnIndex] || "").trim();
        const ignKey = ign.toLowerCase();
        if (!ign || seenRouletteNames[rewardKey].has(ignKey)) {
          continue;
        }

        seenRouletteNames[rewardKey].add(ignKey);
        rouletteByReward[rewardKey].push(ign);
      }
    }

    const existingAuctionEntries = new Set();
    for (let i = 0; i < auctionDataRows.length; i += 1) {
      const row = auctionDataRows[i] || [];
      const ign = String(row[0] || "").trim();
      const rewardKeys = expandAuctionDataRewardKeys(row[1]);
      if (!ign || rewardKeys.length === 0) {
        continue;
      }
      for (const rewardKey of rewardKeys) {
        existingAuctionEntries.add(`${rewardKey}::${ign.toLowerCase()}`);
      }
    }

    const pending = createEmptyRewardColumns();
    for (const rewardKey of ["LND", "TNS", "Card Fragment"]) {
      pending[rewardKey] = rouletteByReward[rewardKey].filter(
        (ign) => !existingAuctionEntries.has(`${rewardKey}::${ign.toLowerCase()}`)
      );
    }

    return pending;
  }, [auctionDataRows, columns, rows]);

  const pendingFeatherPlayers = useMemo(() => {
    const seen = new Set();
    const combined = [];
    for (const ign of [...pendingRouletteByReward.LND, ...pendingRouletteByReward.TNS]) {
      const key = ign.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(ign);
      }
    }
    return combined;
  }, [pendingRouletteByReward]);

  const pendingRouletteTotal = useMemo(
    () => pendingFeatherPlayers.length + pendingRouletteByReward["Card Fragment"].length,
    [pendingFeatherPlayers, pendingRouletteByReward]
  );

  const overrunRankOptions = useMemo(() => {
    if (selectedOverrunGroup === "advanced") {
      return ADVANCED_OVERRUN_RANK_OPTIONS;
    }

    if (selectedOverrunGroup === "beginner") {
      return BEGINNER_OVERRUN_RANK_OPTIONS;
    }

    return [];
  }, [selectedOverrunGroup]);

  const selectedOverrunRewards = useMemo(() => {
    const groupRewards = OVERRUN_GROUP_RANK_REWARDS[selectedOverrunGroup] || null;
    if (!groupRewards) {
      return null;
    }

    return groupRewards[selectedOverrunRank] || null;
  }, [selectedOverrunGroup, selectedOverrunRank]);

  const overrunFeatherPlayerCount = useMemo(() => {
    const totalLnd = parseNonNegativeInteger((selectedOverrunRewards || {}).LND);
    const totalTns = parseNonNegativeInteger((selectedOverrunRewards || {}).TNS);
    const perPlayerLnd = Math.max(1, parseNonNegativeInteger((overrunRewardFields.LND || {}).perPlayer));
    const perPlayerTns = Math.max(1, parseNonNegativeInteger((overrunRewardFields.TNS || {}).perPlayer));

    if (totalLnd <= 0 || totalTns <= 0) {
      return 0;
    }

    return Math.min(
      Math.floor(totalLnd / perPlayerLnd),
      Math.floor(totalTns / perPlayerTns)
    );
  }, [overrunRewardFields, selectedOverrunRewards]);

  const overrunCardPlayerCount = useMemo(() => {
    const totalCard = parseNonNegativeInteger((selectedOverrunRewards || {})["Card Fragment"]);
    const perPlayerCard = Math.max(1, parseNonNegativeInteger((overrunRewardFields["Card Fragment"] || {}).perPlayer));
    if (totalCard <= 0) {
      return 0;
    }

    return Math.floor(totalCard / perPlayerCard);
  }, [overrunRewardFields, selectedOverrunRewards]);

  useEffect(() => {
    if (!selectedOverrunRewards) {
      return;
    }

    const totalLnd = parseNonNegativeInteger(selectedOverrunRewards.LND);
    const totalTns = parseNonNegativeInteger(selectedOverrunRewards.TNS);
    const bestPlayerCount = getBestOverrunFeatherPlayerCount(totalLnd, totalTns);
    if (bestPlayerCount <= 0) {
      return;
    }

    setOverrunRewardFields((current) => ({
      ...current,
      LND: {
        ...(current.LND || { perPlayer: "1" }),
        perPlayer: String(Math.max(1, Math.floor(totalLnd / bestPlayerCount))),
      },
      TNS: {
        ...(current.TNS || { perPlayer: "1" }),
        perPlayer: String(Math.max(1, Math.floor(totalTns / bestPlayerCount))),
      },
    }));
  }, [selectedOverrunRewards]);

  const overrunSucceedingCardRaw = useMemo(() => {
    const selectedCardAmount = Number((selectedOverrunRewards || {})["Card Fragment"] || 0);
    const perPlayerCard = Math.max(1, parseNonNegativeInteger((overrunRewardFields["Card Fragment"] || {}).perPlayer));
    const pendingCardPlayers = pendingRouletteByReward["Card Fragment"].length;
    return Math.max(Math.floor(selectedCardAmount / perPlayerCard) - pendingCardPlayers, 0);
  }, [overrunRewardFields, pendingRouletteByReward, selectedOverrunRewards]);

  const overrunSucceedingCardRemaining = useMemo(
    () => overrunSucceedingCardRaw,
    [overrunSucceedingCardRaw]
  );

  useEffect(() => {
    setSelectedOfficerCardRecipients((current) => current.slice(0, overrunSucceedingCardRemaining));
  }, [overrunSucceedingCardRemaining]);

  const selectedOfficerCardCount = useMemo(
    () => selectedOfficerCardRecipients.length,
    [selectedOfficerCardRecipients]
  );

  const toggleOfficerCardRecipient = useCallback((officerIgn) => {
    setSelectedOfficerCardRecipients((current) => {
      if (current.includes(officerIgn)) {
        return current.filter((name) => name !== officerIgn);
      }

      if (current.length >= overrunSucceedingCardRemaining) {
        return current;
      }

      return [...current, officerIgn];
    });
  }, [overrunSucceedingCardRemaining]);

  const handleGenerateOverrunRewards = useCallback(() => {
    if (!overrunOfficerIGN || !overrunGameId || !selectedOverrunGroup || !selectedOverrunRank || isGeneratingOverrun) {
      return;
    }

    if (!APPS_SCRIPT_URL) {
      setOverrunResult({ type: "error", message: "APPS_SCRIPT_URL is not set in page.js." });
      return;
    }

    setIsGeneratingOverrun(true);
    setOverrunResult(null);

    const params = new URLSearchParams({
      action: "generateOverrunRewards",
      triggerIgn: overrunOfficerIGN,
      gameId: overrunGameId,
      groupRanking: selectedOverrunGroup,
      guildRanking: selectedOverrunRank,
      perPlayerLND: String(parseNonNegativeInteger((overrunRewardFields.LND || {}).perPlayer)),
      perPlayerTNS: String(parseNonNegativeInteger((overrunRewardFields.TNS || {}).perPlayer)),
      perPlayerCard: String(parseNonNegativeInteger((overrunRewardFields["Card Fragment"] || {}).perPlayer)),
      officerCardBenefit: officerCardBenefitEnabled ? "true" : "false",
      officerCardQuantity: String(officerCardBenefitEnabled ? selectedOfficerCardCount : 0),
      officerCardRecipients: officerCardBenefitEnabled ? JSON.stringify(selectedOfficerCardRecipients) : "[]",
    });

    fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, { redirect: "follow" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setIsGeneratingOverrun(false);
        if (!data.success) {
          setOverrunResult({ type: "error", message: data.error || "Generate Overrun Rewards failed." });
          return;
        }

        const rowsInserted = Number(data.rowsInserted || 0);
        const cycledRows = Number(data.cycledRowsUpdated || 0);
        const officerCardRecipients = Array.isArray(data.officerCardRecipients) ? data.officerCardRecipients : [];
        const officerCardGranted = Number(data.officerCardGranted || 0);
        const officerCardSummary = officerCardGranted > 0 && officerCardRecipients.length > 0
          ? ` Officer Card recipients: ${officerCardRecipients.join(", ")}.`
          : "";
        setOverrunResult({
          type: "success",
          message: `Overrun rewards generated. Added ${rowsInserted} row(s)${cycledRows > 0 ? ` and updated ${cycledRows} cycled row(s)` : ""}.${officerCardSummary}`,
        });
        loadSheet();
      })
      .catch((error) => {
        setIsGeneratingOverrun(false);
        setOverrunResult({ type: "error", message: `Request failed: ${error.message}` });
      });
  }, [
    isGeneratingOverrun,
    loadSheet,
    officerCardBenefitEnabled,
    overrunGameId,
    overrunOfficerIGN,
    overrunRewardFields,
    selectedOfficerCardCount,
    selectedOfficerCardRecipients,
    selectedOverrunGroup,
    selectedOverrunRank,
  ]);

  useEffect(() => {
    return () => {
      stopShuffleAnimation();
      if (copyToastTimeoutRef.current) {
        window.clearTimeout(copyToastTimeoutRef.current);
      }
    };
  }, [stopShuffleAnimation]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  useEffect(() => {
    if (showRandomizerModal && hasTuesdayAuctionDate && selectedGLDay === "tuesday") {
      setSelectedGLDay("thursday");
    }
  }, [hasTuesdayAuctionDate, selectedGLDay, showRandomizerModal]);

  return (
    <main className="shell">
      {isCopyToastVisible && (
        <div className="copy-toast" role="status" aria-live="polite">
          Copy Records.
        </div>
      )}
      {showInsertModal && (
        <div className="modal-overlay" onClick={handleCloseInsert}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Insert IGN</h2>
              <button type="button" className="modal-close" onClick={handleCloseInsert} aria-label="Close" disabled={isSubmitting}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">IGN</label>
                {isFetchingMembers ? (
                  <div className="modal-loading">Loading members…</div>
                ) : (
                  <SelectField
                    options={memberOptions}
                    value={selectedIGN}
                    onChange={setSelectedIGN}
                    placeholder="Select IGN…"
                    searchPlaceholder="Search IGN…"
                    toLabel={(option) => option.ign}
                    toValue={(option) => option.ign}
                    toBadge={(option) => option.badge || "-"}
                  />
                )}
              </div>

              <div className="modal-field">
                <label className="modal-label">Reward</label>
                <SelectField
                  options={INSERT_REWARD_OPTIONS}
                  value={selectedReward}
                  onChange={setSelectedReward}
                  placeholder="Select reward…"
                  searchPlaceholder="Search reward…"
                  toLabel={(option) => option.label}
                  toValue={(option) => option.value}
                  toBadge={(option) => option.badge || option.value}
                />
              </div>

              <div className="modal-field">
                <label className="modal-label" htmlFor="insertGameId">Game ID (required)</label>
                <input
                  id="insertGameId"
                  className="modal-input"
                  type="password"
                  value={insertGameId}
                  onChange={(event) => setInsertGameId(event.target.value)}
                  placeholder="Enter your Game ID"
                />
              </div>

              {submitResult && (
                <div className={`modal-result modal-result--${submitResult.type}`}>
                  {submitResult.message}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={handleCloseInsert} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitIGN}
                disabled={!selectedIGN || !selectedReward || !insertGameId || isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangeModal && (
        <div className="modal-overlay" onClick={handleCloseChange}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Change IGN/Job</h2>
              <button type="button" className="modal-close" onClick={handleCloseChange} aria-label="Close" disabled={isChanging}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">IGN</label>
                {isFetchingMembers ? (
                  <div className="modal-loading">Loading members…</div>
                ) : (
                  <SelectField
                    options={memberOptions}
                    value={selectedChangeIGN}
                    onChange={setSelectedChangeIGN}
                    placeholder="Select IGN…"
                    searchPlaceholder="Search IGN…"
                    toLabel={(option) => option.ign}
                    toValue={(option) => option.ign}
                    toBadge={(option) => option.badge || "-"}
                  />
                )}
              </div>

              <div className="modal-field">
                <label className="modal-label">Change</label>
                <SelectField
                  options={CHANGE_FIELD_OPTIONS}
                  value={selectedChangeField}
                  onChange={(nextValue) => {
                    setSelectedChangeField(nextValue);
                    setNewChangeIGN("");
                    setNewChangeClass("");
                  }}
                  placeholder="Select to update.."
                  searchPlaceholder="Search field…"
                  toLabel={(option) => option.label}
                  toValue={(option) => option.value}
                  toBadge={(option) => option.value.toUpperCase()}
                />
              </div>

              {selectedChangeField === "ign" && (
                <div className="modal-field">
                  <label className="modal-label" htmlFor="newChangeIgn">New IGN</label>
                  <input
                    id="newChangeIgn"
                    className="modal-input"
                    type="text"
                    value={newChangeIGN}
                    onChange={(event) => setNewChangeIGN(event.target.value)}
                    placeholder="Enter New IGN"
                  />
                </div>
              )}

              {selectedChangeField === "job" && (
                <div className="modal-field">
                  <label className="modal-label">New Class</label>
                  <SelectField
                    options={CHANGE_CLASS_OPTIONS}
                    value={newChangeClass}
                    onChange={setNewChangeClass}
                    placeholder="Select class…"
                    searchPlaceholder="Search class…"
                    toLabel={(option) => option.label}
                    toValue={(option) => option.value}
                    toBadge={() => "Class"}
                  />
                </div>
              )}

              <div className="modal-field">
                <label className="modal-label" htmlFor="changeGameId">Game ID (required)</label>
                <input
                  id="changeGameId"
                  className="modal-input"
                  type="password"
                  value={changeGameId}
                  onChange={(event) => setChangeGameId(event.target.value)}
                  placeholder="Enter your Game ID"
                />
              </div>

              {changeResult && (
                <div className={`modal-result modal-result--${changeResult.type}`}>
                  {changeResult.message}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={handleCloseChange} disabled={isChanging}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitChange}
                disabled={
                  !selectedChangeIGN
                  || !selectedChangeField
                  || !changeGameId
                  || (selectedChangeField === "ign" && !newChangeIGN.trim())
                  || (selectedChangeField === "job" && !newChangeClass)
                  || isChanging
                }
              >
                {isChanging ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRandomizerModal && (
        <div className="modal-overlay" onClick={handleCloseRandomizer}>
          <div className="modal-card modal-card--randomizer" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Generate Guild League Rewards</h2>
              <button type="button" className="modal-close" onClick={handleCloseRandomizer} aria-label="Close" disabled={isRandomizing}>✕</button>
            </div>

            <div className="modal-body">
              <p className="modal-note">Only officers, guild leader, and vice guild leader can trigger randomization.</p>

              <div className="randomizer-top-row">
                <div className="modal-field">
                  <label className="modal-label">Officer</label>
                  {isFetchingMembers ? (
                    <div className="modal-loading">Loading officers…</div>
                  ) : (
                    <SelectField
                      options={officerOptions}
                      value={selectedOfficerIGN}
                      onChange={setSelectedOfficerIGN}
                      placeholder={officerOptions.length > 0 ? "Officer" : "No officer roles found"}
                      searchPlaceholder="Search officer IGN…"
                      toLabel={(option) => option}
                      toValue={(option) => option}
                      disabled={officerOptions.length === 0}
                    />
                  )}
                </div>

                <div className="modal-field">
                  <label className="modal-label" htmlFor="randomizerGameId">Game ID (password)</label>
                  <input
                    id="randomizerGameId"
                    className="modal-input"
                    type="password"
                    value={randomizerGameId}
                    onChange={(event) => setRandomizerGameId(event.target.value)}
                    placeholder="Game ID"
                  />
                </div>

                <div className="modal-field">
                  <label className="modal-label" htmlFor="glDaySelect">Day</label>
                  <select
                    id="glDaySelect"
                    className="modal-input modal-select"
                    value={selectedGLDay}
                    onChange={(event) => setSelectedGLDay(event.target.value)}
                  >
                    <option value="thursday">Thursday</option>
                    <option value="tuesday" disabled={hasTuesdayAuctionDate}>Tuesday</option>
                  </select>
                </div>

                <div className="modal-field">
                  <label className="modal-label" htmlFor="timerInput">(hour:minute:second)</label>
                  <input
                    id="timerInput"
                    className="modal-input"
                    type="text"
                    value={timerInput}
                    onChange={(event) => setTimerInput(event.target.value)}
                    placeholder="00:00:05"
                  />
                </div>
              </div>

              <div className="randomizer-top-row randomizer-top-row--three">
                <div className="modal-field">
                  <label className="modal-label" htmlFor="glTierSelect">Guild Tier</label>
                  <select
                    id="glTierSelect"
                    className="modal-input modal-select"
                    value={selectedGLTier}
                    onChange={(event) => handleGLTierChange(event.target.value)}
                  >
                    <option value="">Select tier…</option>
                    {GL_TIER_OPTIONS.map((tier) => (
                      <option key={tier.value} value={tier.value}>{tier.label}</option>
                    ))}
                  </select>
                </div>

                <div className="modal-field">
                  <label className="modal-label" htmlFor="guildLeagueResult">Guild League Result</label>
                  <select
                    id="guildLeagueResult"
                    className="modal-input modal-select"
                    value={guildLeagueResult}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setGuildLeagueResult(nextValue);
                      if (nextValue !== "lost") {
                        setPointDifference("3000");
                      }
                    }}
                  >
                    <option value="">Select result…</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>

                <div className="modal-field">
                  <label className="modal-label" htmlFor="pointDifference">Point Difference</label>
                  <input
                    id="pointDifference"
                    className="modal-input"
                    inputMode="numeric"
                    type="text"
                    value={pointDifference}
                    onChange={(event) => {
                      if (/^\d*$/.test(event.target.value)) {
                        setPointDifference(event.target.value);
                      }
                    }}
                    placeholder="0"
                    disabled={guildLeagueResult !== "lost"}
                  />
                </div>
              </div>

              <div className="reward-fields-grid">
                <div className="reward-fields-card" key="config-feather">
                  <h3>Feather</h3>
                  <div className="reward-fields-stat">
                    <span className="reward-fields-stat-label">Purchase Limit (LND)</span>
                    <input
                      className="modal-input reward-winner-input"
                      inputMode="numeric"
                      type="text"
                      value={parseNonNegativeInteger((rewardFields.LND || {}).perPlayer)}
                      onChange={(event) => handlePurchaseLimitChange("LND", event.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="reward-fields-stat">
                    <span className="reward-fields-stat-label">Purchase Limit (TNS)</span>
                    <input
                      className="modal-input reward-winner-input"
                      inputMode="numeric"
                      type="text"
                      value={parseNonNegativeInteger((rewardFields.TNS || {}).perPlayer)}
                      onChange={(event) => handlePurchaseLimitChange("TNS", event.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <p className="reward-fields-meta">
                    Total players to be reward: {displayedWinnerCounts.LND}
                  </p>
                </div>

                <div className="reward-fields-card" key="config-card-fragment">
                  <h3>Card Fragment</h3>
                  <div className="reward-fields-stat">
                    <span className="reward-fields-stat-label">Purchase Limit</span>
                    <input
                      className="modal-input reward-winner-input"
                      inputMode="numeric"
                      type="text"
                      value={parseNonNegativeInteger((rewardFields["Card Fragment"] || {}).perPlayer)}
                      onChange={(event) => handlePurchaseLimitChange("Card Fragment", event.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <p className="reward-fields-meta">
                    Total players to be reward: {displayedWinnerCounts["Card Fragment"]}
                  </p>
                </div>
              </div>

              {shouldShowPreviewAnimation && (
                <>
                  <h3 className="modal-section-title">Guild League Tab</h3>
                  <div className="reward-fields-grid">
                    <div className="reward-fields-card">
                      <h3>Feather</h3>
                      <ol className="reward-preview-list">
                        {featherGuildLeaguePreview.length === 0 ? <li>-</li> : featherGuildLeaguePreview.map((name, index) => <li key={`gl-feather-${name}-${index}`}>{name}</li>)}
                      </ol>
                    </div>
                    <div className="reward-fields-card">
                      <h3>Card Fragment</h3>
                      <ol className="reward-preview-list">
                        {guildLeaguePreview["Card Fragment"].length === 0 ? <li>-</li> : guildLeaguePreview["Card Fragment"].map((name, index) => <li key={`gl-card-${name}-${index}`}>{name}</li>)}
                      </ol>
                    </div>
                  </div>

                  {shouldShowLeaguePrizeTab && (
                    <>
                      <h3 className="modal-section-title">League Prize Tab</h3>
                      <div className="reward-fields-grid">
                        <div className="reward-fields-card">
                          <h3>Feather</h3>
                          <ol className="reward-preview-list">
                            {featherLeaguePrizePreview.length === 0 ? <li>-</li> : featherLeaguePrizePreview.map((name, index) => <li key={`lp-feather-${name}-${index}`}>{name}</li>)}
                          </ol>
                        </div>
                        <div className="reward-fields-card">
                          <h3>Card Fragment</h3>
                          <ol className="reward-preview-list">
                            {leaguePrizePreview["Card Fragment"].length === 0 ? <li>-</li> : leaguePrizePreview["Card Fragment"].map((name, index) => <li key={`lp-card-${name}-${index}`}>{name}</li>)}
                          </ol>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

            </div>

            <div className="modal-footer modal-footer--between">
              {randomizerResult ? (
                <div className={`modal-result modal-result--${randomizerResult.type}`}>
                  {randomizerResult.message}
                </div>
              ) : (
                <div />
              )}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseRandomizer} disabled={isRandomizing}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-randomize"
                  onClick={handleRandomize}
                  disabled={!selectedOfficerIGN || !randomizerGameId || !selectedGLTier || isRandomizing}
                >
                  {isRandomizing ? "Generating..." : "Generate Guild League Rewards"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showClearModal && (
        <div className="modal-overlay" onClick={handleCloseClearModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Clear Auction Data</h2>
              <button type="button" className="modal-close" onClick={handleCloseClearModal} aria-label="Close" disabled={isClearing}>✕</button>
            </div>

            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">Officer</label>
                {isFetchingMembers ? (
                  <div className="modal-loading">Loading officers…</div>
                ) : (
                  <SelectField
                    options={officerOptions}
                    value={clearOfficerIGN}
                    onChange={setClearOfficerIGN}
                    placeholder={officerOptions.length > 0 ? "Officer" : "No officer roles found"}
                    searchPlaceholder="Search officer IGN…"
                    toLabel={(option) => option}
                    toValue={(option) => option}
                    disabled={officerOptions.length === 0}
                  />
                )}
              </div>

              <div className="modal-field">
                <label className="modal-label" htmlFor="clearGameId">Game ID (password)</label>
                <input
                  id="clearGameId"
                  className="modal-input"
                  type="password"
                  value={clearGameId}
                  onChange={(event) => setClearGameId(event.target.value)}
                  placeholder="Game ID"
                />
              </div>

              {clearResult && (
                <div className={`modal-result modal-result--${clearResult.type}`}>
                  {clearResult.message}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={handleCloseClearModal} disabled={isClearing}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-clear"
                onClick={handleClearAuctionData}
                disabled={!clearOfficerIGN || !clearGameId || isClearing}
              >
                {isClearing ? "Clearing..." : "Clear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showClaimModal && (
        <div className="modal-overlay" onClick={handleCloseClaimModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Claim Auction Date</h2>
              <button type="button" className="modal-close" onClick={handleCloseClaimModal} aria-label="Close" disabled={isClaiming}>✕</button>
            </div>

            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">Officer</label>
                {isFetchingMembers ? (
                  <div className="modal-loading">Loading officers…</div>
                ) : (
                  <SelectField
                    options={officerOptions}
                    value={claimOfficerIGN}
                    onChange={setClaimOfficerIGN}
                    placeholder={officerOptions.length > 0 ? "Officer" : "No officer roles found"}
                    searchPlaceholder="Search officer IGN…"
                    toLabel={(option) => option}
                    toValue={(option) => option}
                    disabled={officerOptions.length === 0}
                  />
                )}
              </div>

              <div className="modal-field">
                <label className="modal-label" htmlFor="claimAuctionDate">Auction Date</label>
                <input
                  id="claimAuctionDate"
                  className="modal-input"
                  type="text"
                  value={claimAuctionDate}
                  readOnly
                />
              </div>

              <div className="modal-field">
                <label className="modal-label" htmlFor="claimGameId">Game ID (password)</label>
                <input
                  id="claimGameId"
                  className="modal-input"
                  type="password"
                  value={claimGameId}
                  onChange={(event) => setClaimGameId(event.target.value)}
                  placeholder="Game ID"
                />
              </div>

              {claimResult && (
                <div className={`modal-result modal-result--${claimResult.type}`}>
                  {claimResult.message}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={handleCloseClaimModal} disabled={isClaiming}>
                Cancel
              </button>
              <button
                type="button"
                className="table-title-btn table-title-btn--claim"
                onClick={handleClaimDate}
                disabled={!claimOfficerIGN || !claimGameId || !claimAuctionDate || isClaiming}
              >
                {isClaiming ? "Claiming..." : "Claimed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOverrunModal && (
        <div className="modal-overlay" onClick={handleCloseOverrunModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Generate Overrun Rewards</h2>
              <button type="button" className="modal-close" onClick={handleCloseOverrunModal} aria-label="Close" disabled={isGeneratingOverrun}>✕</button>
            </div>

            <div className="modal-body">
              <div className="randomizer-top-row randomizer-top-row--two">
                <div className="modal-field">
                  <label className="modal-label">Officer</label>
                  {isFetchingMembers ? (
                    <div className="modal-loading">Loading officers…</div>
                  ) : (
                    <SelectField
                      options={officerOptions}
                      value={overrunOfficerIGN}
                      onChange={setOverrunOfficerIGN}
                      placeholder={officerOptions.length > 0 ? "Officer" : "No officer roles found"}
                      searchPlaceholder="Search officer IGN…"
                      toLabel={(option) => option}
                      toValue={(option) => option}
                      disabled={officerOptions.length === 0}
                    />
                  )}
                </div>

                <div className="modal-field">
                  <label className="modal-label" htmlFor="overrunGameId">Game ID (password)</label>
                  <input
                    id="overrunGameId"
                    className="modal-input"
                    type="password"
                    value={overrunGameId}
                    onChange={(event) => setOverrunGameId(event.target.value)}
                    placeholder="Game ID"
                  />
                </div>
              </div>

              <div className="overrun-rank-row">
                <div className="modal-field">
                  <label className="modal-label" htmlFor="overrunGroupSelect">Group Ranking</label>
                  <select
                    id="overrunGroupSelect"
                    className="modal-input modal-select"
                    value={selectedOverrunGroup}
                    onChange={(event) => {
                      setSelectedOverrunGroup(event.target.value);
                      setSelectedOverrunRank("");
                    }}
                  >
                    <option value="">Select group…</option>
                    {OVERRUN_GROUP_OPTIONS.map((group) => (
                      <option key={group.value} value={group.value}>{group.label}</option>
                    ))}
                  </select>
                </div>

                <div className="modal-field">
                  <label className="modal-label" htmlFor="overrunRankSelect">Guild Ranking</label>
                  <select
                    id="overrunRankSelect"
                    className="modal-input modal-select"
                    value={selectedOverrunRank}
                    onChange={(event) => setSelectedOverrunRank(event.target.value)}
                    disabled={!selectedOverrunGroup}
                  >
                    <option value="">Select rank…</option>
                    {overrunRankOptions.map((rank) => (
                      <option key={rank.value} value={rank.value}>{rank.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="reward-fields-grid">
                <div className="reward-fields-card" key="overrun-feather">
                  <h3>Feather</h3>
                  <div className="reward-fields-stat">
                    <span className="reward-fields-stat-label">Purchase Limit (LND)</span>
                    <input
                      className="modal-input reward-winner-input"
                      inputMode="numeric"
                      type="text"
                      value={parseNonNegativeInteger((overrunRewardFields.LND || {}).perPlayer)}
                      onChange={(event) => handleOverrunPurchaseLimitChange("LND", event.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="reward-fields-stat">
                    <span className="reward-fields-stat-label">Purchase Limit (TNS)</span>
                    <input
                      className="modal-input reward-winner-input"
                      inputMode="numeric"
                      type="text"
                      value={parseNonNegativeInteger((overrunRewardFields.TNS || {}).perPlayer)}
                      onChange={(event) => handleOverrunPurchaseLimitChange("TNS", event.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <p className="reward-fields-meta">
                    Total players to be reward: {overrunFeatherPlayerCount}
                  </p>
                </div>

                <div className="reward-fields-card" key="overrun-card-fragment">
                  <h3>Card Fragment</h3>
                  <div className="reward-fields-stat">
                    <span className="reward-fields-stat-label">Purchase Limit</span>
                    <input
                      className="modal-input reward-winner-input"
                      inputMode="numeric"
                      type="text"
                      value={parseNonNegativeInteger((overrunRewardFields["Card Fragment"] || {}).perPlayer)}
                      onChange={(event) => handleOverrunPurchaseLimitChange("Card Fragment", event.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <p className="reward-fields-meta">
                    Total players to be reward: {overrunCardPlayerCount}
                  </p>
                </div>
              </div>

              {selectedOverrunRewards && (
                <p className="modal-note modal-note--tiny overrun-reward-preview">
                  Rewards [LND/TNS/Card]: {selectedOverrunRewards.LND}/{selectedOverrunRewards.TNS}/{selectedOverrunRewards["Card Fragment"]}
                </p>
              )}

              <div className="modal-field">
                <label className="officer-benefit-toggle" htmlFor="officerCardBenefit">
                  <input
                    id="officerCardBenefit"
                    type="checkbox"
                    checked={officerCardBenefitEnabled}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setOfficerCardBenefitEnabled(checked);
                      if (!checked) {
                        setSelectedOfficerCardRecipients([]);
                      }
                    }}
                  />
                  <span className="officer-benefit-toggle-ui" aria-hidden="true" />
                  <span className="officer-benefit-toggle-text">Officer Card Benefit</span>
                </label>

                {officerCardBenefitEnabled && (
                  <div className="officer-benefit-list" role="group" aria-label="Officer Card Benefit Recipients">
                    {officerOptions.map((officerIgn) => {
                      const selected = selectedOfficerCardRecipients.includes(officerIgn);
                      const lockUnselected = !selected && selectedOfficerCardCount >= overrunSucceedingCardRemaining;
                      return (
                        <label key={`benefit-${officerIgn}`} className={`officer-benefit-item${selected ? " officer-benefit-item--active" : ""}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={lockUnselected || overrunSucceedingCardRemaining === 0}
                            onChange={() => toggleOfficerCardRecipient(officerIgn)}
                          />
                          <span>{officerIgn}</span>
                        </label>
                      );
                    })}
                    {officerOptions.length === 0 && <p className="modal-note modal-note--tiny">No officers available.</p>}
                  </div>
                )}

                <p className="modal-note modal-note--tiny">
                  Excess Card Fragment Remaining {selectedOfficerCardCount}/{overrunSucceedingCardRemaining}
                </p>
                <p className="modal-note modal-note--tiny">
                  Based on selected group/rank and pending Card Fragment players: {pendingRouletteByReward["Card Fragment"].length}
                </p>
              </div>

              {overrunResult && (
                <div className={`modal-result modal-result--${overrunResult.type}`}>
                  {overrunResult.message}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={handleCloseOverrunModal} disabled={isGeneratingOverrun}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-overrun"
                onClick={handleGenerateOverrunRewards}
                disabled={!overrunOfficerIGN || !overrunGameId || !selectedOverrunGroup || !selectedOverrunRank || isGeneratingOverrun}
              >
                {isGeneratingOverrun ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">Live Auction Viewer</span>
            <h1>ROOC Auction</h1>
            <p>
              Outlast Guild Auction Manager is a tool designed to manage auction bids and help prevent internal outbidding within the guild.
</p>
            <p>
Guild members can submit their IGN for specific auction rewards, and the system will randomize the list to ensure fair distribution among participants.
            </p>
          </div>
          <div className="hero-logo">
            <Image
              src={logoImage}
              alt="Outlast logo"
              width={400}
              height={400}
              priority
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="controls">
          <div className="button-row">
            {!hasAuctionDataRecords && (
              <>
                <button type="button" className="btn-change" onClick={handleOpenChange}>
                  Change IGN/Job
                </button>
                <button type="button" className="btn-insert" onClick={handleOpenInsert}>
                  Insert IGN
                </button>
              </>
            )}
            {!hasThursdayAuctionDate && (
              <button type="button" className="btn-randomize" onClick={handleOpenRandomizer}>
                Generate Guild League Rewards
              </button>
            )}
            <button type="button" className="btn-overrun" onClick={handleOpenOverrunModal}>
              Generate Overrun Rewards
            </button>
            <button type="button" className="btn-clear" onClick={handleOpenClearModal}>
              Clear the Data
            </button>
            <span className="chip">{lastShuffledAt}</span>
          </div>
        </div>

        {hasAuctionData ? (
          <>
            <div className="weekly-tables">
              {orderedAuctionDates.map((date) => {
                const dayLabel = getDayLabelFromDateString(date);
                const dayTabs = auctionRowsByDate.get(date) || createEmptyAuctionTabs();
                const isSunday = isSundayFromDateString(date);
                const overrunData = isSunday ? (dayTabs["Emperium Overrun"] || createEmptyRewardColumns()) : createEmptyRewardColumns();
                const overrunFeatherEntries = isSunday ? combineFeatherEntries(overrunData.LND, overrunData.TNS) : [];
                const guildLeagueData = !isSunday ? (dayTabs["Guild League"] || createEmptyRewardColumns()) : createEmptyRewardColumns();
                const leaguePrizeData = !isSunday ? (dayTabs["League Prize"] || createEmptyRewardColumns()) : createEmptyRewardColumns();
                const guildLeagueFeatherEntries = !isSunday ? combineFeatherEntries(guildLeagueData.LND, guildLeagueData.TNS) : [];
                const leaguePrizeFeatherEntries = !isSunday ? combineFeatherEntries(leaguePrizeData.LND, leaguePrizeData.TNS) : [];
                return (
                  <div className="table-shell" key={`weekly-${date}-${dayLabel}`}>
                    <div className="table-title">
                      <span>{dayLabel} - {date}</span>
                      <div className="table-title-actions">
                        <button
                          type="button"
                          className="table-title-btn table-title-btn--claim"
                          onClick={() => handleOpenClaimModal(date)}
                          disabled={isClaiming && claimAuctionDate === date}
                        >
                          {isClaiming && claimAuctionDate === date ? "Claiming..." : "Claimed"}
                        </button>
                        <button
                          type="button"
                          className="table-title-btn table-title-btn--copy"
                          onClick={() => handleCopyRewardData(dayTabs, date)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    {isSunday ? (
                      <>
                        <h4 className="table-subtitle">Emperium Overrun Tab</h4>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Feather</th>
                                <th>Card Fragment</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {[
                                  { rewardKey: "Feather", entries: overrunFeatherEntries },
                                  { rewardKey: "Card Fragment", entries: overrunData["Card Fragment"] || [] },
                                ].map(({ rewardKey, entries }) => (
                                  <td key={`${dayLabel}-overrun-${rewardKey}`}>
                                    {entries.length === 0 ? (
                                      <span className="table-cell-value">-</span>
                                    ) : (
                                      <ol className={`reward-list${rewardKey === "Feather" ? " reward-list--feather" : ""}`}>
                                        {entries.map((entry, itemIndex) => {
                                          const normalizedStatus = String(entry.status || "").toLowerCase();
                                          const isUnclaimed = normalizedStatus === "unclaimed" || normalizedStatus === "unclaim";
                                          if (rewardKey === "Feather") {
                                            const lndUnclaimed = !entry.lndPages || ["unclaimed","unclaim"].includes(String(entry.lndStatus || "").toLowerCase());
                                            const tnsUnclaimed = !entry.tnsPages || ["unclaimed","unclaim"].includes(String(entry.tnsStatus || "").toLowerCase());
                                            const allUnclaimed = lndUnclaimed && tnsUnclaimed;
                                            return (
                                              <li key={`overrun-feather-${entry.ign}-${itemIndex}`}>
                                                <span className="table-cell-value">{itemIndex + 1}. {entry.ign} {!allUnclaimed && <span className="reward-claimed" title="Claimed" aria-label="Claimed">🏆</span>}</span>
                                                {entry.lndPages && <span className="reward-pages" style={lndUnclaimed ? undefined : { textDecoration: "line-through" }}>LND: {entry.lndPages}</span>}
                                                {entry.tnsPages && <span className="reward-pages" style={tnsUnclaimed ? undefined : { textDecoration: "line-through" }}>TNS: {entry.tnsPages}</span>}
                                              </li>
                                            );
                                          }
                                          return (
                                            <li key={`overrun-card-${entry.ign}-${itemIndex}`}>
                                              <span className="table-cell-value">{itemIndex + 1}. {entry.ign} {!isUnclaimed && <span className="reward-claimed" title="Claimed" aria-label="Claimed">🏆</span>}</span>
                                              <span className="reward-pages" style={isUnclaimed ? undefined : { textDecoration: "line-through" }}>{entry.pages}</span>
                                            </li>
                                          );
                                        })}
                                      </ol>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <>
                        <h4 className="table-subtitle">Guild League Tab</h4>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Feather</th>
                                <th>Card Fragment</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {[
                                  { rewardKey: "Feather", entries: guildLeagueFeatherEntries },
                                  { rewardKey: "Card Fragment", entries: guildLeagueData["Card Fragment"] || [] },
                                ].map(({ rewardKey, entries }) => (
                                  <td key={`${dayLabel}-gl-${rewardKey}`}>
                                    {entries.length === 0 ? (
                                      <span className="table-cell-value">-</span>
                                    ) : (
                                      <ol className={`reward-list${rewardKey === "Feather" ? " reward-list--feather" : ""}`}>
                                        {entries.map((entry, itemIndex) => {
                                          const normalizedStatus = String(entry.status || "").toLowerCase();
                                          const isUnclaimed = normalizedStatus === "unclaimed" || normalizedStatus === "unclaim";
                                          if (rewardKey === "Feather") {
                                            const lndUnclaimed = !entry.lndPages || ["unclaimed","unclaim"].includes(String(entry.lndStatus || "").toLowerCase());
                                            const tnsUnclaimed = !entry.tnsPages || ["unclaimed","unclaim"].includes(String(entry.tnsStatus || "").toLowerCase());
                                            const allUnclaimed = lndUnclaimed && tnsUnclaimed;
                                            return (
                                              <li key={`gl-feather-${entry.ign}-${itemIndex}`}>
                                                <span className="table-cell-value">{itemIndex + 1}. {entry.ign} {!allUnclaimed && <span className="reward-claimed" title="Claimed" aria-label="Claimed">🏆</span>}</span>
                                                {entry.lndPages && <span className="reward-pages" style={lndUnclaimed ? undefined : { textDecoration: "line-through" }}>LND: {entry.lndPages}</span>}
                                                {entry.tnsPages && <span className="reward-pages" style={tnsUnclaimed ? undefined : { textDecoration: "line-through" }}>TNS: {entry.tnsPages}</span>}
                                              </li>
                                            );
                                          }
                                          return (
                                            <li key={`gl-card-${entry.ign}-${itemIndex}`}>
                                              <span className="table-cell-value">{itemIndex + 1}. {entry.ign} {!isUnclaimed && <span className="reward-claimed" title="Claimed" aria-label="Claimed">🏆</span>}</span>
                                              <span className="reward-pages" style={isUnclaimed ? undefined : { textDecoration: "line-through" }}>{entry.pages}</span>
                                            </li>
                                          );
                                        })}
                                      </ol>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <h4 className="table-subtitle">League Prize Tab</h4>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Feather</th>
                                <th>Card Fragment</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {[
                                  { rewardKey: "Feather", entries: leaguePrizeFeatherEntries },
                                  { rewardKey: "Card Fragment", entries: leaguePrizeData["Card Fragment"] || [] },
                                ].map(({ rewardKey, entries }) => (
                                  <td key={`${dayLabel}-lp-${rewardKey}`}>
                                    {entries.length === 0 ? (
                                      <span className="table-cell-value">-</span>
                                    ) : (
                                      <ol className={`reward-list${rewardKey === "Feather" ? " reward-list--feather" : ""}`}>
                                        {entries.map((entry, itemIndex) => {
                                          const normalizedStatus = String(entry.status || "").toLowerCase();
                                          const isUnclaimed = normalizedStatus === "unclaimed" || normalizedStatus === "unclaim";
                                          if (rewardKey === "Feather") {
                                            const lndUnclaimed = !entry.lndPages || ["unclaimed","unclaim"].includes(String(entry.lndStatus || "").toLowerCase());
                                            const tnsUnclaimed = !entry.tnsPages || ["unclaimed","unclaim"].includes(String(entry.tnsStatus || "").toLowerCase());
                                            const allUnclaimed = lndUnclaimed && tnsUnclaimed;
                                            return (
                                              <li key={`lp-feather-${entry.ign}-${itemIndex}`}>
                                                <span className="table-cell-value">{itemIndex + 1}. {entry.ign} {!allUnclaimed && <span className="reward-claimed" title="Claimed" aria-label="Claimed">🏆</span>}</span>
                                                {entry.lndPages && <span className="reward-pages" style={lndUnclaimed ? undefined : { textDecoration: "line-through" }}>LND: {entry.lndPages}</span>}
                                                {entry.tnsPages && <span className="reward-pages" style={tnsUnclaimed ? undefined : { textDecoration: "line-through" }}>TNS: {entry.tnsPages}</span>}
                                              </li>
                                            );
                                          }
                                          return (
                                            <li key={`lp-card-${entry.ign}-${itemIndex}`}>
                                              <span className="table-cell-value">{itemIndex + 1}. {entry.ign} {!isUnclaimed && <span className="reward-claimed" title="Claimed" aria-label="Claimed">🏆</span>}</span>
                                              <span className="reward-pages" style={isUnclaimed ? undefined : { textDecoration: "line-through" }}>{entry.pages}</span>
                                            </li>
                                          );
                                        })}
                                      </ol>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pending-reward-shell">
              <div className="pending-reward-title">Players Not Yet in Auction Data [{pendingRouletteTotal}]</div>
              <div className="pending-reward-grid">
                {[
                  { label: "Feather", entries: pendingFeatherPlayers, key: "feather" },
                  { label: "Card Fragment", entries: pendingRouletteByReward["Card Fragment"] || [], key: "card-fragment" },
                ].map(({ label, entries, key }) => (
                  <div className="pending-reward-card" key={`pending-${key}`}>
                    <h3>{label}</h3>
                    {entries.length === 0 ? (
                      <p className="pending-reward-empty">-</p>
                    ) : (
                      <ol>
                        {entries.map((ign, index) => (
                          <li key={`${key}-${ign}-${index}`}>{ign}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="table-shell">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {columns.map((column, index) => (
                      <th key={`${column}-${index}`}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td className="empty" colSpan={Math.max(columns.length, 1)}>
                        {rows.length === 0 ? "No rows found in this sheet." : "No rows available."}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((rowData, rowIndex) => (
                      <tr key={`row-${rowIndex}`}>
                        {columns.map((_, columnIndex) => {
                          const cellValue = rowData[columnIndex] || "";
                          return (
                            <td key={`cell-${rowIndex}-${columnIndex}`}>
                              <span className="table-cell-value">{cellValue}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="footer-note">
          Developed by: <a href="https://www.facebook.com/xzviel" target="_blank" rel="noopener noreferrer">xzvl</a>.
        </p>
      </section>
    </main>
  );
}

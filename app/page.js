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

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzajz1eAmPus_0k0Zoj7g0InEnrPaa8VdEnIO_3FD4VB3SPZ7tYNpqxlxOpJgsQ3u3naA/exec";

const REWARD_OPTIONS = [
  { label: "Light and Dark", value: "LND" },
  { label: "Time and Space", value: "TNS" },
  { label: "Card Fragment", value: "Card Frag(Prio from Elite)" },
];

const PER_PLAYER_DEFAULTS = {
  LND: 6,
  TNS: 10,
  "Card Frag(Prio from Elite)": 1,
};

const GL_TIER_OPTIONS = [
  { label: "Bronze",        value: "Bronze",        totals: { LND: 30,  TNS: 50,  "Card Frag(Prio from Elite)": 2 } },
  { label: "Silver",        value: "Silver",        totals: { LND: 35,  TNS: 60,  "Card Frag(Prio from Elite)": 2 } },
  { label: "Gold",          value: "Gold",          totals: { LND: 40,  TNS: 70,  "Card Frag(Prio from Elite)": 2 } },
  { label: "Platinum",      value: "Platinum",      totals: { LND: 45,  TNS: 80,  "Card Frag(Prio from Elite)": 2 } },
  { label: "Shinning Stars",value: "Shinning Stars",totals: { LND: 47,  TNS: 85,  "Card Frag(Prio from Elite)": 2 } },
  { label: "Glorious Moon", value: "Glorious Moon", totals: { LND: 50,  TNS: 90,  "Card Frag(Prio from Elite)": 2 } },
  { label: "Bright Sun",    value: "Bright Sun",    totals: { LND: 55,  TNS: 100, "Card Frag(Prio from Elite)": 2 } },
];

const OVERRUN_RANK_OPTIONS = [
  { label: "Rank 1", value: "1" },
  { label: "Rank 2", value: "2" },
  { label: "Rank 3", value: "3" },
  { label: "Rank 4", value: "4" },
  { label: "Rank 5", value: "5" },
  { label: "Rank 6", value: "6" },
  { label: "Rank 7", value: "7" },
  { label: "Rank 8", value: "8" },
];

function createEmptyRewardColumns() {
  return {
    LND: [],
    TNS: [],
    "Card Frag(Prio from Elite)": [],
  };
}

function createDefaultRewardFields() {
  return {
    LND: { perPlayer: String(PER_PLAYER_DEFAULTS.LND), total: "0", winnerPerGL: "0" },
    TNS: { perPlayer: String(PER_PLAYER_DEFAULTS.TNS), total: "0", winnerPerGL: "0" },
    "Card Frag(Prio from Elite)": { perPlayer: String(PER_PLAYER_DEFAULTS["Card Frag(Prio from Elite)"]), total: "0", winnerPerGL: "0" },
  };
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
  const [memberOptions, setMemberOptions] = useState([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [selectedIGN, setSelectedIGN] = useState("");
  const [selectedReward, setSelectedReward] = useState("");
  const [insertGameId, setInsertGameId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const [showRandomizerModal, setShowRandomizerModal] = useState(false);
  const [officerOptions, setOfficerOptions] = useState([]);
  const [selectedOfficerIGN, setSelectedOfficerIGN] = useState("");
  const [randomizerGameId, setRandomizerGameId] = useState("");
  const [selectedGLTier, setSelectedGLTier] = useState("");
  const [timerInput, setTimerInput] = useState("00:00:05");
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [randomizerResult, setRandomizerResult] = useState(null);
  const [randomizedColumns, setRandomizedColumns] = useState(createEmptyRewardColumns);
  const [displayedColumns, setDisplayedColumns] = useState(createEmptyRewardColumns);
  const [rewardFields, setRewardFields] = useState(createDefaultRewardFields);

  const [showOverrunModal, setShowOverrunModal] = useState(false);
  const [overrunOfficerIGN, setOverrunOfficerIGN] = useState("");
  const [overrunGameId, setOverrunGameId] = useState("");
  const [selectedOverrunRank, setSelectedOverrunRank] = useState("");
  const [isGeneratingOverrun, setIsGeneratingOverrun] = useState(false);
  const [overrunResult, setOverrunResult] = useState(null);

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearOfficerIGN, setClearOfficerIGN] = useState("");
  const [clearGameId, setClearGameId] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState(null);
  const [claimingDate, setClaimingDate] = useState("");

  const isFirstLoadRef = useRef(true);
  const lastSignatureRef = useRef("");
  const mainSheetLoaderRef = useRef(createJsonpLoader());
  const auctionDataLoaderRef = useRef(createJsonpLoader());
  const triggerSheetLoaderRef = useRef(createJsonpLoader());
  const membersLoaderRef = useRef(createJsonpLoader());
  const auctionNamesLoaderRef = useRef(createJsonpLoader());
  const shuffleIntervalRef = useRef(null);
  const shuffleTimeoutRef = useRef(null);

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
          if (!ign || seenIgn.has(ign.toLowerCase())) {
            continue;
          }

          seenIgn.add(ign.toLowerCase());
          nextOptions.push({
            ign,
            badge: String(row[badgeIndex] || "").trim(),
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
      "Card Frag(Prio from Elite)": {
        perPlayer: String(PER_PLAYER_DEFAULTS["Card Frag(Prio from Elite)"]),
        total: String(tier.totals["Card Frag(Prio from Elite)"]),
        winnerPerGL: String(Math.floor(tier.totals["Card Frag(Prio from Elite)"] / PER_PLAYER_DEFAULTS["Card Frag(Prio from Elite)"])),
      },
    });
  }, []);

  const handleOpenRandomizer = useCallback(() => {
    setShowRandomizerModal(true);
    setSelectedOfficerIGN("");
    setRandomizerGameId("");
    setSelectedGLTier("");
    setTimerInput("00:00:05");
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
      "Card Frag(Prio from Elite)": shuffleNames(finalColumns["Card Frag(Prio from Elite)"] || []),
    });

    if (durationMs <= stepMs) {
      setDisplayedColumns(finalColumns);
      return;
    }

    shuffleIntervalRef.current = window.setInterval(() => {
      setDisplayedColumns({
        LND: shuffleNames(finalColumns.LND || []),
        TNS: shuffleNames(finalColumns.TNS || []),
        "Card Frag(Prio from Elite)": shuffleNames(finalColumns["Card Frag(Prio from Elite)"] || []),
      });
    }, stepMs);

    shuffleTimeoutRef.current = window.setTimeout(() => {
      stopShuffleAnimation();
      setDisplayedColumns(finalColumns);
    }, durationMs);
  }, [shuffleNames, stopShuffleAnimation]);

  const handleWinnerPerGLChange = useCallback((rewardKey, nextValue) => {
    if (!/^\d*$/.test(nextValue)) {
      return;
    }

    setRewardFields((current) => ({
      ...current,
      [rewardKey]: {
        ...(current[rewardKey] || { perPlayer: "1", total: "0", winnerPerGL: "0" }),
        winnerPerGL: nextValue,
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
      timerSeconds: String(parsedAnimationSeconds),
      winnerPerGLLND:  String(parseNonNegativeInteger((rewardFields["LND"]                        || {}).winnerPerGL)),
      winnerPerGLTNS:  String(parseNonNegativeInteger((rewardFields["TNS"]                        || {}).winnerPerGL)),
      winnerPerGLCard: String(parseNonNegativeInteger((rewardFields["Card Frag(Prio from Elite)"] || {}).winnerPerGL)),
      perPlayerLND:    String(PER_PLAYER_DEFAULTS.LND),
      perPlayerTNS:    String(PER_PLAYER_DEFAULTS.TNS),
      perPlayerCard:   String(PER_PLAYER_DEFAULTS["Card Frag(Prio from Elite)"]),
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
          "Card Frag(Prio from Elite)": data.randomized?.["Card Frag(Prio from Elite)"] || [],
        };

        setRandomizedColumns(finalColumns);
        runShuffleAnimation(finalColumns, parsedAnimationSeconds);

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
  }, [isRandomizing, loadSheet, parsedAnimationSeconds, randomizerGameId, rewardFields, runShuffleAnimation, selectedOfficerIGN, stopShuffleAnimation]);

  const handleOpenClearModal = useCallback(() => {
    setShowClearModal(true);
    setClearOfficerIGN("");
    setClearGameId("");
    setClearResult(null);
    fetchMembersData();
  }, [fetchMembersData]);

  const handleOpenOverrunModal = useCallback(() => {
    setShowOverrunModal(true);
    setOverrunOfficerIGN("");
    setOverrunGameId("");
    setSelectedOverrunRank("");
    setOverrunResult(null);
    fetchMembersData();
  }, [fetchMembersData]);

  const handleCloseOverrunModal = useCallback(() => {
    if (isGeneratingOverrun) {
      return;
    }
    setShowOverrunModal(false);
  }, [isGeneratingOverrun]);

  const handleGenerateOverrunRewards = useCallback(() => {
    if (!overrunOfficerIGN || !overrunGameId || !selectedOverrunRank || isGeneratingOverrun) {
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
      guildRanking: selectedOverrunRank,
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
        setOverrunResult({
          type: "success",
          message: `Overrun rewards generated. Added ${rowsInserted} row(s)${cycledRows > 0 ? ` and updated ${cycledRows} cycled row(s)` : ""}.`,
        });
        loadSheet();
      })
      .catch((error) => {
        setIsGeneratingOverrun(false);
        setOverrunResult({ type: "error", message: `Request failed: ${error.message}` });
      });
  }, [isGeneratingOverrun, loadSheet, overrunGameId, overrunOfficerIGN, selectedOverrunRank]);

  const handleCloseClearModal = useCallback(() => {
    if (isClearing) {
      return;
    }
    setShowClearModal(false);
  }, [isClearing]);

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

        setClearResult({ type: "success", message: "ROOC Auction Data cleared." });
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

  const handleClaimDate = useCallback((auctionDate) => {
    if (!auctionDate || claimingDate) {
      return;
    }

    if (!APPS_SCRIPT_URL) {
      return;
    }

    setClaimingDate(auctionDate);
    const params = new URLSearchParams({
      action: "claimAuctionDate",
      auctionDate,
    });

    fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, { redirect: "follow" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setClaimingDate("");
        if (!data.success) {
          return;
        }
        loadSheet();
      })
      .catch(() => {
        setClaimingDate("");
      });
  }, [claimingDate, loadSheet]);

  const handleCopyLndData = useCallback(async (dayData) => {
    const entries = (dayData?.LND || []);
    const lines = ["FOR LND", ...entries.map((entry) => `@${entry.ign} = ${entry.pages || "-"}`)];
    const text = lines.join("\n");

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers where async clipboard is unavailable.
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }, []);

  const auctionRowsByDate = useMemo(() => {
    const byDate = new Map();
    for (let i = 0; i < auctionDataRows.length; i += 1) {
      const row = auctionDataRows[i] || [];
      const ign = String(row[0] || "").trim();
      const reward = String(row[1] || "").trim();
      const status = String(row[2] || "").trim();
      const pages = String(row[3] || "").trim();
      const date = String(row[4] || "").trim();
      if (!ign || !reward || !date) {
        continue;
      }
      if (!byDate.has(date)) {
        byDate.set(date, { LND: [], TNS: [], "Card Frag(Prio from Elite)": [] });
      }
      if (reward === "LND" || reward === "TNS" || reward === "Card Frag(Prio from Elite)") {
        byDate.get(date)[reward].push({ ign, status, pages });
      }
    }
    return byDate;
  }, [auctionDataRows]);

  const orderedAuctionDates = useMemo(() => {
    const dates = Array.from(auctionRowsByDate.keys());
    dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return dates;
  }, [auctionRowsByDate]);
  const hasAuctionData = orderedAuctionDates.length > 0;

  useEffect(() => {
    return () => {
      stopShuffleAnimation();
    };
  }, [stopShuffleAnimation]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  return (
    <main className="shell">
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
                  options={REWARD_OPTIONS}
                  value={selectedReward}
                  onChange={setSelectedReward}
                  placeholder="Select reward…"
                  searchPlaceholder="Search reward…"
                  toLabel={(option) => option.label}
                  toValue={(option) => option.value}
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

      {showRandomizerModal && (
        <div className="modal-overlay" onClick={handleCloseRandomizer}>
          <div className="modal-card modal-card--randomizer" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Randomizer</h2>
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

              <div className="reward-fields-grid">
                {REWARD_OPTIONS.map((reward) => {
                  const rewardPerPlayer = parseNonNegativeInteger((rewardFields[reward.value] || {}).perPlayer);
                  const winnerPerGLValue = (rewardFields[reward.value] || {}).winnerPerGL || "0";
                  return (
                    <div className="reward-fields-card" key={`config-${reward.value}`}>
                      <h3>{reward.label}</h3>
                      <div className="reward-fields-stat">
                        <span className="reward-fields-stat-label">Winners per GL</span>
                        <input
                          className="modal-input reward-winner-input"
                          inputMode="numeric"
                          type="text"
                          value={winnerPerGLValue}
                          onChange={(event) => handleWinnerPerGLChange(reward.value, event.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <p className="reward-fields-meta">
                        Reward per player: {rewardPerPlayer}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div
                className="randomizer-preview"
                style={{ "--shuffle-duration": `${parsedAnimationSeconds}s` }}
              >
                {REWARD_OPTIONS.map((reward) => (
                  <div className="random-col" key={reward.value}>
                    <h3>{reward.label}</h3>
                    <ol>
                      {(displayedColumns[reward.value] || []).map((name, index) => {
                        const winnerCount = getWinnerCount(reward.value);
                        let highlightClass = "";
                        if (index < winnerCount) {
                          highlightClass = "random-tuesday";
                        } else if (index < winnerCount * 2) {
                          highlightClass = "random-thursday";
                        }
                        return (
                          <li
                            key={`${reward.value}-${name}-${index}`}
                            className={highlightClass}
                          >
                            {name}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
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
                  disabled={!selectedOfficerIGN || !randomizerGameId || isRandomizing}
                >
                  {isRandomizing ? "Randomizing..." : "Trigger Randomizer"}
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

      {showOverrunModal && (
        <div className="modal-overlay" onClick={handleCloseOverrunModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Set Overrun Rewards</h2>
              <button type="button" className="modal-close" onClick={handleCloseOverrunModal} aria-label="Close" disabled={isGeneratingOverrun}>✕</button>
            </div>

            <div className="modal-body">
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

              <div className="modal-field">
                <label className="modal-label" htmlFor="overrunRankSelect">Guild Ranking</label>
                <select
                  id="overrunRankSelect"
                  className="modal-input modal-select"
                  value={selectedOverrunRank}
                  onChange={(event) => setSelectedOverrunRank(event.target.value)}
                >
                  <option value="">Select rank…</option>
                  {OVERRUN_RANK_OPTIONS.map((rank) => (
                    <option key={rank.value} value={rank.value}>{rank.label}</option>
                  ))}
                </select>
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
                disabled={!overrunOfficerIGN || !overrunGameId || !selectedOverrunRank || isGeneratingOverrun}
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
          <div className="roc-title">Ragnarok Origin Classic</div>
          <div className="button-row">
            <button type="button" className="btn-insert" onClick={handleOpenInsert}>
              Insert IGN
            </button>
            <button type="button" className="btn-randomize" onClick={handleOpenRandomizer}>
              Randomizer
            </button>
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
          <div className="weekly-tables">
            {orderedAuctionDates.map((date) => {
              const dayLabel = getDayLabelFromDateString(date);
              const dayData = auctionRowsByDate.get(date) || createEmptyRewardColumns();
              return (
                <div className="table-shell" key={`weekly-${date}-${dayLabel}`}>
                  <div className="table-title">
                    <span>{dayLabel} - {date}</span>
                    <div className="table-title-actions">
                      <button
                        type="button"
                        className="table-title-btn table-title-btn--claim"
                        onClick={() => handleClaimDate(date)}
                        disabled={claimingDate === date}
                      >
                        {claimingDate === date ? "Claiming..." : "Claimed"}
                      </button>
                      <button
                        type="button"
                        className="table-title-btn table-title-btn--copy"
                        onClick={() => handleCopyLndData(dayData)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Light and Dark</th>
                          <th>Time and Space</th>
                          <th>Card Fragment</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {["LND", "TNS", "Card Frag(Prio from Elite)"].map((rewardKey) => {
                            const entries = dayData[rewardKey] || [];
                            return (
                              <td key={`${dayLabel}-${rewardKey}`}>
                                {entries.length === 0 ? (
                                  <span className="table-cell-value">-</span>
                                ) : (
                                  <ol className="reward-list">
                                    {entries.map((entry, itemIndex) => {
                                      const isUnclaimed = String(entry.status || "").toLowerCase() === "unclaimed";
                                      return (
                                        <li key={`${rewardKey}-${entry.ign}-${itemIndex}`}>
                                          <span className="table-cell-value">{itemIndex + 1}. {entry.ign}</span>
                                          {isUnclaimed ? (
                                            <span className="reward-pages">{entry.pages}</span>
                                          ) : (
                                            <span className="reward-claimed" title="Claimed" aria-label="Claimed">🏆</span>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ol>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
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

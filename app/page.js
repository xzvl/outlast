"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logoImage from "./assets/logo.png";

const SHEET_ID = "1Uyho2Vk0j45oAPiYu0GLCMHn7be3E7h92-bREAS443s";
const SHEET_NAME = "ROOC Auction Roulette";
const MAIN_SHEET_GID = "946119161";
const COMPLETED_SHEET_GID = "19082640";
const MEMBERS_SHEET_NAME = "ROOC Members Data";
const MEMBERS_DATA_GID = "114714217";
const AUTO_REFRESH_MS = 30000;

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwtqYzQuZddVnPtQ7MchhDyUnwsSx8pLB7fwGkiv1GgVFXaIBfow8_6vpCuW_ZNXWErSQ/exec";

const REWARD_OPTIONS = [
  { label: "Light and Dark", value: "LND" },
  { label: "Time and Space", value: "TNS" },
  { label: "Card Fragment", value: "Card Frag(Prio from Elite)" },
];

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
  const [status, setStatus] = useState("Loading the sheet...");
  const [isError, setIsError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [lastUpdated, setLastUpdated] = useState("Waiting for first load");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [completedIgnSet, setCompletedIgnSet] = useState(new Set());

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
  const [timerInput, setTimerInput] = useState("00:00:01");
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [randomizerResult, setRandomizerResult] = useState(null);
  const [randomizedColumns, setRandomizedColumns] = useState({ LND: [], TNS: [], "Card Frag(Prio from Elite)": [] });
  const [shuffleTick, setShuffleTick] = useState(0);

  const isFirstLoadRef = useRef(true);
  const lastSignatureRef = useRef("");
  const mainSheetLoaderRef = useRef(createJsonpLoader());
  const completedSheetLoaderRef = useRef(createJsonpLoader());
  const membersLoaderRef = useRef(createJsonpLoader());
  const auctionNamesLoaderRef = useRef(createJsonpLoader());

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let nextRows = [...rows];

    if (query) {
      nextRows = nextRows.filter((row) => row.some((value) => value.toLowerCase().includes(query)));
    }



    return nextRows;
  }, [rows, searchQuery]);

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
      setStatus("The sheet returned an unexpected response.");
      setIsError(true);
      setIsRefreshing(false);
      return;
    }

    const nextData = extractTableData(table);
    const nextSignature = JSON.stringify(nextData);
    const hasChanged = nextSignature !== lastSignatureRef.current;

    setColumns(nextData.columns);
    setRows(nextData.rows);
    lastSignatureRef.current = nextSignature;

    if (isFirstLoadRef.current) {
      setStatus(`Loaded ${nextData.rows.length} rows from ${SHEET_NAME}. This page checks for updates every ${AUTO_REFRESH_MS / 1000} seconds.`);
      setLastUpdated(`Loaded ${new Date().toLocaleString()}`);
    } else if (hasChanged) {
      setStatus(`Google Sheets changed. Showing latest ${nextData.rows.length} rows from ${SHEET_NAME}.`);
      setLastUpdated(`Updated ${new Date().toLocaleString()}`);
    } else {
      setStatus(`No changes found. Still showing ${nextData.rows.length} rows from ${SHEET_NAME}.`);
    }

    setIsError(false);
    setIsRefreshing(false);
    isFirstLoadRef.current = false;
  }, []);

  const loadCompletedIgns = useCallback(() => {
    completedSheetLoaderRef.current({
      gid: COMPLETED_SHEET_GID,
      callbackName: "__completedSheetResponse",
      onResponse: (response) => {
        const table = response?.table;
        const rawRows = extractRows(table);
        const ignIndex = 0;

        const hasHeader =
          rawRows.length > 0 &&
          String(rawRows[0][ignIndex] || "").trim().toLowerCase() === "ign";

        const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
        const nextSet = new Set(
          dataRows
            .map((row) => String(row[ignIndex] || "").trim().toLowerCase())
            .filter(Boolean)
        );

        setCompletedIgnSet(nextSet);
      },
      onError: () => {
        setCompletedIgnSet(new Set());
      },
    });
  }, []);

  const loadSheet = useCallback((reason = "manual") => {
    if (isFirstLoadRef.current) {
      setStatus("Loading the sheet...");
    } else if (reason === "auto") {
      setStatus(`Checking Google Sheets for updates every ${AUTO_REFRESH_MS / 1000} seconds...`);
    } else {
      setStatus("Refreshing the sheet...");
    }

    setIsError(false);
    setIsRefreshing(true);

    mainSheetLoaderRef.current({
      gid: MAIN_SHEET_GID,
      callbackName: "__membersTableResponse",
      onResponse: handleMainSheetResponse,
      onError: () => {
        setStatus("The Google Sheets feed could not be loaded. Check that the sheet remains publicly accessible.");
        setIsError(true);
        setIsRefreshing(false);
      },
    });

    loadCompletedIgns();
  }, [handleMainSheetResponse, loadCompletedIgns]);

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
            loadSheet("manual");
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

  const handleOpenRandomizer = useCallback(() => {
    setShowRandomizerModal(true);
    setSelectedOfficerIGN("");
    setRandomizerGameId("");
    setTimerInput("00:00:01");
    setRandomizerResult(null);
    fetchMembersData();
  }, [fetchMembersData]);

  const handleCloseRandomizer = useCallback(() => {
    if (isRandomizing) {
      return;
    }
    setShowRandomizerModal(false);
  }, [isRandomizing]);

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

    const params = new URLSearchParams({
      action: "randomize",
      triggerIgn: selectedOfficerIGN,
      gameId: randomizerGameId,
      timerSeconds: String(parsedAnimationSeconds),
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

        setShuffleTick((value) => value + 1);
        setRandomizedColumns({
          LND: data.randomized?.LND || [],
          TNS: data.randomized?.TNS || [],
          "Card Frag(Prio from Elite)": data.randomized?.["Card Frag(Prio from Elite)"] || [],
        });

        setRandomizerResult({
          type: "success",
          message: `Randomized by ${selectedOfficerIGN}. Trigger log saved successfully.`,
        });
      })
      .catch((error) => {
        setIsRandomizing(false);
        setRandomizerResult({ type: "error", message: `Request failed: ${error.message}` });
      });
  }, [isRandomizing, parsedAnimationSeconds, randomizerGameId, selectedOfficerIGN]);

  useEffect(() => {
    loadSheet("initial");

    const interval = window.setInterval(() => {
      loadSheet("auto");
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
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

              <div className="modal-field">
                <label className="modal-label">Officer IGN</label>
                {isFetchingMembers ? (
                  <div className="modal-loading">Loading officers…</div>
                ) : (
                  <SelectField
                    options={officerOptions}
                    value={selectedOfficerIGN}
                    onChange={setSelectedOfficerIGN}
                    placeholder={officerOptions.length > 0 ? "Select officer IGN…" : "No officer roles found"}
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
                  placeholder="Enter Game ID to trigger"
                />
              </div>

              <div className="modal-field">
                <label className="modal-label" htmlFor="timerInput">Time (hour:minute:second)</label>
                <input
                  id="timerInput"
                  className="modal-input"
                  type="text"
                  value={timerInput}
                  onChange={(event) => setTimerInput(event.target.value)}
                  placeholder="00:00:01"
                />
              </div>

              {randomizerResult && (
                <div className={`modal-result modal-result--${randomizerResult.type}`}>
                  {randomizerResult.message}
                </div>
              )}

              <div
                className="randomizer-preview"
                style={{ "--shuffle-duration": `${parsedAnimationSeconds}s` }}
                key={shuffleTick}
              >
                {REWARD_OPTIONS.map((reward) => (
                  <div className="random-col" key={reward.value}>
                    <h3>{reward.label}</h3>
                    <ol>
                      {(randomizedColumns[reward.value] || []).map((name) => (
                        <li key={`${reward.value}-${name}`}>{name}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
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
          <label className="search-wrap" htmlFor="searchInput">
            <span>Search</span>
            <input
              id="searchInput"
              type="search"
              placeholder="Filter any value in the table"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <div className="button-row">
            <button type="button" onClick={() => loadSheet("manual")} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh Sheet"}
            </button>
            <button type="button" className="btn-insert" onClick={handleOpenInsert}>
              Insert IGN
            </button>
            <button type="button" className="btn-randomize" onClick={handleOpenRandomizer}>
              Randomizer
            </button>
            <span className="chip">{lastUpdated}</span>
          </div>
        </div>

        <div className={`status ${isError ? "error" : ""}`.trim()}>{status}</div>

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
                      {rows.length === 0 ? "No rows found in this sheet." : "No rows match the current filter."}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((rowData, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {columns.map((col, columnIndex) => {
                        const cellValue = rowData[columnIndex] || "";
                        const isCompletedIgn = completedIgnSet.has(String(cellValue).trim().toLowerCase());
                        const isNumberedCol = /lnd|tns|card/i.test(col);

                        return (
                          <td key={`cell-${rowIndex}-${columnIndex}`}>
                            {isNumberedCol && cellValue !== "" && (
                              <span className="col-item-number">{rowIndex + 1}. </span>
                            )}
                            <span className="table-cell-value">{cellValue}</span>
                            {isCompletedIgn && (
                              <span
                                className="completed-reward-indicator"
                                title="IGN found in ROOC Auction Completed"
                                aria-label="Completed reward"
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                  <path d="M8 3h8v2h3a1 1 0 0 1 1 1v2a5 5 0 0 1-4 4.9A5 5 0 0 1 13 15v2h3v2H8v-2h3v-2a5 5 0 0 1-3-2.1A5 5 0 0 1 4 8V6a1 1 0 0 1 1-1h3V3zm-2 4v1a3 3 0 0 0 2 2.82V7H6zm10 0v3.82A3 3 0 0 0 18 8V7h-2z" />
                                </svg>
                              </span>
                            )}
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

        <p className="footer-note">
          Developed by: <a href="https://www.facebook.com/xzviel" target="_blank" rel="noopener noreferrer">xzvl</a>.
        </p>
      </section>
    </main>
  );
}

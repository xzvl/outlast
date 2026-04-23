"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SHEET_ID = "1Uyho2Vk0j45oAPiYu0GLCMHn7be3E7h92-bREAS443s";
const SHEET_NAME = "ROOC Auction Roulette";
const MEMBERS_SHEET_NAME = "ROOC Members";
// gid of the main Auction Roulette sheet (display table + exclusion source)
const MAIN_SHEET_GID = "946119161";
// gid of ROOC Members – source of all selectable IGN names
const SOURCE_ROSTER_GID = "539653057";
// Exclusion: names already inserted live in the Auction Roulette sheet itself
const MEMBERS_GID = "946119161";
const AUTO_REFRESH_MS = 30000;

// TODO: Paste your deployed Google Apps Script web app URL here
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxh_3INbRBwsFVcxrtzhpBWm7MIiIMtPMWrCRmePPNPmcGpRQ_sDzJhEMCd2lIgYJ4eHQ/exec";

const REWARD_OPTIONS = [
  { label: "Light and Dark", value: "LND" },
  { label: "Time and Space", value: "TNS" },
  { label: "Card Fragment", value: "Card Frag(Prio from Elite)" },
];

function normalizeValue(cell) {
  if (!cell) {
    return "";
  }

  if (typeof cell.f === "string" && cell.f.trim()) {
    return cell.f;
  }

  if (cell.v === null || cell.v === undefined) {
    return "";
  }

  return String(cell.v);
}

function extractTableData(table) {
  const rawColumns = (table.cols || []).map((col, index) => col.label?.trim() || `Column ${index + 1}`);
  const rawRows = (table.rows || []).map((row) => (row.c || []).map(normalizeValue));

  if (rawRows.length > 0) {
    return {
      columns: rawRows[0].map((value, index) => value || `Column ${index + 1}`),
      rows: rawRows.slice(1)
    };
  }

  return {
    columns: rawColumns,
    rows: rawRows
  };
}

function compareValues(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function IGNSelect({ names, value, onChange }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filtered = useMemo(
    () => names.filter((n) => n.toLowerCase().includes(search.toLowerCase())),
    [names, search]
  );

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div className="ss-wrap" ref={wrapRef}>
      <button type="button" className="ss-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={value ? "ss-selected" : "ss-placeholder"}>{value || "Select IGN…"}</span>
        <span className="ss-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="ss-dropdown">
          <input
            className="ss-search"
            type="text"
            placeholder="Search IGN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="ss-list">
            {filtered.length === 0 ? (
              <div className="ss-empty">No matches</div>
            ) : (
              filtered.map((name) => (
                <div
                  key={name}
                  className={`ss-option${value === name ? " ss-option--active" : ""}`}
                  onClick={() => { onChange(name); setOpen(false); setSearch(""); }}
                >
                  {name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RewardSelect({ value, onChange }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filtered = useMemo(
    () => REWARD_OPTIONS.filter((o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.value.toLowerCase().includes(search.toLowerCase())
    ),
    [search]
  );

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selectedLabel = REWARD_OPTIONS.find((o) => o.value === value)?.label || "";

  return (
    <div className="ss-wrap" ref={wrapRef}>
      <button type="button" className="ss-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={selectedLabel ? "ss-selected" : "ss-placeholder"}>{selectedLabel || "Select reward…"}</span>
        <span className="ss-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="ss-dropdown">
          <input
            className="ss-search"
            type="text"
            placeholder="Search reward…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="ss-list">
            {filtered.length === 0 ? (
              <div className="ss-empty">No matches</div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt.value}
                  className={`ss-option${value === opt.value ? " ss-option--active" : ""}`}
                  onClick={() => { onChange(opt.value); setOpen(false); setSearch(""); }}
                >
                  <span className="ss-opt-label">{opt.label}</span>
                  <span className="ss-opt-badge">{opt.value}</span>
                </div>
              ))
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
  const [sortIndex, setSortIndex] = useState(-1);
  const [sortDirection, setSortDirection] = useState("asc");
  const [lastUpdated, setLastUpdated] = useState("Waiting for first load");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Insert IGN modal
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [memberNames, setMemberNames] = useState([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [selectedIGN, setSelectedIGN] = useState("");
  const [selectedReward, setSelectedReward] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEntryLocked, setIsEntryLocked] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const isFirstLoadRef = useRef(true);
  const lastSignatureRef = useRef("");
  const scriptNodeRef = useRef(null);
  const membersScriptRef = useRef(null);
  const membersExcludeScriptRef = useRef(null);
  const submitScriptRef = useRef(null);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let nextRows = [...rows];

    if (query) {
      nextRows = nextRows.filter((row) => row.some((value) => value.toLowerCase().includes(query)));
    }

    if (sortIndex >= 0) {
      const modifier = sortDirection === "asc" ? 1 : -1;
      nextRows.sort((left, right) => modifier * compareValues(left[sortIndex] || "", right[sortIndex] || ""));
    }

    return nextRows;
  }, [rows, searchQuery, sortDirection, sortIndex]);

  const handleSheetResponse = useCallback((response) => {
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
      setStatus(`Loaded ${nextData.rows.length} rows from ${SHEET_NAME}. This page checks for updates automatically every ${AUTO_REFRESH_MS / 1000} seconds.`);
      setLastUpdated(`Loaded ${new Date().toLocaleString()}`);
    } else if (hasChanged) {
      setStatus(`Google Sheets changed. Showing the latest ${nextData.rows.length} rows from ${SHEET_NAME}.`);
      setLastUpdated(`Updated ${new Date().toLocaleString()}`);
    } else {
      setStatus(`No changes found. Still showing ${nextData.rows.length} rows from ${SHEET_NAME}.`);
    }

    setIsError(false);
    setIsRefreshing(false);
    isFirstLoadRef.current = false;
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

    if (scriptNodeRef.current) {
      scriptNodeRef.current.remove();
      scriptNodeRef.current = null;
    }

    const cacheBuster = Date.now();

    window.__mainSheetResponse = handleSheetResponse;

    const script = document.createElement("script");
    script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:__mainSheetResponse&gid=${MAIN_SHEET_GID}&cacheBust=${cacheBuster}`;
    script.onerror = () => {
      setStatus("The Google Sheets feed could not be loaded. Check that the sheet remains publicly accessible.");
      setIsError(true);
      setIsRefreshing(false);
    };

    scriptNodeRef.current = script;
    document.body.appendChild(script);
  }, [handleSheetResponse]);

  const fetchMembers = useCallback(() => {
    setIsFetchingMembers(true);
    setMemberNames([]);

    // We fire two JSONP fetches in parallel and combine once both resolve.
    const pending = { source: null, exclude: null };

    function tryFinish() {
      if (pending.source === null || pending.exclude === null) return;
      // pending.source  = all names from the roster sheet (all columns, skip row 1)
      // pending.exclude = names already in ROOC Members (all columns, skip row 1)
      const excludeSet = new Set(pending.exclude.map((n) => n.toLowerCase()));
      const available = pending.source.filter((n) => !excludeSet.has(n.toLowerCase()));
      setMemberNames(available);
      setIsFetchingMembers(false);
    }

    // ── Fetch 1: source roster (gid=770033363) – collect ALL columns, skip row 1 ──
    window.__rosterSourceResponse = (response) => {
      const table = response?.table;
      if (!table) { pending.source = []; tryFinish(); return; }
      const rawRows = (table.rows || []).map((row) =>
        (row.c || []).map((cell) => (cell?.v ? String(cell.v).trim() : ""))
      );
      // Skip row 1 (index 0) as instructed; collect every non-empty cell in all columns
      const names = rawRows
        .slice(1)
        .flatMap((row) => row)
        .filter((n) => n.length > 0);
      // Deduplicate while preserving order
      pending.source = [...new Set(names)];
      tryFinish();
    };

    // ── Fetch 2: ROOC Members (gid=161442221) – collect ALL columns, skip row 1 ──
    window.__rosterExcludeResponse = (response) => {
      const table = response?.table;
      if (!table) { pending.exclude = []; tryFinish(); return; }
      const rawRows = (table.rows || []).map((row) =>
        (row.c || []).map((cell) => (cell?.v ? String(cell.v).trim() : ""))
      );
      const names = rawRows
        .slice(1)
        .flatMap((row) => row)
        .filter((n) => n.length > 0);
      pending.exclude = names;
      tryFinish();
    };

    // Clean up old script tags
    if (membersScriptRef.current) {
      membersScriptRef.current.remove();
      membersScriptRef.current = null;
    }
    if (membersExcludeScriptRef.current) {
      membersExcludeScriptRef.current.remove();
      membersExcludeScriptRef.current = null;
    }

    const bust = Date.now();

    const s1 = document.createElement("script");
    s1.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:__rosterSourceResponse&gid=${SOURCE_ROSTER_GID}&cacheBust=${bust}`;
    s1.onerror = () => { pending.source = []; tryFinish(); };
    membersScriptRef.current = s1;
    document.body.appendChild(s1);

    const s2 = document.createElement("script");
    s2.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:__rosterExcludeResponse&gid=${MEMBERS_GID}&cacheBust=${bust}`;
    s2.onerror = () => { pending.exclude = []; tryFinish(); };
    membersExcludeScriptRef.current = s2;
    document.body.appendChild(s2);
  }, []);

  const handleOpenInsert = useCallback(() => {
    setShowInsertModal(true);
    setSelectedIGN("");
    setSelectedReward("");
    setIsEntryLocked(false);
    setSubmitResult(null);
    fetchMembers();
  }, [fetchMembers]);

  const handleCloseInsert = useCallback(() => {
    setIsEntryLocked(false);
    setShowInsertModal(false);
  }, []);

  const handleSubmitIGN = useCallback(() => {
    if (!selectedIGN || !selectedReward || isEntryLocked) return;

    if (!APPS_SCRIPT_URL) {
      setSubmitResult({ type: "error", message: "APPS_SCRIPT_URL is not set in page.js. Deploy the Apps Script and paste the URL." });
      return;
    }

    setIsSubmitting(true);
    setIsEntryLocked(true);
    setSubmitResult(null);

    const url = `${APPS_SCRIPT_URL}?ign=${encodeURIComponent(selectedIGN)}&reward=${encodeURIComponent(selectedReward)}`;

    fetch(url, { redirect: "follow" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setIsSubmitting(false);
        if (data.success) {
          setSubmitResult({ type: "success", message: `${selectedIGN} added successfully!` });
          setTimeout(() => {
            setIsEntryLocked(false);
            setShowInsertModal(false);
            loadSheet("manual");
          }, 1800);
        } else {
          setIsEntryLocked(false);
          setSubmitResult({ type: "error", message: data.error || "An error occurred while inserting." });
        }
      })
      .catch((err) => {
        setIsSubmitting(false);
        setIsEntryLocked(false);
        setSubmitResult({ type: "error", message: `Request failed: ${err.message}. Make sure the Apps Script is deployed as "Anyone" and the URL is correct.` });
      });
  }, [isEntryLocked, selectedIGN, selectedReward, loadSheet]);

  useEffect(() => {
    loadSheet("initial");

    const interval = window.setInterval(() => {
      loadSheet("auto");
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(interval);

      if (scriptNodeRef.current) {
        scriptNodeRef.current.remove();
      }
    };
  }, [loadSheet]);

  return (
    <main className="shell">
      {showInsertModal && (
        <div className="modal-overlay" onClick={isEntryLocked ? undefined : handleCloseInsert}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Insert IGN</h2>
              <button type="button" className="modal-close" onClick={handleCloseInsert} aria-label="Close" disabled={isEntryLocked}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">IGN</label>
                {isFetchingMembers ? (
                  <div className="modal-loading">Loading members…</div>
                ) : (
                  <IGNSelect names={memberNames} value={selectedIGN} onChange={setSelectedIGN} />
                )}
              </div>
              <div className="modal-field">
                <label className="modal-label">Reward</label>
                <RewardSelect value={selectedReward} onChange={setSelectedReward} />
              </div>
              {submitResult && (
                <div className={`modal-result modal-result--${submitResult.type}`}>
                  {submitResult.message}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={handleCloseInsert} disabled={isSubmitting || isEntryLocked}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitIGN}
                disabled={!selectedIGN || !selectedReward || isSubmitting || isEntryLocked}
              >
                {isSubmitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">Live Sheet Viewer</span>
            <h1>ROOC Auction Roulette</h1>
            <p>
              A polished live table fed directly from Google Sheets. Search fast, sort any column,
              and refresh on demand without touching the source sheet.
            </p>
          </div>
          <div className="hero-stats">
            <article className="stat">
              <span className="stat-label">Visible Rows</span>
              <strong className="stat-value">{filteredRows.length}</strong>
            </article>
            <article className="stat">
              <span className="stat-label">Columns</span>
              <strong className="stat-value">{columns.length}</strong>
            </article>
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
            <span className="chip">{lastUpdated}</span>
          </div>
        </div>

        <div className={`status ${isError ? "error" : ""}`.trim()}>{status}</div>

        <div className="table-shell">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column, index) => {
                    const isSorted = sortIndex === index;
                    const indicator = isSorted ? (sortDirection === "asc" ? "↑" : "↓") : "";

                    return (
                      <th
                        key={`${column}-${index}`}
                        onClick={() => {
                          if (sortIndex === index) {
                            setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
                          } else {
                            setSortIndex(index);
                            setSortDirection("asc");
                          }
                        }}
                      >
                        {column}
                        <span className="sort-indicator">{indicator}</span>
                      </th>
                    );
                  })}
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
                      {columns.map((_, columnIndex) => (
                        <td key={`cell-${rowIndex}-${columnIndex}`}>{rowData[columnIndex] || ""}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="footer-note">
          Source: Google Sheets tab "ROOC Auction Roulette" via the public Visualization feed.
        </p>
      </section>
    </main>
  );
}

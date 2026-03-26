import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────
// THEME DEFINITIONS
// ─────────────────────────────────────────────
const THEMES = {
  spring: {
    name: "Spring Blossom",
    bg: "#fdf6f0", surface: "#fff8f3", primary: "#f9a8c9", primaryLight: "#fde8f2",
    secondary: "#a8d8a8", text: "#5a3e4b", textLight: "#9b7b88", border: "#f0d4e4",
    cellBg: "#ffffff", cellSelected: "#fde8f2", cellHighlight: "#fef3e8", cellBlock: "#fdf0f6",
    errorBg: "#ffe4e4", errorText: "#e05a5a", given: "#5a3e4b", user: "#c2557a",
    numpad: "#fde8f2", shadow: "rgba(249,168,201,0.25)", adBg: "#fef5fb", adBorder: "#f9c8e0",
    gold: "#d4a017", goldLight: "#fef8e1", goldBorder: "#f0d060",
  },
  ocean: {
    name: "Ocean Mist",
    bg: "#f0f6fd", surface: "#f5f9ff", primary: "#93c5e8", primaryLight: "#dceefa",
    secondary: "#a8c8e8", text: "#2c4a6e", textLight: "#6a8faf", border: "#c8dff2",
    cellBg: "#ffffff", cellSelected: "#dceefa", cellHighlight: "#edf5fc", cellBlock: "#f0f8ff",
    errorBg: "#ffe4e4", errorText: "#e05a5a", given: "#1e3a5a", user: "#2e7abf",
    numpad: "#dceefa", shadow: "rgba(147,197,232,0.25)", adBg: "#f0f8ff", adBorder: "#c0dfef",
    gold: "#b8860b", goldLight: "#fdf6dc", goldBorder: "#e8d080",
  },
  cloudy: {
    name: "Cloudy Grey",
    bg: "#f4f4f7", surface: "#f8f8fb", primary: "#b8b8d0", primaryLight: "#e8e8f4",
    secondary: "#c8c8e0", text: "#3a3a5a", textLight: "#7a7a9a", border: "#d8d8e8",
    cellBg: "#ffffff", cellSelected: "#e8e8f4", cellHighlight: "#f0f0f8", cellBlock: "#f5f5fa",
    errorBg: "#ffe4e4", errorText: "#d05050", given: "#2a2a4a", user: "#5a5a9a",
    numpad: "#e8e8f4", shadow: "rgba(184,184,208,0.25)", adBg: "#f5f5fa", adBorder: "#d0d0e8",
    gold: "#a07800", goldLight: "#faf4dc", goldBorder: "#d8c870",
  },
};

// ─────────────────────────────────────────────
// PERSONAL BEST — localStorage helpers
// ─────────────────────────────────────────────

const STORAGE_KEY = "sudoku_best_times_v1";

/**
 * Loads best times from localStorage.
 * Returns { easy: number|null, medium: number|null, hard: number|null }
 * A null value means no record exists for that difficulty yet.
 */
function loadBestTimes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { easy: null, medium: null, hard: null };
    const parsed = JSON.parse(raw);
    return {
      easy:   typeof parsed.easy   === "number" ? parsed.easy   : null,
      medium: typeof parsed.medium === "number" ? parsed.medium : null,
      hard:   typeof parsed.hard   === "number" ? parsed.hard   : null,
    };
  } catch {
    return { easy: null, medium: null, hard: null };
  }
}

/** Persists best times object to localStorage. */
function saveBestTimes(times) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(times)); } catch { /* ignore quota errors */ }
}

// ─────────────────────────────────────────────
// SUDOKU GENERATION LOGIC
// ─────────────────────────────────────────────

/** Checks whether placing `num` at (row, col) is valid under standard Sudoku rules. */
function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num) return false;
    if (board[i][col] === num) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if (board[boxRow + r][boxCol + c] === num) return false;
  return true;
}

/**
 * Recursively fills `board` using a shuffled backtracking algorithm
 * to produce a fully solved, randomized Sudoku grid.
 */
function fillBoard(board) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of nums) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (fillBoard(board)) return true;
            board[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

/** Fisher-Yates shuffle — returns a new array. */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generates a puzzle by starting from a full solution and removing cells
 * according to difficulty. Returns both the puzzle mask and the full solution.
 */
function generatePuzzle(difficulty) {
  const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillBoard(solution);
  const removeCount = { easy: 36, medium: 46, hard: 54 }[difficulty] ?? 46;
  const puzzle = solution.map((r) => [...r]);
  const cells = shuffle([...Array(81).keys()]);
  let removed = 0;
  for (const idx of cells) {
    if (removed >= removeCount) break;
    puzzle[Math.floor(idx / 9)][idx % 9] = 0;
    removed++;
  }
  return { puzzle, solution };
}

// ─────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────

/** Returns a Set of "row-col" strings for every conflicting cell. */
function getConflicts(board) {
  const conflicts = new Set();
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const val = board[row][col];
      if (!val) continue;
      for (let i = 0; i < 9; i++) {
        if (i !== col && board[row][i] === val) { conflicts.add(`${row}-${col}`); conflicts.add(`${row}-${i}`); }
        if (i !== row && board[i][col] === val) { conflicts.add(`${row}-${col}`); conflicts.add(`${i}-${col}`); }
      }
      const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          const rr = br + r, cc = bc + c;
          if ((rr !== row || cc !== col) && board[rr][cc] === val) {
            conflicts.add(`${row}-${col}`); conflicts.add(`${rr}-${cc}`);
          }
        }
    }
  }
  return conflicts;
}

function isSolved(board, solution) {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] !== solution[r][c]) return false;
  return true;
}

/** Formats seconds as MM:SS. Returns "--:--" for null/undefined. */
function formatTime(s) {
  if (s === null || s === undefined) return "--:--";
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function SudokuApp() {
  const [themeKey, setThemeKey] = useState("spring");
  const theme = THEMES[themeKey];

  const [difficulty, setDifficulty] = useState("medium");
  const [puzzle, setPuzzle] = useState(null);
  const [solution, setSolution] = useState(null);
  const [board, setBoard] = useState(null);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [conflicts, setConflicts] = useState(new Set());
  const [solved, setSolved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);

  // ── Timer state ──────────────────────────────────────────────────────────
  const [timer, setTimer] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false); // starts on first move
  const [paused, setPaused] = useState(false);
  const [finalTime, setFinalTime] = useState(0);
  const timerRef = useRef(null);
  const timerVal = useRef(0); // sync ref for capturing finish time precisely

  // ── Personal bests: loaded from localStorage on mount ────────────────────
  const [bestTimes, setBestTimes] = useState(() => loadBestTimes());

  useEffect(() => { timerVal.current = timer; }, [timer]);

  const startGame = useCallback((diff = difficulty) => {
    const { puzzle: p, solution: s } = generatePuzzle(diff);
    setPuzzle(p);
    setSolution(s);
    setBoard(p.map((r) => [...r]));
    setHistory([]);
    setSelected(null);
    setConflicts(new Set());
    setSolved(false);
    setShowCongrats(false);
    setIsNewRecord(false);
    setTimer(0);
    setTimerStarted(false);
    setPaused(false);
    setFinalTime(0);
  }, [difficulty]);

  useEffect(() => { startGame(); }, []);

  // Timer ticks only when: started AND not paused AND not solved
  useEffect(() => {
    clearInterval(timerRef.current);
    if (timerStarted && !paused && !solved) {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [timerStarted, paused, solved]);

  const togglePause = () => {
    if (!timerStarted || solved) return;
    setPaused((p) => !p);
    setSelected(null);
  };

  // ── Enter number — also handles personal best logic on completion ─────────
  const enterNumber = useCallback((num) => {
    if (!selected || !board || !puzzle || paused) return;
    const { row, col } = selected;
    if (puzzle[row][col] !== 0) return;

    // Lazily start the timer on the first move
    if (!timerStarted) setTimerStarted(true);

    setHistory((h) => [...h, board.map((r) => [...r])]);
    const newBoard = board.map((r) => [...r]);
    newBoard[row][col] = num;
    setBoard(newBoard);

    const newConflicts = getConflicts(newBoard);
    setConflicts(newConflicts);

    if (newConflicts.size === 0 && isSolved(newBoard, solution)) {
      const elapsed = timerVal.current;
      setSolved(true);
      setFinalTime(elapsed);

      // Compare with stored best and update if improved
      setBestTimes((prev) => {
        const prevBest = prev[difficulty];
        const newRecord = prevBest === null || elapsed < prevBest;
        setIsNewRecord(newRecord);
        const updated = { ...prev, [difficulty]: newRecord ? elapsed : prevBest };
        saveBestTimes(updated); // persist immediately
        return updated;
      });

      setTimeout(() => setShowCongrats(true), 300);
    }
  }, [selected, board, puzzle, solution, timerStarted, paused, difficulty]);

  const clearCell = useCallback(() => enterNumber(0), [enterNumber]);

  const undo = useCallback(() => {
    if (!history.length || paused) return;
    const prev = history[history.length - 1];
    setBoard(prev);
    setHistory((h) => h.slice(0, -1));
    setConflicts(getConflicts(prev));
  }, [history, paused]);

  useEffect(() => {
    const handler = (e) => {
      if (paused) return;
      if (e.key >= "1" && e.key <= "9") enterNumber(Number(e.key));
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") clearCell();
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) undo();
      if (!selected) return;
      const { row, col } = selected;
      if (e.key === "ArrowUp" && row > 0) setSelected({ row: row - 1, col });
      if (e.key === "ArrowDown" && row < 8) setSelected({ row: row + 1, col });
      if (e.key === "ArrowLeft" && col > 0) setSelected({ row, col: col - 1 });
      if (e.key === "ArrowRight" && col < 8) setSelected({ row, col: col + 1 });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enterNumber, clearCell, undo, selected, paused]);

  if (!board) return <div style={{ background: theme.bg, minHeight: "100vh" }} />;

  const highlightSet = new Set();
  if (selected && !paused) {
    const { row, col } = selected;
    for (let i = 0; i < 9; i++) {
      highlightSet.add(`${row}-${i}`);
      highlightSet.add(`${i}-${col}`);
    }
    const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        highlightSet.add(`${br + r}-${bc + c}`);
  }

  const renderCell = (row, col) => {
    const key = `${row}-${col}`;
    const val = board[row][col];
    const isGiven = puzzle[row][col] !== 0;
    const isSel = !paused && selected?.row === row && selected?.col === col;
    const isHl = !paused && highlightSet.has(key);
    const isConflict = !paused && conflicts.has(key);
    const isBlock = (Math.floor(row / 3) + Math.floor(col / 3)) % 2 === 0;
    const borderRight = (col + 1) % 3 === 0 && col !== 8 ? `2.5px solid ${theme.primary}` : `1px solid ${theme.border}`;
    const borderBottom = (row + 1) % 3 === 0 && row !== 8 ? `2.5px solid ${theme.primary}` : `1px solid ${theme.border}`;

    let bg = isBlock ? theme.cellBlock : theme.cellBg;
    if (isHl) bg = theme.cellHighlight;
    if (isSel) bg = theme.cellSelected;
    if (isConflict) bg = theme.errorBg;

    return (
      <div key={key} onClick={() => { if (!paused) setSelected({ row, col }); }}
        style={{ background: bg, borderRight, borderBottom, display: "flex", alignItems: "center", justifyContent: "center", cursor: paused ? "default" : isGiven ? "default" : "pointer", transition: "background 0.1s", userSelect: "none", WebkitTapHighlightColor: "transparent" }}>
        {!paused && val !== 0 && (
          <span style={{ fontSize: "clamp(13px,3.5vw,22px)", fontWeight: isGiven ? 700 : 500, color: isConflict ? theme.errorText : isGiven ? theme.given : theme.user, lineHeight: 1 }}>
            {val}
          </span>
        )}
      </div>
    );
  };

  const timerDisplay = timerStarted ? formatTime(timer) : "--:--";
  const currentBest = bestTimes[difficulty];
  const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const btn = { fontFamily: "'Georgia', serif", cursor: "pointer", transition: "all 0.15s" };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: "'Georgia', serif", color: theme.text, display: "flex", flexDirection: "column", alignItems: "center" }}>

      {/* ── HEADER ── */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 12px 8px" }}>
        <div style={{ fontSize: 24, fontWeight: "bold", letterSpacing: 2 }}>sudoku</div>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", background: theme.primaryLight, border: `1px solid ${theme.border}`, borderRadius: 20, overflow: "hidden" }}>
            <span style={{ padding: "4px 12px", fontSize: 13, fontVariantNumeric: "tabular-nums", color: theme.text, minWidth: 52, textAlign: "center" }}>{timerDisplay}</span>
            {timerStarted && !solved && (
              <button onClick={togglePause} title={paused ? "Resume" : "Pause"} style={{ ...btn, background: "transparent", border: "none", borderLeft: `1px solid ${theme.border}`, padding: "4px 10px", fontSize: 12, color: theme.textLight, display: "flex", alignItems: "center", lineHeight: 1 }}>
                {paused ? "▶" : "⏸"}
              </button>
            )}
          </div>
          <button style={{ ...btn, background: theme.primaryLight, border: `1px solid ${theme.border}`, borderRadius: 8, width: 32, height: 32, fontSize: 15, color: theme.text, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowSettings(true)}>⚙️</button>
        </div>
      </div>

      {/* ── PERSONAL BEST STRIP ── */}
      {/* Shows the best time for the currently active difficulty level */}
      <div style={{ width: "100%", maxWidth: 420, padding: "0 12px 8px", display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: currentBest !== null ? theme.goldLight : theme.surface, border: `1px solid ${currentBest !== null ? theme.goldBorder : theme.border}`, borderRadius: 20, padding: "4px 16px", transition: "background 0.3s, border 0.3s" }}>
          <span style={{ fontSize: 13, lineHeight: 1 }}>🏆</span>
          <span style={{ fontSize: 11, color: theme.textLight, letterSpacing: 0.5, textTransform: "uppercase" }}>Best · {diffLabel}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: currentBest !== null ? theme.gold : theme.textLight, fontVariantNumeric: "tabular-nums", letterSpacing: 0.5 }}>
            {formatTime(currentBest)}
          </span>
        </div>
      </div>

      {/* ── DIFFICULTY + NEW GAME ── */}
      <div style={{ display: "flex", gap: 6, padding: "0 12px 8px", width: "100%", maxWidth: 420, justifyContent: "center", flexWrap: "wrap" }}>
        {["easy", "medium", "hard"].map((d) => (
          <button key={d} style={{ ...btn, background: difficulty === d ? theme.primary : theme.surface, color: difficulty === d ? "#fff" : theme.textLight, border: `1px solid ${difficulty === d ? theme.primary : theme.border}`, borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: difficulty === d ? 600 : 400 }}
            onClick={() => { setDifficulty(d); startGame(d); }}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
        <button style={{ ...btn, background: theme.secondary, color: "#fff", border: "none", borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 600 }} onClick={() => startGame()}>New Game</button>
      </div>

      {/* ── GRID ── */}
      <div style={{ padding: "4px 12px", width: "100%", maxWidth: 420, display: "flex", justifyContent: "center", position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", border: `2.5px solid ${theme.primary}`, borderRadius: 12, overflow: "hidden", boxShadow: `0 8px 28px ${theme.shadow}`, width: "100%", maxWidth: 380, aspectRatio: "1/1" }}>
          {Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => renderCell(r, c)))}
        </div>
        {paused && (
          <div onClick={togglePause} style={{ position: "absolute", inset: 0, margin: "4px 12px", maxWidth: 380, left: "50%", transform: "translateX(-50%)", borderRadius: 12, background: "rgba(255,255,255,0.82)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 5, border: `2px dashed ${theme.border}` }}>
            <div style={{ fontSize: 32, opacity: 0.45, marginBottom: 10 }}>⏸</div>
            <div style={{ fontSize: 13, color: theme.textLight, letterSpacing: 1 }}>Tap to resume</div>
          </div>
        )}
      </div>

      {/* ── NUMBER PAD ── */}
      <div style={{ width: "100%", maxWidth: 420, padding: "8px 12px", opacity: paused ? 0.4 : 1, pointerEvents: paused ? "none" : "auto", transition: "opacity 0.2s" }}>
        <div style={{ background: theme.numpad, borderRadius: 14, padding: "12px 8px", border: `1px solid ${theme.border}` }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} style={{ ...btn, flex: 1, maxWidth: 42, aspectRatio: "1", background: theme.cellBg, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 18, fontWeight: 600, color: theme.user, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => enterNumber(n)}>{n}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
            {[6, 7, 8, 9].map((n) => (
              <button key={n} style={{ ...btn, flex: 1, maxWidth: 42, aspectRatio: "1", background: theme.cellBg, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 18, fontWeight: 600, color: theme.user, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => enterNumber(n)}>{n}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button style={{ ...btn, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "7px 16px", fontSize: 13, color: theme.textLight }} onClick={clearCell}>✕ Clear</button>
            <button style={{ ...btn, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "7px 16px", fontSize: 13, color: history.length ? theme.textLight : "#ccc" }} onClick={undo} disabled={!history.length}>↩ Undo</button>
          </div>
        </div>
      </div>

      {/* ── AD PLACEHOLDER ── */}
      <div style={{ width: "100%", maxWidth: 420, margin: "6px 12px 0", background: theme.adBg, border: `1px dashed ${theme.adBorder}`, borderRadius: 10, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: theme.textLight, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
        📢 Advertisement
      </div>
      <div style={{ height: 24 }} />

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowSettings(false)}>
          <div style={{ background: theme.surface, borderRadius: 20, padding: "24px 20px", maxWidth: 300, width: "100%", border: `1px solid ${theme.border}`, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Settings</div>
            <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>Color Theme</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {Object.entries(THEMES).map(([key, th]) => (
                <button key={key} onClick={() => setThemeKey(key)} style={{ ...btn, background: th.primaryLight, border: `2px solid ${themeKey === key ? th.primary : th.border}`, borderRadius: 10, padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: th.text }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: th.primary, flexShrink: 0, border: `1.5px solid ${th.border}`, display: "inline-block" }} />
                  {th.name}
                  {themeKey === key && <span style={{ marginLeft: "auto", color: th.primary, fontSize: 16 }}>✓</span>}
                </button>
              ))}
            </div>
            {/* All-difficulty best times summary */}
            <div style={{ background: theme.goldLight, border: `1px solid ${theme.goldBorder}`, borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: theme.textLight, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Personal Bests</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                {["easy", "medium", "hard"].map((d) => (
                  <div key={d} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: theme.textLight, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{d.charAt(0).toUpperCase() + d.slice(1)}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: bestTimes[d] !== null ? theme.gold : theme.textLight, fontVariantNumeric: "tabular-nums" }}>{formatTime(bestTimes[d])}</div>
                  </div>
                ))}
              </div>
            </div>
            <button style={{ ...btn, background: theme.primary, color: "#fff", border: "none", borderRadius: 12, padding: "10px 32px", fontSize: 14, fontWeight: 600, width: "100%" }} onClick={() => setShowSettings(false)}>Done</button>
          </div>
        </div>
      )}

      {/* ── CONGRATULATIONS MODAL ── */}
      {showCongrats && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: theme.surface, borderRadius: 24, padding: "28px 24px", maxWidth: 310, width: "100%", border: `1px solid ${isNewRecord ? theme.goldBorder : theme.border}`, textAlign: "center", animation: "fadeUp 0.35s ease", boxShadow: isNewRecord ? `0 0 0 3px ${theme.goldLight}` : undefined }}>

            {/* Trophy or celebration icon */}
            {isNewRecord
              ? <div style={{ fontSize: 40, marginBottom: 6 }}>🏆</div>
              : <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
            }

            <div style={{ fontSize: 21, fontWeight: 700, marginBottom: 4, color: theme.text }}>
              {isNewRecord ? "New Record!" : "Puzzle Solved!"}
            </div>
            <div style={{ color: theme.textLight, fontSize: 13, marginBottom: 16 }}>{diffLabel} difficulty</div>

            {/* Time card — gold tint on new record */}
            <div style={{ background: isNewRecord ? theme.goldLight : theme.primaryLight, border: `1px solid ${isNewRecord ? theme.goldBorder : theme.border}`, borderRadius: 14, padding: "12px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: theme.textLight, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
                {isNewRecord ? "New Best Time" : "Your Time"}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: isNewRecord ? theme.gold : theme.text, fontVariantNumeric: "tabular-nums", letterSpacing: 2 }}>
                {formatTime(finalTime)}
              </div>
            </div>

            {/* Previous best shown when not a new record but one exists */}
            {!isNewRecord && bestTimes[difficulty] !== null && (
              <div style={{ fontSize: 12, color: theme.textLight, marginBottom: 14 }}>
                Best: <span style={{ fontWeight: 600, color: theme.gold }}>{formatTime(bestTimes[difficulty])}</span>
              </div>
            )}

            <button style={{ ...btn, background: isNewRecord ? theme.gold : theme.primary, color: "#fff", border: "none", borderRadius: 14, padding: "11px 0", fontSize: 15, fontWeight: 600, width: "100%", marginBottom: 8 }} onClick={() => startGame()}>Play Again</button>
            <button style={{ ...btn, background: "transparent", color: theme.textLight, border: "none", padding: "8px 0", fontSize: 13, width: "100%" }} onClick={() => setShowCongrats(false)}>View Board</button>
          </div>
          <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </div>
      )}
    </div>
  );
}

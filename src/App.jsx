import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCw,
  Trash2,
  Save,
  FolderOpen,
  Train,
  TrafficCone,
  Turtle,
  GitBranch,
  Square,
  Download,
  Upload,
  Undo2,
  Redo2,
} from "lucide-react";

const ROWS = 16;
const COLS = 24;
const CELL = 34;

const DIRS = {
  N: { dr: -1, dc: 0, opposite: "S" },
  E: { dr: 0, dc: 1, opposite: "W" },
  S: { dr: 1, dc: 0, opposite: "N" },
  W: { dr: 0, dc: -1, opposite: "E" },
};

const PIECES = {
  empty: { label: "Vide", rotations: ["empty"] },
  straight: { label: "Rail droit", rotations: ["straight-h", "straight-v"] },
  curve: { label: "Courbe", rotations: ["curve-ne", "curve-se", "curve-sw", "curve-nw"] },
  cross: { label: "Croisement", rotations: ["cross"] },
  switch: { label: "Aiguillage", rotations: ["switch-e-main", "switch-s-main", "switch-w-main", "switch-n-main"] },
  signal: { label: "Feu", rotations: ["signal-h", "signal-v"] },
  slow: { label: "Ralentissement", rotations: ["slow-h", "slow-v"] },
  spawn: { label: "Départ", rotations: ["spawn-e", "spawn-s", "spawn-w", "spawn-n"] },
};

const TOOLBAR = [
  { key: "straight", icon: Train },
  { key: "curve", icon: GitBranch },
  { key: "switch", icon: GitBranch },
  { key: "cross", icon: Square },
  { key: "signal", icon: TrafficCone },
  { key: "slow", icon: Turtle },
  { key: "spawn", icon: Train },
  { key: "erase", icon: Trash2 },
];

function makeCell() {
  return {
    type: "empty",
    rotationIndex: 0,
    variant: "empty",
    signalOpen: false,
    switchState: "main",
  };
}

function makeGrid() {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, makeCell));
}

function cloneGrid(grid) {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function nextVariant(type, rotationIndex, switchState = "main") {
  const piece = PIECES[type] || PIECES.empty;
  const base = piece.rotations[rotationIndex % piece.rotations.length];
  if (type !== "switch") return base;
  return base.replace(/main|branch/, switchState);
}

function normalizeSwitchVariant(variant, switchState) {
  if (!variant.startsWith("switch-")) return variant;
  return variant.replace(/main|branch/, switchState);
}

function getConnections(cell) {
  switch (cell.variant) {
    case "straight-h":
    case "signal-h":
    case "slow-h":
      return ["E", "W"];
    case "straight-v":
    case "signal-v":
    case "slow-v":
      return ["N", "S"];
    case "curve-ne":
      return ["N", "E"];
    case "curve-se":
      return ["S", "E"];
    case "curve-sw":
      return ["S", "W"];
    case "curve-nw":
      return ["N", "W"];
    case "cross":
      return ["N", "E", "S", "W"];
    case "switch-e-main":
      return ["W", "E"];
    case "switch-e-branch":
      return ["W", "N"];
    case "switch-s-main":
      return ["N", "S"];
    case "switch-s-branch":
      return ["N", "E"];
    case "switch-w-main":
      return ["E", "W"];
    case "switch-w-branch":
      return ["E", "S"];
    case "switch-n-main":
      return ["S", "N"];
    case "switch-n-branch":
      return ["S", "W"];
    case "spawn-e":
      return ["E"];
    case "spawn-s":
      return ["S"];
    case "spawn-w":
      return ["W"];
    case "spawn-n":
      return ["N"];
    default:
      return [];
  }
}

function isTrack(cell) {
  return cell.type !== "empty";
}

function getCellCenter(row, col) {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

function canConnect(fromCell, dir, toCell) {
  return getConnections(fromCell).includes(dir) && getConnections(toCell).includes(DIRS[dir].opposite);
}

function findSpawn(grid) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].type === "spawn") return { row: r, col: c, cell: grid[r][c] };
    }
  }
  return null;
}

function chooseExitDirection(cell, enterFrom) {
  const conns = getConnections(cell);
  if (cell.type === "spawn") return conns[0] || null;
  if (!enterFrom) return conns[0] || null;

  const incoming = DIRS[enterFrom].opposite;
  const remaining = conns.filter((d) => d !== incoming);

  if (cell.variant === "cross") {
    if (conns.includes(enterFrom)) return enterFrom;
    return remaining[0] || null;
  }

  return remaining[0] || null;
}

function computeNextStep(grid, row, col, enterFrom) {
  const cell = grid[row]?.[col];
  if (!cell || !isTrack(cell)) return null;
  if (cell.type === "signal" && !cell.signalOpen) return null;

  const exitDir = chooseExitDirection(cell, enterFrom);
  if (!exitDir) return null;

  const nr = row + DIRS[exitDir].dr;
  const nc = col + DIRS[exitDir].dc;
  const nextCell = grid[nr]?.[nc];
  if (!nextCell || !canConnect(cell, exitDir, nextCell)) return null;

  return { nextRow: nr, nextCol: nc, exitDir };
}

function cellDelay(cell, base) {
  if (!cell) return base;
  if (cell.type === "slow") return Math.round(base * 1.7);
  return base;
}

function drawTrack(cell) {
  const rail = "absolute bg-slate-700 rounded-full";
  const thin = 6;
  const curveStyle = { width: 28, height: 28, borderWidth: 6 };

  switch (cell.variant) {
    case "straight-h":
    case "signal-h":
    case "slow-h":
      return <div className={rail} style={{ left: 0, right: 0, top: CELL / 2 - thin / 2, height: thin }} />;
    case "straight-v":
    case "signal-v":
    case "slow-v":
      return <div className={rail} style={{ top: 0, bottom: 0, left: CELL / 2 - thin / 2, width: thin }} />;
    case "curve-ne":
      return <div className="absolute border-slate-700 rounded-full" style={{ ...curveStyle, borderLeftColor: "transparent", borderBottomColor: "transparent", left: CELL / 2 - 3, top: 3 }} />;
    case "curve-se":
      return <div className="absolute border-slate-700 rounded-full" style={{ ...curveStyle, borderLeftColor: "transparent", borderTopColor: "transparent", left: CELL / 2 - 3, top: CELL / 2 - 3 }} />;
    case "curve-sw":
      return <div className="absolute border-slate-700 rounded-full" style={{ ...curveStyle, borderRightColor: "transparent", borderTopColor: "transparent", left: 3, top: CELL / 2 - 3 }} />;
    case "curve-nw":
      return <div className="absolute border-slate-700 rounded-full" style={{ ...curveStyle, borderRightColor: "transparent", borderBottomColor: "transparent", left: 3, top: 3 }} />;
    case "cross":
      return (
        <>
          <div className={rail} style={{ left: 0, right: 0, top: CELL / 2 - thin / 2, height: thin }} />
          <div className={rail} style={{ top: 0, bottom: 0, left: CELL / 2 - thin / 2, width: thin }} />
        </>
      );
    case "switch-e-main":
      return <div className={rail} style={{ left: 0, right: 0, top: CELL / 2 - thin / 2, height: thin }} />;
    case "switch-e-branch":
      return (
        <>
          <div className={rail} style={{ left: 0, width: CELL / 2 + 2, top: CELL / 2 - thin / 2, height: thin }} />
          <div className="absolute border-slate-700 rounded-full" style={{ ...curveStyle, borderLeftColor: "transparent", borderBottomColor: "transparent", left: CELL / 2 - 3, top: 3 }} />
        </>
      );
    case "switch-s-main":
      return <div className={rail} style={{ top: 0, bottom: 0, left: CELL / 2 - thin / 2, width: thin }} />;
    case "switch-s-branch":
      return (
        <>
          <div className={rail} style={{ top: 0, height: CELL / 2 + 2, left: CELL / 2 - thin / 2, width: thin }} />
          <div className="absolute border-slate-700 rounded-full" style={{ ...curveStyle, borderLeftColor: "transparent", borderTopColor: "transparent", left: CELL / 2 - 3, top: CELL / 2 - 3 }} />
        </>
      );
    case "switch-w-main":
      return <div className={rail} style={{ left: 0, right: 0, top: CELL / 2 - thin / 2, height: thin }} />;
    case "switch-w-branch":
      return (
        <>
          <div className={rail} style={{ right: 0, width: CELL / 2 + 2, top: CELL / 2 - thin / 2, height: thin }} />
          <div className="absolute border-slate-700 rounded-full" style={{ ...curveStyle, borderRightColor: "transparent", borderTopColor: "transparent", left: 3, top: CELL / 2 - 3 }} />
        </>
      );
    case "switch-n-main":
      return <div className={rail} style={{ top: 0, bottom: 0, left: CELL / 2 - thin / 2, width: thin }} />;
    case "switch-n-branch":
      return (
        <>
          <div className={rail} style={{ bottom: 0, height: CELL / 2 + 2, left: CELL / 2 - thin / 2, width: thin }} />
          <div className="absolute border-slate-700 rounded-full" style={{ ...curveStyle, borderRightColor: "transparent", borderBottomColor: "transparent", left: 3, top: 3 }} />
        </>
      );
    case "spawn-e":
    case "spawn-w":
      return <div className={rail} style={{ left: 0, right: 0, top: CELL / 2 - thin / 2, height: thin }} />;
    case "spawn-n":
    case "spawn-s":
      return <div className={rail} style={{ top: 0, bottom: 0, left: CELL / 2 - thin / 2, width: thin }} />;
    default:
      return null;
  }
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [grid, setGrid] = useState(makeGrid);
  const [selectedTool, setSelectedTool] = useState("straight");
  const [rotation, setRotation] = useState(0);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Mode édition");
  const [baseSpeed, setBaseSpeed] = useState(650);
  const [trainState, setTrainState] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  const spawn = useMemo(() => findSpawn(grid), [grid]);
  const boardW = COLS * CELL;
  const boardH = ROWS * CELL;

  const pushHistory = (current) => {
    setHistory((prev) => [...prev.slice(-39), cloneGrid(current)]);
    setFuture([]);
  };

  const applyGridChange = (fn) => {
    setGrid((prev) => {
      const next = cloneGrid(prev);
      fn(next);
      pushHistory(prev);
      return next;
    });
  };

  const placePiece = (row, col) => {
    applyGridChange((next) => {
      const current = next[row][col];
      if (selectedTool === "erase") {
        next[row][col] = makeCell();
        return;
      }
      if (selectedTool === "signal" && current.type === "signal") {
        current.signalOpen = !current.signalOpen;
        return;
      }
      if (selectedTool === "switch" && current.type === "switch") {
        current.switchState = current.switchState === "main" ? "branch" : "main";
        current.variant = normalizeSwitchVariant(current.variant, current.switchState);
        return;
      }

      const piece = PIECES[selectedTool];
      const switchState = selectedTool === "switch" ? "main" : "main";
      next[row][col] = {
        type: selectedTool,
        rotationIndex: rotation % piece.rotations.length,
        variant: nextVariant(selectedTool, rotation, switchState),
        signalOpen: selectedTool === "signal" ? false : false,
        switchState,
      };
    });
  };

  const undo = () => {
    if (!history.length) return;
    setFuture((prev) => [cloneGrid(grid), ...prev.slice(0, 39)]);
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setGrid(cloneGrid(previous));
    setRunning(false);
    setTrainState(null);
    setStatus("Annulation effectuée");
  };

  const redo = () => {
    if (!future.length) return;
    setHistory((prev) => [...prev.slice(-39), cloneGrid(grid)]);
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setGrid(cloneGrid(next));
    setRunning(false);
    setTrainState(null);
    setStatus("Rétablissement effectué");
  };

  const clearBoard = () => {
    pushHistory(grid);
    setGrid(makeGrid());
    setRunning(false);
    setTrainState(null);
    setStatus("Plateau vidé");
  };

  const saveLayout = () => {
    localStorage.setItem("mini-rail-layout-v3", JSON.stringify(grid));
    setStatus("Circuit sauvegardé sur cet appareil");
  };

  const loadLayout = () => {
    const raw = localStorage.getItem("mini-rail-layout-v3");
    if (!raw) {
      setStatus("Aucune sauvegarde locale trouvée");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      pushHistory(grid);
      setGrid(parsed);
      setRunning(false);
      setTrainState(null);
      setStatus("Circuit chargé");
    } catch {
      setStatus("Sauvegarde invalide");
    }
  };

  const exportLayout = () => downloadJson("mini-rail-v3-layout.json", grid);

  const importLayout = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        pushHistory(grid);
        setGrid(parsed);
        setRunning(false);
        setTrainState(null);
        setStatus("Circuit importé");
      } catch {
        setStatus("Import impossible : JSON invalide");
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (!spawn && !trainState) {
      setRunning(false);
      setStatus("Ajoute un point de départ");
      return;
    }

    const current = trainState || {
      row: spawn.row,
      col: spawn.col,
      enterFrom: null,
      x: getCellCenter(spawn.row, spawn.col).x,
      y: getCellCenter(spawn.row, spawn.col).y,
    };

    const cell = grid[current.row]?.[current.col];
    const step = computeNextStep(grid, current.row, current.col, current.enterFrom);

    if (!step) {
      setRunning(false);
      setStatus(cell?.type === "signal" && !cell.signalOpen ? "Train arrêté au feu rouge" : "Train arrêté : voie incomplète ou non connectée");
      return;
    }

    const delay = cellDelay(cell, baseSpeed);
    timerRef.current = setTimeout(() => {
      const nextCenter = getCellCenter(step.nextRow, step.nextCol);
      setTrainState({
        row: step.nextRow,
        col: step.nextCol,
        enterFrom: step.exitDir,
        x: nextCenter.x,
        y: nextCenter.y,
      });
      setStatus("Simulation en cours");
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [running, trainState, grid, spawn, baseSpeed]);

  const previewVariant = nextVariant(selectedTool === "erase" ? "empty" : selectedTool, rotation);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-3 md:p-4">
      <div className="max-w-7xl mx-auto grid gap-4 xl:grid-cols-[360px_1fr]">
        <aside className="bg-white rounded-[28px] shadow-sm p-4 space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mini Rail Builder V3</h1>
            <p className="text-sm text-slate-600 mt-1">Une base plus proche de l’esprit d’un éditeur ferroviaire rétro : réseau libre, signaux, aiguillages et export du plan.</p>
          </div>

          <div className="rounded-3xl border border-slate-200 p-3">
            <div className="text-sm font-semibold mb-2">Palette</div>
            <div className="grid grid-cols-4 gap-2">
              {TOOLBAR.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSelectedTool(key)}
                  className={`rounded-2xl border p-3 flex flex-col items-center gap-1 text-[11px] ${selectedTool === key ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200"}`}
                >
                  <Icon size={18} />
                  <span>{key === "erase" ? "Effacer" : PIECES[key].label}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={() => setRotation((r) => r + 1)} className="rounded-2xl bg-slate-900 text-white px-3 py-3 flex items-center justify-center gap-2">
                <RotateCw size={16} /> Rotation
              </button>
              <div className="rounded-2xl bg-slate-100 px-3 py-3 text-xs text-slate-700 flex items-center justify-center">{selectedTool === "erase" ? "Gomme" : previewVariant}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-3">
            <div className="text-sm font-semibold mb-2">Commandes</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setRunning((v) => !v)} className="rounded-2xl bg-emerald-600 text-white px-3 py-3 flex items-center justify-center gap-2">
                {running ? <Pause size={16} /> : <Play size={16} />} {running ? "Pause" : "Lancer"}
              </button>
              <button onClick={() => { setRunning(false); setTrainState(null); setStatus("Train réinitialisé"); }} className="rounded-2xl bg-slate-800 text-white px-3 py-3">Reset train</button>
              <button onClick={undo} className="rounded-2xl bg-white border border-slate-200 px-3 py-3 flex items-center justify-center gap-2"><Undo2 size={16} /> Undo</button>
              <button onClick={redo} className="rounded-2xl bg-white border border-slate-200 px-3 py-3 flex items-center justify-center gap-2"><Redo2 size={16} /> Redo</button>
            </div>
            <label className="block mt-3">
              <span className="text-xs text-slate-600">Vitesse globale</span>
              <input type="range" min="220" max="1000" step="20" value={baseSpeed} onChange={(e) => setBaseSpeed(Number(e.target.value))} className="w-full mt-2" />
            </label>
          </div>

          <div className="rounded-3xl border border-slate-200 p-3">
            <div className="text-sm font-semibold mb-2">Fichiers</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={saveLayout} className="rounded-2xl bg-white border border-slate-200 px-3 py-3 flex items-center justify-center gap-2"><Save size={16} /> Sauver</button>
              <button onClick={loadLayout} className="rounded-2xl bg-white border border-slate-200 px-3 py-3 flex items-center justify-center gap-2"><FolderOpen size={16} /> Charger</button>
              <button onClick={exportLayout} className="rounded-2xl bg-white border border-slate-200 px-3 py-3 flex items-center justify-center gap-2"><Download size={16} /> Export</button>
              <button onClick={() => fileInputRef.current?.click()} className="rounded-2xl bg-white border border-slate-200 px-3 py-3 flex items-center justify-center gap-2"><Upload size={16} /> Import</button>
              <button onClick={clearBoard} className="col-span-2 rounded-2xl bg-red-50 text-red-700 border border-red-200 px-3 py-3 flex items-center justify-center gap-2"><Trash2 size={16} /> Vider le plateau</button>
            </div>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={importLayout} />
          </div>

          <div className="rounded-3xl bg-slate-50 p-3 text-sm text-slate-700">
            <div className="font-semibold">État</div>
            <p className="mt-1">{status}</p>
            <ul className="mt-3 text-xs text-slate-600 space-y-1">
              <li>• Retape sur un feu pour basculer rouge / vert.</li>
              <li>• Retape sur un aiguillage pour basculer voie principale / déviée.</li>
              <li>• Les ralentissements allongent le temps de traversée.</li>
              <li>• Sauvegarde locale + export JSON pour partager un circuit.</li>
            </ul>
          </div>
        </aside>

        <main className="bg-white rounded-[28px] shadow-sm p-3 overflow-auto">
          <div
            className="min-w-max rounded-[24px] relative bg-[linear-gradient(90deg,#e2e8f0_1px,transparent_1px),linear-gradient(#e2e8f0_1px,transparent_1px)]"
            style={{ width: boardW, height: boardH, backgroundSize: `${CELL}px ${CELL}px` }}
          >
            {grid.map((row, r) => row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                onClick={() => placePiece(r, c)}
                className="absolute hover:bg-sky-50/50 active:bg-sky-100/70 border border-transparent hover:border-sky-300"
                style={{ left: c * CELL, top: r * CELL, width: CELL, height: CELL }}
              >
                {drawTrack(cell)}
                {cell.type === "signal" && <div className={`absolute w-2.5 h-2.5 rounded-full ${cell.signalOpen ? "bg-emerald-500" : "bg-red-500"}`} style={{ right: 4, top: 4 }} />}
                {cell.type === "slow" && <div className="absolute text-[8px] font-bold text-amber-700 bg-amber-100 rounded px-1" style={{ left: 3, bottom: 3 }}>SLOW</div>}
                {cell.type === "spawn" && <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-sky-700">START</div>}
                {cell.type === "switch" && <div className="absolute text-[8px] font-bold text-violet-700 bg-violet-100 rounded px-1" style={{ left: 3, top: 3 }}>{cell.switchState === "main" ? "MAIN" : "BR"}</div>}
              </button>
            ))}

            {trainState && (
              <div
                className="absolute pointer-events-none transition-all ease-linear"
                style={{ left: trainState.x - 11, top: trainState.y - 11, width: 22, height: 22, transitionDuration: `${Math.max(160, baseSpeed * 0.85)}ms` }}
              >
                <div className="w-[22px] h-[22px] rounded-md bg-blue-600 border-2 border-white shadow-lg" />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
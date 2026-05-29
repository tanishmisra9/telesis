import { useState } from "react";
import { useSessionStore } from "../store/sessionStore";
import type { SessionSelection } from "../api/types";

const YEARS = Array.from({ length: 9 }, (_, i) => 2018 + i);
const ROUNDS = Array.from({ length: 24 }, (_, i) => i + 1);
const SESSION_TYPES = ["Q", "SQ", "S", "R"] as const;

const DEFAULT_YEAR = 2024;
const DEFAULT_ROUND = 1;
const DEFAULT_SESSION = "R";

export function SessionPicker() {
  const loadSession = useSessionStore((s) => s.loadSession);
  const paceLoading = useSessionStore((s) => s.paceLoading);
  const circuitLoading = useSessionStore((s) => s.circuitLoading);
  const loading = paceLoading || circuitLoading;

  const [year, setYear] = useState(DEFAULT_YEAR);
  const [round, setRound] = useState(DEFAULT_ROUND);
  const [sessionType, setSessionType] = useState<string>(DEFAULT_SESSION);

  const handleLoad = () => {
    const selection: SessionSelection = { year, round, sessionType };
    void loadSession(selection);
  };

  const inputClass =
    "rounded-pill border border-line bg-glass px-3 py-1.5 text-label text-text backdrop-blur-glass focus:outline-none focus:ring-2 focus:ring-accent-ring";

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        handleLoad();
      }}
    >
      <select
        className={inputClass}
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        aria-label="Season"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={round}
        onChange={(e) => setRound(Number(e.target.value))}
        aria-label="Round"
      >
        {ROUNDS.map((r) => (
          <option key={r} value={r}>
            R{r}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={sessionType}
        onChange={(e) => setSessionType(e.target.value)}
        aria-label="Session type"
      >
        {SESSION_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={loading}
        className="rounded-pill bg-accent px-4 py-1.5 text-label font-medium text-accent-contrast shadow-panel transition-colors duration-200 hover:bg-accent-hover disabled:opacity-50"
      >
        {loading ? "Loading…" : "Load"}
      </button>
    </form>
  );
}

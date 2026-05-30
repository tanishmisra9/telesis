import { useEffect, useMemo, useRef, useState } from "react";
import { getSchedule } from "../api/client";
import { useSessionStore } from "../store/sessionStore";
import type { ScheduleEntry, SessionSelection } from "../api/types";

const DEFAULT_YEAR = 2024;

export function SessionPicker() {
  const loadSession = useSessionStore((s) => s.loadSession);
  const selection = useSessionStore((s) => s.selection);
  const globalLoading = useSessionStore((s) => s.globalLoading);

  const [year, setYear] = useState(DEFAULT_YEAR);
  const [rounds, setRounds] = useState<ScheduleEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<SessionSelection[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSchedule(year).then((resp) => {
      if (!cancelled) setRounds(resp.rounds);
    });
    return () => {
      cancelled = true;
    };
  }, [year]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("telesis-recent-sessions");
      if (raw) {
        const parsed = JSON.parse(raw) as SessionSelection[];
        setRecent(parsed.slice(0, 8));
      }
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    const handleClose = () => setOpen(false);
    const keyHandler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("telesis:open-picker", handleOpen);
    window.addEventListener("telesis:close-picker", handleClose);
    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener("telesis:open-picker", handleOpen);
      window.removeEventListener("telesis:close-picker", handleClose);
      window.removeEventListener("keydown", keyHandler);
    };
  }, []);

  const label = useMemo(() => {
    if (!selection) return "Select session";
    const event = rounds.find((r) => r.round === selection.round)?.event_name ?? `Round ${selection.round}`;
    return `${event} ${selection.year} · ${selection.sessionType.toUpperCase()}`;
  }, [selection, rounds]);

  const years = Array.from({ length: 8 }, (_, i) => 2026 - i);
  const entries = useMemo(() => {
    const base = rounds.flatMap((round) =>
      round.session_types.map((sessionType) => ({
        year,
        round: round.round,
        event_name: round.event_name,
        country: round.country ?? "",
        event_date: round.event_date ?? "",
        sessionType,
        searchKey: `${year} ${round.round} ${round.event_name} ${round.country ?? ""} ${sessionType}`.toLowerCase(),
      })),
    );
    if (!search.trim()) {
      const recentKeys = new Set(
        recent.map((item) => `${item.year}-${item.round}-${item.sessionType.toUpperCase()}`),
      );
      return [
        ...recent
          .map((item) => {
            const found = base.find(
              (entry) =>
                entry.year === item.year &&
                entry.round === item.round &&
                entry.sessionType.toUpperCase() === item.sessionType.toUpperCase(),
            );
            return found ?? null;
          })
          .filter(Boolean),
        ...base.filter(
          (entry) =>
            !recentKeys.has(`${entry.year}-${entry.round}-${entry.sessionType.toUpperCase()}`),
        ),
      ] as typeof base;
    }
    const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
    return base
      .map((entry) => {
        let score = 0;
        for (const token of tokens) {
          if (entry.searchKey.includes(token)) score += 2;
          if (entry.event_name.toLowerCase().startsWith(token)) score += 2;
          if (entry.sessionType.toLowerCase() === token) score += 1;
        }
        return { entry, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((row) => row.entry);
  }, [rounds, search, recent, year]);

  useEffect(() => {
    setActiveIndex(0);
  }, [search, year]);

  const loadChoice = (next: SessionSelection) => {
    void loadSession(next);
    setOpen(false);
    setSearch("");
    const updated = [
      next,
      ...recent.filter(
        (item) =>
          !(
            item.year === next.year &&
            item.round === next.round &&
            item.sessionType.toUpperCase() === next.sessionType.toUpperCase()
          ),
      ),
    ].slice(0, 8);
    setRecent(updated);
    try {
      localStorage.setItem("telesis-recent-sessions", JSON.stringify(updated));
    } catch {
      // no-op
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="rounded-pill border border-line bg-surface-3 px-3 py-1.5 text-label text-primary focus-visible:ring-2 focus-visible:ring-accent-ring"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" />
        {label} <span className="ml-2 text-micro text-muted">Cmd/Ctrl+K</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-[680px] max-w-[calc(100vw-1rem)] rounded-card border border-line bg-surface-glass p-3 shadow-panel backdrop-blur-modal">
          <div className="mb-3">
            <input
              ref={inputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((idx) => Math.min(entries.length - 1, idx + 1));
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((idx) => Math.max(0, idx - 1));
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  const row = entries[activeIndex];
                  if (!row) return;
                  loadChoice({
                    year: row.year,
                    round: row.round,
                    sessionType: row.sessionType,
                  });
                }
              }}
              placeholder="Search sessions, for example bahrain 2024 race"
              className="w-full rounded-inner border border-line bg-surface-2 px-3 py-2 text-secondary-body text-primary"
            />
          </div>
          <div className="mb-3 flex gap-1">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className={`rounded-pill px-2 py-1 text-caption ${
                  y === year ? "bg-accent-tint text-accent" : "bg-surface-3 text-secondary"
                }`}
                onClick={() => setYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              {entries.slice(0, 60).map((entry, idx) => (
                <button
                  key={`${entry.year}-${entry.round}-${entry.sessionType}-${idx}`}
                  type="button"
                  disabled={globalLoading}
                  onClick={() =>
                    loadChoice({
                      year: entry.year,
                      round: entry.round,
                      sessionType: entry.sessionType,
                    })
                  }
                  className={`w-full rounded-inner border px-3 py-2 text-left ${
                    idx === activeIndex
                      ? "border-accent-border bg-accent-tint"
                      : "border-line bg-surface-2 hover:border-hairline"
                  }`}
                >
                  <p className="text-label text-primary">
                    {entry.event_name} <span className="text-secondary">R{entry.round}</span>
                  </p>
                  <p className="text-caption text-secondary">
                    {entry.sessionType} · {entry.year} · {entry.country || "Unknown location"} ·{" "}
                    {entry.event_date || "Date TBD"}
                  </p>
                </button>
              ))}
            </div>
            <div className="rounded-inner border border-line bg-surface-2 p-3">
              <p className="text-label text-primary">Browse weekend</p>
              <p className="mt-1 text-caption text-secondary">
                Select a round, then launch any session in chronological order.
              </p>
              <div className="mt-3 max-h-[48vh] space-y-2 overflow-y-auto">
                {rounds.map((round) => (
                  <div key={round.round} className="rounded-inner border border-line/70 bg-surface-3 p-2">
                    <p className="text-caption text-primary">
                      R{round.round} · {round.event_name}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {round.session_types.map((sessionType) => (
                        <button
                          key={`${round.round}-${sessionType}`}
                          type="button"
                          onClick={() =>
                            loadChoice({ year, round: round.round, sessionType })
                          }
                          className="rounded-pill bg-surface-1 px-2 py-1 text-caption text-secondary hover:bg-accent-tint hover:text-accent"
                        >
                          {sessionType}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

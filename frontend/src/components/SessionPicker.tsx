import { useEffect, useMemo, useRef, useState } from "react";
import { getSchedule } from "../api/client";
import { useSessionStore } from "../store/sessionStore";
import type { ScheduleEntry, SessionSelection } from "../api/types";

const DEFAULT_YEAR = 2026;
const STANDARD_ORDER = ["FP1", "FP2", "FP3", "Q", "R"] as const;
const SPRINT_ORDER = ["FP1", "SQ", "S", "Q", "R"] as const;

function isMacPlatform(): boolean {
  const platform = navigator.platform?.toLowerCase() ?? "";
  const userAgentDataPlatform =
    ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? "").toLowerCase();
  return platform.includes("mac") || userAgentDataPlatform.includes("mac");
}

function orderSessions(sessionTypes: string[]): string[] {
  const normalized = sessionTypes.map((item) => item.toUpperCase());
  const primary = normalized.includes("SQ") && normalized.includes("S") ? SPRINT_ORDER : STANDARD_ORDER;
  const ordered = primary.filter((item) => normalized.includes(item));
  const extras = normalized.filter((item) => !ordered.includes(item as (typeof primary)[number]));
  return [...ordered, ...extras];
}

export function SessionPicker() {
  const loadSession = useSessionStore((s) => s.loadSession);
  const selection = useSessionStore((s) => s.selection);
  const globalLoading = useSessionStore((s) => s.globalLoading);

  const [year, setYear] = useState(DEFAULT_YEAR);
  const [rounds, setRounds] = useState<ScheduleEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());
  const [shortcutText, setShortcutText] = useState("Ctrl K");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setShortcutText(isMacPlatform() ? "⌘K" : "Ctrl K");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getSchedule(year).then((resp) => {
      if (!cancelled) {
        setRounds(resp.rounds);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [year]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const years = useMemo(() => Array.from({ length: 8 }, (_, index) => 2026 - index), []);
  const label = useMemo(() => {
    if (!selection) return "Select session";
    const event = rounds.find((entry) => entry.round === selection.round)?.event_name ?? `Round ${selection.round}`;
    return `${event} ${selection.year} · ${selection.sessionType.toUpperCase()}`;
  }, [selection, rounds]);

  const filteredRounds = useMemo(() => {
    const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      return rounds.map((round) => ({ ...round, ordered_sessions: orderSessions(round.session_types) }));
    }
    return rounds
      .map((round) => {
        const orderedSessions = orderSessions(round.session_types);
        const haystack = `${year} ${round.round} ${round.event_name} ${round.country ?? ""} ${orderedSessions.join(" ")}`.toLowerCase();
        const matchingSessions = orderedSessions.filter((sessionType) =>
          tokens.every((token) => `${haystack} ${sessionType.toLowerCase()}`.includes(token)),
        );
        const roundMatches = tokens.every((token) => haystack.includes(token));
        if (!roundMatches && !matchingSessions.length) {
          return null;
        }
        return {
          ...round,
          ordered_sessions: matchingSessions.length ? matchingSessions : orderedSessions,
        };
      })
      .filter((round): round is ScheduleEntry & { ordered_sessions: string[] } => Boolean(round));
  }, [rounds, search, year]);

  useEffect(() => {
    setExpandedRounds((current) => {
      const next = new Set<number>();
      for (const round of filteredRounds) {
        if (current.has(round.round)) next.add(round.round);
      }
      if (!search.trim()) return next;
      for (const round of filteredRounds) {
        next.add(round.round);
      }
      return next;
    });
    setActiveIndex(0);
  }, [filteredRounds, search]);

  const visibleSessions = useMemo(
    () =>
      filteredRounds.flatMap((round) =>
        (expandedRounds.has(round.round) ? round.ordered_sessions : []).map((sessionType) => ({
          round: round.round,
          sessionType,
        })),
      ),
    [expandedRounds, filteredRounds],
  );

  const loadChoice = (next: SessionSelection) => {
    void loadSession(next);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded-pill border border-line bg-surface-3 px-3 py-1.5 text-label text-primary focus-visible:ring-2 focus-visible:ring-accent-ring"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" />
        {label} <span className="ml-2 text-micro text-muted">{shortcutText}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-[520px] max-w-[calc(100vw-1rem)] rounded-card border border-line bg-surface-glass p-3 shadow-panel backdrop-blur-modal">
          <input
            ref={inputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(visibleSessions.length - 1, index + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(0, index - 1));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const row = visibleSessions[activeIndex];
                if (!row) return;
                loadChoice({ year, round: row.round, sessionType: row.sessionType });
              }
            }}
            placeholder="Search for a session"
            className="w-full rounded-inner border border-line bg-surface-2 px-3 py-2 text-secondary-body text-primary"
          />
          <div className="mt-3 flex flex-wrap gap-1">
            {years.map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-pill px-2 py-1 text-caption ${
                  item === year ? "bg-accent-tint text-accent" : "bg-surface-3 text-secondary"
                }`}
                onClick={() => setYear(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <p className="mt-3 text-caption text-secondary">Pick a round to see its sessions.</p>
          <div className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto">
            {filteredRounds.map((round) => {
              const isExpanded = expandedRounds.has(round.round);
              return (
                <article key={round.round} className="rounded-inner border border-line bg-surface-2 p-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedRounds((current) => {
                        const next = new Set(current);
                        if (next.has(round.round)) {
                          next.delete(round.round);
                        } else {
                          next.add(round.round);
                        }
                        return next;
                      })
                    }
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-label text-primary">
                        R{round.round} {round.event_name}
                      </p>
                      <p className="text-caption text-secondary">{round.event_date ?? "Date pending"}</p>
                    </div>
                    <span className="text-caption text-muted">{isExpanded ? "Hide" : "Show"}</span>
                  </button>
                  {isExpanded && (
                    <div className="mt-2 space-y-1.5">
                      {round.ordered_sessions.map((sessionType) => {
                        const sessionIndex = visibleSessions.findIndex(
                          (item) => item.round === round.round && item.sessionType === sessionType,
                        );
                        return (
                          <button
                            key={`${round.round}-${sessionType}`}
                            type="button"
                            disabled={globalLoading}
                            onClick={() => loadChoice({ year, round: round.round, sessionType })}
                            className={`w-full rounded-pill border px-2.5 py-1 text-left text-caption ${
                              sessionIndex === activeIndex
                                ? "border-accent-border bg-accent-tint text-accent"
                                : "border-line bg-surface-3 text-secondary hover:border-hairline"
                            }`}
                          >
                            {sessionType}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
            {!filteredRounds.length && (
              <p className="rounded-inner border border-line bg-surface-2 p-3 text-caption text-secondary">
                No rounds matched your search.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;
    void getSchedule(year).then((resp) => {
      if (!cancelled) setRounds(resp.rounds);
    });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const label = useMemo(() => {
    if (!selection) return "Select session";
    const event = rounds.find((r) => r.round === selection.round)?.event_name ?? `Round ${selection.round}`;
    return `${event} ${selection.year} · ${selection.sessionType.toUpperCase()}`;
  }, [selection, rounds]);

  const years = Array.from({ length: 8 }, (_, i) => 2026 - i);

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded-pill border border-line bg-surface-3 px-3 py-1.5 text-label text-primary"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" />
        {label} ▾
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-[480px] max-w-[calc(100vw-1rem)] rounded-card border border-line bg-surface-glass p-3 shadow-panel backdrop-blur-modal">
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
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {rounds.map((round) => (
              <div key={round.round} className="rounded-inner border border-line bg-surface-2 p-2">
                <p className="text-label text-primary">{round.event_name}</p>
                <p className="text-caption text-secondary">
                  {round.country} · {round.location} · {round.event_date}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {round.session_types.map((sessionType) => (
                    <button
                      key={`${round.round}-${sessionType}`}
                      type="button"
                      onClick={() => {
                        const next: SessionSelection = { year, round: round.round, sessionType };
                        void loadSession(next);
                        setOpen(false);
                      }}
                      disabled={globalLoading}
                      className="rounded-pill bg-surface-3 px-2 py-1 text-micro text-primary hover:bg-accent-tint"
                    >
                      {sessionType}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

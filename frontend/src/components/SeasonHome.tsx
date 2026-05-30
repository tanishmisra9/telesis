import { useEffect, useMemo, useState } from "react";
import { getPace, getSeasonOverview } from "../api/client";
import type {
  SeasonConstructorPaceEntry,
  SeasonOverviewResponse,
  SessionSelection,
} from "../api/types";
import { TeamBadge } from "./TeamBadge";

interface SeasonHomeProps {
  onLoadSession: (selection: SessionSelection) => void;
}

const CURRENT_YEAR = 2026;

function RankTrendSparkline({ trend }: { trend: Array<number | null> }) {
  const values = trend.filter((value): value is number => typeof value === "number");
  if (!values.length) {
    return <span className="text-caption text-muted">No rounds analyzed yet.</span>;
  }
  const maxRank = Math.max(...values, 1);
  const width = 88;
  const height = 28;
  const stepX = values.length <= 1 ? 0 : width / (values.length - 1);
  const points = values
    .map((rank, index) => {
      const x = index * stepX;
      const y = ((rank - 1) / Math.max(1, maxRank - 1 || 1)) * (height - 6) + 3;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-[92px]">
      <polyline points={points} fill="none" stroke="rgba(245,245,247,0.88)" strokeWidth={2} />
      {values.map((rank, index) => {
        const x = index * stepX;
        const y = ((rank - 1) / Math.max(1, maxRank - 1 || 1)) * (height - 6) + 3;
        return <circle key={`${index}-${rank}`} cx={x} cy={y} r={1.7} fill="rgba(245,245,247,0.95)" />;
      })}
    </svg>
  );
}

function ConstructorRow({
  index,
  entry,
}: {
  index: number;
  entry: SeasonConstructorPaceEntry;
}) {
  return (
    <article className="rounded-inner border border-line bg-surface-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-5 text-right text-caption tabular text-secondary">{index + 1}</span>
          <TeamBadge team={entry.team} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-label text-primary">{entry.team}</p>
            <p className="text-caption text-secondary">
              Season pace rank {entry.pace_rank.toFixed(2)} from {entry.rounds_sampled} rounds
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RankTrendSparkline trend={entry.rank_trend} />
          <span className="text-caption tabular text-muted">+{entry.average_gap_s.toFixed(3)}s</span>
        </div>
      </div>
    </article>
  );
}

export function SeasonHome({ onLoadSession }: SeasonHomeProps) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [overview, setOverview] = useState<SeasonOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const years = useMemo(() => Array.from({ length: 8 }, (_, idx) => CURRENT_YEAR - idx), []);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getSeasonOverview(year);
      setOverview(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load season overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, [year]);

  const missingRaceRounds = useMemo(() => {
    if (!overview) return [];
    const analyzed = new Set(
      overview.calendar
        .filter((item) => overview.constructors.some((entry) => (entry.rank_trend[item.round - 1] ?? null) !== null))
        .map((item) => item.round),
    );
    return overview.calendar
      .filter((item) => item.session_types.includes("R") && !analyzed.has(item.round))
      .map((item) => item.round);
  }, [overview]);

  const runBackfill = async () => {
    if (!overview) return;
    setBackfilling(true);
    setProgress({ done: 0, total: missingRaceRounds.length });
    try {
      let done = 0;
      for (const round of missingRaceRounds) {
        await getPace(year, round, "R");
        done += 1;
        setProgress({ done, total: missingRaceRounds.length });
      }
      await loadOverview();
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="rounded-card border border-line bg-panel p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-caption uppercase tracking-[0.08em] text-secondary">Telesis</p>
            <h1 className="text-[clamp(2rem,5vw,2.8rem)] font-medium tracking-hero text-primary">
              {year} season competitive order
            </h1>
          </div>
          <div className="inline-flex rounded-pill border border-line bg-glass p-0.5">
            {years.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setYear(item)}
                className={`rounded-pill px-3 py-1 text-caption ${
                  item === year ? "bg-accent-tint text-accent" : "text-secondary"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="rounded-card border border-line bg-panel p-5 shadow-panel">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-card-heading font-medium text-primary">Competitive order</h2>
          {overview && overview.analyzed_rounds < overview.total_rounds && (
            <p className="text-caption text-secondary">
              Based on {overview.analyzed_rounds} of {overview.total_rounds} rounds analyzed.
            </p>
          )}
        </div>
        {loading && <p className="text-secondary-body text-secondary">Loading season order.</p>}
        {error && <p className="text-secondary-body text-secondary">{error}</p>}
        {!loading && overview && (
          <div className="space-y-2">
            {overview.constructors.map((entry, index) => (
              <ConstructorRow key={entry.team} index={index} entry={entry} />
            ))}
            {!overview.constructors.length && (
              <p className="rounded-inner border border-line bg-surface-2 p-3 text-secondary-body text-secondary">
                No cached race pace is available yet for this season.
              </p>
            )}
          </div>
        )}
        {overview && missingRaceRounds.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void runBackfill()}
              disabled={backfilling}
              className="rounded-pill border border-line bg-surface-3 px-3 py-1.5 text-caption text-secondary hover:border-hairline"
            >
              {backfilling ? "Analyzing missing rounds" : "Analyze missing rounds now"}
            </button>
            {progress && (
              <p className="text-caption text-muted">
                {progress.done} of {progress.total} completed
              </p>
            )}
          </div>
        )}
      </section>

      {overview?.standings && (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-card border border-line bg-panel p-4 shadow-panel">
            <h3 className="text-card-heading font-medium text-primary">Constructor standings</h3>
            <div className="mt-3 space-y-2">
              {overview.standings.constructors.slice(0, 10).map((entry) => (
                <div key={entry.name} className="flex items-center justify-between rounded-inner bg-surface-2 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-caption text-secondary">{entry.position}</span>
                    <span className="text-label text-primary">{entry.name}</span>
                  </div>
                  <span className="text-caption tabular text-secondary">{entry.points.toFixed(1)} pts</span>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-card border border-line bg-panel p-4 shadow-panel">
            <h3 className="text-card-heading font-medium text-primary">Driver standings</h3>
            <div className="mt-3 space-y-2">
              {overview.standings.drivers.slice(0, 10).map((entry) => (
                <div key={entry.name} className="flex items-center justify-between rounded-inner bg-surface-2 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-caption text-secondary">{entry.position}</span>
                    <span className="text-label text-primary">{entry.name}</span>
                  </div>
                  <span className="text-caption tabular text-secondary">{entry.points.toFixed(1)} pts</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      <section className="rounded-card border border-line bg-panel p-5 shadow-panel">
        <h2 className="text-card-heading font-medium text-primary">Season calendar</h2>
        <div className="mt-3 space-y-2">
          {(overview?.calendar ?? []).map((round) => (
            <article key={round.round} className="rounded-inner border border-line bg-surface-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-label text-primary">
                    R{round.round} {round.event_name}
                  </p>
                  <p className="text-caption text-secondary">
                    {round.event_date ?? "Date pending"} · Winner: {round.winner ?? "Not cached"} · Pole:{" "}
                    {round.pole ?? "Not cached"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {round.session_types.map((sessionType) => (
                    <button
                      key={`${round.round}-${sessionType}`}
                      type="button"
                      onClick={() => onLoadSession({ year, round: round.round, sessionType })}
                      className="rounded-pill border border-line px-2.5 py-1 text-caption text-secondary hover:border-hairline"
                    >
                      {sessionType}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

import type { ResultsResponse, StintsResponse } from "../api/types";
import { DriverHeadshot } from "./DriverHeadshot";

interface LeaderboardProps {
  results: ResultsResponse;
  stints: StintsResponse | null;
  selectedDriver: string | null;
  onSelectDriver: (abbr: string) => void;
}

export function Leaderboard({
  results,
  stints,
  selectedDriver,
  onSelectDriver,
}: LeaderboardProps) {
  const stintByDriver = new Map(
    (stints?.drivers ?? []).map((d) => [d.abbr, d.stints.map((s) => s.compound)]),
  );

  return (
    <section className="rounded-card border border-line bg-panel p-4 shadow-panel">
      <h3 className="mb-3 text-card-heading font-medium text-primary">Leaderboard</h3>
      <div className="space-y-2">
        {results.drivers.map((driver) => (
          <button
            key={driver.abbr}
            type="button"
            onClick={() => onSelectDriver(driver.abbr)}
            className="flex w-full items-center gap-3 rounded-inner border border-transparent bg-surface-2 px-2 py-2 text-left transition hover:border-hairline hover:bg-surface-3"
            style={
              selectedDriver === driver.abbr
                ? { borderColor: "rgba(232,163,61,0.4)", backgroundColor: "rgba(232,163,61,0.1)" }
                : undefined
            }
          >
            <div className="w-8 text-right text-caption tabular">
              P{driver.finish_position ?? "-"}
            </div>
            <DriverHeadshot
              abbr={driver.abbr}
              headshotUrl={driver.headshot_url}
              teamColor={driver.team_color}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-label text-primary">{driver.abbr}</p>
              <p className="truncate text-caption text-secondary">{driver.team}</p>
            </div>
            <div className="text-right">
              <p className="text-caption tabular text-secondary">
                {driver.fastest_lap_s ? driver.fastest_lap_s.toFixed(3) : "—"}
              </p>
              <p className="text-micro text-tertiary">{driver.status ?? ""}</p>
            </div>
            <div className="hidden min-w-16 justify-end gap-1 md:flex">
              {(stintByDriver.get(driver.abbr) ?? []).slice(0, 4).map((compound, idx) => (
                <span key={`${driver.abbr}-${compound}-${idx}`} className="h-2 w-2 rounded-full bg-white/60" />
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

import type {
  CircuitResponse,
  InsightItem,
  ResultsResponse,
  StintsResponse,
  TelemetryOverlayResponse,
} from "../api/types";
import { CircuitMap } from "./CircuitMap";
import { DriverHeadshot } from "./DriverHeadshot";
import { PerformanceSignature } from "./PerformanceSignature";
import { resolveTeamColor } from "../design/teamColors";

interface DriverDetailPaneProps {
  results: ResultsResponse;
  stints: StintsResponse | null;
  insights: InsightItem[];
  circuit: CircuitResponse | null;
  telemetryOverlay: TelemetryOverlayResponse | null;
  selectedDriver: string | null;
  onSelectDriver: (abbr: string | null) => void;
}

export function DriverDetailPane({
  results,
  stints,
  insights,
  circuit,
  telemetryOverlay,
  selectedDriver,
  onSelectDriver,
}: DriverDetailPaneProps) {
  if (!selectedDriver) {
    return (
      <section className="rounded-card border border-line bg-panel p-4 shadow-panel">
        <h3 className="text-card-heading font-medium text-primary">Driver detail</h3>
        <p className="mt-2 text-caption text-secondary">Select a driver from the leaderboard.</p>
        {circuit && (
          <div className="mt-4">
            <CircuitMap
              circuit={circuit}
              telemetryOverlay={telemetryOverlay}
              results={results}
              selectedDriver={null}
              onSelectDriver={(abbr) => onSelectDriver(abbr)}
            />
          </div>
        )}
      </section>
    );
  }

  const driver = results.drivers.find((d) => d.abbr === selectedDriver) ?? null;
  const driverInsight = insights.find((d) => d.id === selectedDriver);
  const driverStints = stints?.drivers.find((d) => d.abbr === selectedDriver)?.stints ?? [];
  if (!driver) return null;

  return (
    <section
      className="rounded-card border border-line bg-panel p-4 shadow-panel"
      style={{ borderLeftColor: resolveTeamColor(driver.team), borderLeftWidth: "4px" }}
    >
      <h3 className="text-card-heading font-medium text-primary">
        {driver.full_name ?? driver.abbr}
      </h3>
      <p className="mt-1 text-caption text-secondary">
        Grid P{driver.grid_position ?? "-"} to finish P{driver.finish_position ?? "-"}
      </p>
      {driverInsight && (
        <>
          <div className="mt-3 flex items-center gap-3">
            <DriverHeadshot
              abbr={driver.abbr}
              headshotUrl={driver.headshot_url}
              teamColor={driver.team_color}
              size="md"
            />
            <div>
              <p className="text-label text-primary">{driver.full_name ?? driver.abbr}</p>
              <p className="text-caption text-secondary">{driver.team}</p>
            </div>
          </div>
          <p className="mt-3 text-secondary-body text-secondary">
            {driverInsight.takeaway || driverInsight.headline_nuggets[0]}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {driverInsight.rank_chips.slice(0, 3).map((chip) => (
              <span
                key={chip}
                className="rounded-pill border border-accent-border bg-accent-tint px-2.5 py-1 text-caption text-accent"
              >
                {chip}
              </span>
            ))}
          </div>
          <details className="mt-3 rounded-inner border border-line bg-panel/50 p-3">
            <summary className="cursor-pointer text-caption text-secondary">Details</summary>
            <div className="mt-3">
              <PerformanceSignature
                profile={driverInsight.profile}
                profileRanks={driverInsight.profile_ranks}
              />
            </div>
            <div className="mt-3 space-y-1 text-secondary-body text-muted">
              {driverInsight.evidence.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            {driverInsight.confidence_note && (
              <p className="mt-3 text-caption text-muted">{driverInsight.confidence_note}</p>
            )}
          </details>
        </>
      )}
      {driverStints.length > 0 && (
        <details className="mt-3 rounded-inner border border-line bg-panel/50 p-3">
          <summary className="cursor-pointer text-caption text-secondary">Stint breakdown</summary>
          <div className="mt-2 space-y-1 text-caption text-muted">
            {driverStints.map((stint) => (
              <p key={stint.stint_number}>
                Stint {stint.stint_number}: {stint.compound} L{stint.lap_start}-L{stint.lap_end}
              </p>
            ))}
          </div>
        </details>
      )}
      {circuit && (
        <div className="mt-4">
          <CircuitMap
            circuit={circuit}
            telemetryOverlay={telemetryOverlay}
            results={results}
            selectedDriver={selectedDriver}
            onSelectDriver={(abbr) => onSelectDriver(abbr)}
          />
        </div>
      )}
    </section>
  );
}

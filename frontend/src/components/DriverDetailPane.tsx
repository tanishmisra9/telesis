import type { CircuitResponse, InsightItem, ResultsResponse, StintsResponse } from "../api/types";
import { CircuitMap } from "./CircuitMap";
import { PerformanceSignature } from "./PerformanceSignature";

interface DriverDetailPaneProps {
  results: ResultsResponse;
  stints: StintsResponse | null;
  insights: InsightItem[];
  circuit: CircuitResponse | null;
  selectedDriver: string | null;
  onSelectDriver: (abbr: string | null) => void;
}

export function DriverDetailPane({
  results,
  stints,
  insights,
  circuit,
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
            <CircuitMap circuit={circuit} selectedDriver={null} onSelectDriver={(abbr) => onSelectDriver(abbr)} />
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
    <section className="rounded-card border border-line bg-panel p-4 shadow-panel">
      <h3 className="text-card-heading font-medium text-primary">{driver.abbr} briefing</h3>
      <p className="mt-1 text-caption text-secondary">
        Grid P{driver.grid_position ?? "-"} to finish P{driver.finish_position ?? "-"}
      </p>
      {driverInsight && (
        <>
          <ul className="mt-3 space-y-1 text-caption text-secondary">
            {driverInsight.headline_nuggets.map((nugget) => (
              <li key={nugget}>{nugget}</li>
            ))}
          </ul>
          <div className="mt-3">
            <PerformanceSignature profile={driverInsight.profile} />
          </div>
          <div className="mt-3 space-y-1 text-micro text-muted">
            {driverInsight.evidence.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </>
      )}
      {driverStints.length > 0 && (
        <div className="mt-3 space-y-1 text-micro text-muted">
          {driverStints.map((stint) => (
            <p key={stint.stint_number}>
              Stint {stint.stint_number}: {stint.compound} L{stint.lap_start}-L{stint.lap_end}
            </p>
          ))}
        </div>
      )}
      {circuit && (
        <div className="mt-4">
          <CircuitMap circuit={circuit} selectedDriver={selectedDriver} onSelectDriver={(abbr) => onSelectDriver(abbr)} />
        </div>
      )}
    </section>
  );
}

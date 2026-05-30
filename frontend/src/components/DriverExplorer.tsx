import type { CircuitResponse, InsightItem, ResultsResponse, StintsResponse } from "../api/types";
import { DriverDetailPane } from "./DriverDetailPane";
import { Leaderboard } from "./Leaderboard";

interface DriverExplorerProps {
  results: ResultsResponse;
  stints: StintsResponse | null;
  driverInsights: InsightItem[];
  circuit: CircuitResponse | null;
  selectedDriver: string | null;
  onSelectDriver: (abbr: string | null) => void;
}

export function DriverExplorer({
  results,
  stints,
  driverInsights,
  circuit,
  selectedDriver,
  onSelectDriver,
}: DriverExplorerProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Leaderboard
        results={results}
        stints={stints}
        selectedDriver={selectedDriver}
        onSelectDriver={(abbr) => onSelectDriver(abbr)}
      />
      <DriverDetailPane
        results={results}
        stints={stints}
        insights={driverInsights}
        circuit={circuit}
        selectedDriver={selectedDriver}
        onSelectDriver={onSelectDriver}
      />
    </section>
  );
}

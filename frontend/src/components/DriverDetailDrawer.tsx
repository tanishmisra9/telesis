import { useEffect } from "react";
import type { InsightsResponse, ResultsResponse, StintsResponse } from "../api/types";
import { DriverHeadshot } from "./DriverHeadshot";

interface DriverDetailDrawerProps {
  open: boolean;
  driverAbbr: string | null;
  results: ResultsResponse;
  stints: StintsResponse | null;
  insights: InsightsResponse | null;
  onClose: () => void;
}

export function DriverDetailDrawer({
  open,
  driverAbbr,
  results,
  stints,
  insights,
  onClose,
}: DriverDetailDrawerProps) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const driver = results.drivers.find((d) => d.abbr === driverAbbr) ?? null;
  const driverStints = stints?.drivers.find((d) => d.abbr === driverAbbr)?.stints ?? [];
  const driverInsight = insights?.drivers.find((d) => d.id === driverAbbr);

  return (
    <aside
      className="fixed right-0 top-0 z-40 h-full w-[460px] max-w-full border-l border-line bg-surface-glass p-4 backdrop-blur-modal transition-transform"
      style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      aria-hidden={!open}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-card-heading text-primary">Driver detail</h3>
        <button className="rounded-pill bg-surface-3 px-2 py-1 text-caption" onClick={onClose}>
          Close
        </button>
      </div>
      {driver ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <DriverHeadshot
              abbr={driver.abbr}
              headshotUrl={driver.headshot_url}
              teamColor={driver.team_color}
              size="lg"
            />
            <div>
              <p className="text-label text-primary">{driver.full_name ?? driver.abbr}</p>
              <p className="text-caption text-secondary">{driver.team}</p>
            </div>
          </div>
          <p className="text-caption text-secondary">
            Grid P{driver.grid_position ?? "-"} to finish P{driver.finish_position ?? "-"}
          </p>
          <div className="space-y-1">
            {driverStints.map((stint) => (
              <p key={stint.stint_number} className="text-caption text-secondary">
                Stint {stint.stint_number}: {stint.compound} ({stint.lap_count} laps)
              </p>
            ))}
          </div>
          {driverInsight && (
            <p className="text-caption text-secondary">
              {driverInsight.refined ?? driverInsight.phrases.join(" ").split("—").join(",")}
            </p>
          )}
        </div>
      ) : (
        <p className="text-caption text-secondary">Select a driver from the leaderboard.</p>
      )}
    </aside>
  );
}

import type { StintsResponse } from "../api/types";

const compoundColor: Record<string, string> = {
  SOFT: "#EF4444",
  MEDIUM: "#F5C13A",
  HARD: "#F5F5F7",
  INTERMEDIATE: "#7DD88F",
  WET: "#5BA3F5",
};

interface StintTimelineProps {
  data: StintsResponse;
}

export function StintTimeline({ data }: StintTimelineProps) {
  if (!data.applicable) return null;
  const total = Math.max(1, data.total_laps);
  return (
    <section className="rounded-card border border-line bg-panel p-4 shadow-panel">
      <h3 className="mb-3 text-card-heading font-medium text-primary">Stint timeline</h3>
      <div className="mb-3 flex items-center justify-between text-micro text-muted">
        <span>Lap 1</span>
        <span>Lap {total}</span>
      </div>
      <div className="space-y-2">
        {data.drivers.map((driver) => (
          <div key={driver.abbr} className="flex items-center gap-3">
            <div className="w-10 text-caption text-secondary">{driver.abbr}</div>
            <div className="flex flex-1 gap-1">
              {driver.stints.map((stint) => (
                <div
                  key={`${driver.abbr}-${stint.stint_number}`}
                  className="flex h-4 items-center justify-center rounded-[4px] text-[9px] font-medium text-black/80"
                  style={{
                    width: `${Math.max(2, (stint.lap_count / total) * 100)}%`,
                    backgroundColor: compoundColor[stint.compound] ?? "rgba(255,255,255,0.45)",
                  }}
                  title={`${stint.compound} L${stint.lap_start}-L${stint.lap_end}`}
                >
                  {stint.compound[0]}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-micro text-muted">
        Rows are ordered by finishing position; each segment shows compound and stint length.
      </p>
    </section>
  );
}

import type { TyreDegResponse } from "../api/types";

interface TyreDegradationChartProps {
  data: TyreDegResponse;
}

export function TyreDegradationChart({ data }: TyreDegradationChartProps) {
  if (!data.applicable) return null;
  const topDrivers = data.drivers.slice(0, 8);
  return (
    <section className="rounded-card border border-line bg-panel p-4 shadow-panel">
      <h3 className="mb-3 text-card-heading font-medium text-primary">Tyre degradation</h3>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {topDrivers.map((driver) => (
          <article key={driver.abbr} className="rounded-inner border border-line bg-surface-2 p-3">
            <p className="text-label text-primary">{driver.abbr}</p>
            <div className="mt-2 space-y-1">
              {driver.stints.map((stint) => (
                <p key={`${driver.abbr}-${stint.stint_number}`} className="text-caption text-secondary">
                  {stint.compound}: {stint.slope_s_per_lap.toFixed(3)} s/lap ({stint.slope_s_per_lap >= 0 ? "degradation" : "improving"})
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
      <p className="mt-2 text-micro text-muted">
        Slopes are linear fits of lap time versus tyre age; positive slope means increasing lap times.
      </p>
    </section>
  );
}

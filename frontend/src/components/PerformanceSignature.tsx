import type { InsightItem } from "../api/types";

const DIMENSIONS: Array<{ key: keyof InsightItem["profile"]; label: string }> = [
  { key: "high_speed_corners", label: "High-speed corners" },
  { key: "medium_speed_corners", label: "Medium-speed corners" },
  { key: "low_speed_corners", label: "Low-speed corners" },
  { key: "straight_line", label: "Straight-line speed" },
  { key: "full_throttle", label: "Full throttle" },
  { key: "deployment", label: "Deployment" },
];

interface PerformanceSignatureProps {
  profile: InsightItem["profile"];
  profileRanks?: InsightItem["profile_ranks"];
}

export function PerformanceSignature({ profile, profileRanks }: PerformanceSignatureProps) {
  return (
    <div className="space-y-3">
      {DIMENSIONS.map((dimension) => {
        const value = Math.max(0, Math.min(1, profile[dimension.key] ?? 0));
        const delta = (value - 0.5) * 2;
        const barWidth = `${Math.round(Math.abs(delta) * 50)}%`;
        void profileRanks;
        return (
          <div key={String(dimension.key)}>
            <div className="mb-1 flex items-center justify-between text-caption text-muted">
              <span>{dimension.label}</span>
            </div>
            <div className="relative h-2 rounded-pill bg-surface-3">
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/30" />
              <div
                className="absolute inset-y-0 rounded-pill bg-accent/70"
                style={
                  delta >= 0
                    ? { left: "50%", width: barWidth }
                    : { right: "50%", width: barWidth }
                }
              />
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between text-micro text-muted">
        <span>Below field</span>
        <span>Above field</span>
      </div>
    </div>
  );
}

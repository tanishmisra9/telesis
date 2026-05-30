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
}

export function PerformanceSignature({ profile }: PerformanceSignatureProps) {
  return (
    <div className="space-y-2">
      {DIMENSIONS.map((dimension) => {
        const value = Math.max(0, Math.min(1, profile[dimension.key] ?? 0));
        return (
          <div key={String(dimension.key)}>
            <div className="mb-1 flex items-center justify-between text-micro text-muted">
              <span>{dimension.label}</span>
              <span className="tabular-nums">{Math.round(value * 100)}%</span>
            </div>
            <div className="h-2 rounded-pill bg-surface-3">
              <div
                className="h-full rounded-pill bg-accent/70"
                style={{ width: `${Math.round(value * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

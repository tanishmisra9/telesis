import { useMemo, useState } from "react";
import type {
  CircuitResponse,
  InsightItem,
  ResultsResponse,
  TelemetryOverlayResponse,
} from "../api/types";
import { resolveTeamColor, teamColorWithAlpha } from "../design/teamColors";
import { CircuitMap } from "./CircuitMap";
import { PerformanceSignature } from "./PerformanceSignature";
import { TeamBadge } from "./TeamBadge";

interface ConstructorAttributionGridProps {
  constructors: InsightItem[];
  circuit?: CircuitResponse | null;
  telemetryOverlay?: TelemetryOverlayResponse | null;
  results?: ResultsResponse | null;
}

export function ConstructorAttributionGrid({
  constructors,
  circuit,
  telemetryOverlay,
  results,
}: ConstructorAttributionGridProps) {
  const [focusedTeam, setFocusedTeam] = useState<string | null>(null);
  const focused = useMemo(
    () => constructors.find((item) => item.id === focusedTeam) ?? null,
    [constructors, focusedTeam],
  );
  return (
    <section className="rounded-card border border-line bg-panel p-5 shadow-panel">
      <h2 className="text-card-heading font-medium tracking-card-heading text-text">
        Constructor attribution
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {constructors.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setFocusedTeam(entry.id)}
            className="rounded-inner border border-line bg-surface-2 p-4 text-left transition hover:border-accent-border"
            style={{
              borderLeftColor: resolveTeamColor(entry.id),
              borderLeftWidth: "4px",
              background: `linear-gradient(90deg, ${teamColorWithAlpha(entry.id, 0.1)} 0%, rgba(0,0,0,0) 22%)`,
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <TeamBadge team={entry.id} size="sm" />
                <div className="min-w-0">
                  <h3 className="truncate text-label text-primary">{entry.id}</h3>
                </div>
              </div>
              <span
                className="rounded-pill border border-line bg-surface-3 px-2 py-0.5 text-caption text-muted"
                title={entry.confidence_note ?? ""}
              >
                {entry.confidence}
              </span>
            </div>
            <p className="text-secondary-body text-secondary">{entry.takeaway || entry.headline_nuggets[0]}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.rank_chips.slice(0, 3).map((chip) => (
                <span
                  key={chip}
                  className="rounded-pill border border-accent-border bg-accent-tint px-2.5 py-1 text-caption text-accent"
                >
                  {chip}
                </span>
              ))}
            </div>
            <div className="mt-3">
              <PerformanceSignature profile={entry.profile} profileRanks={entry.profile_ranks} />
            </div>
          </button>
        ))}
      </div>
      {focused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-card border border-line bg-panel p-5 shadow-panel">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <TeamBadge team={focused.id} />
                <div>
                  <h3 className="text-card-heading text-primary">{focused.id}</h3>
                  <p className="text-secondary-body text-secondary">{focused.takeaway}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFocusedTeam(null)}
                className="rounded-pill border border-line bg-surface-3 px-3 py-1 text-caption text-secondary"
              >
                Close
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <section className="rounded-inner border border-line bg-surface-2 p-4">
                <h4 className="text-label text-primary">Constructor profile</h4>
                <div className="mt-3">
                  <PerformanceSignature
                    profile={focused.profile}
                    profileRanks={focused.profile_ranks}
                  />
                </div>
                <div className="mt-4 space-y-1 text-secondary-body text-muted">
                  {focused.evidence.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
                {focused.confidence_note && (
                  <p className="mt-3 text-caption text-muted">{focused.confidence_note}</p>
                )}
              </section>
              {circuit && (
                <CircuitMap
                  circuit={circuit}
                  telemetryOverlay={telemetryOverlay ?? null}
                  results={results ?? null}
                  selectedConstructor={focused.id}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

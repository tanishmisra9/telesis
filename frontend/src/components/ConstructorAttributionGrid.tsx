import { useEffect, useMemo, useRef, useState } from "react";
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
  const scrollYRef = useRef(0);
  const focused = useMemo(
    () => constructors.find((item) => item.id === focusedTeam) ?? null,
    [constructors, focusedTeam],
  );
  const teamDrivers = useMemo(
    () => (focused ? (results?.drivers ?? []).filter((row) => row.team === focused.id) : []),
    [focused, results],
  );

  useEffect(() => {
    if (!focused) return;
    const bodyStyle = document.body.style;
    scrollYRef.current = window.scrollY;
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollYRef.current}px`;
    bodyStyle.width = "100%";
    bodyStyle.overflowY = "hidden";
    return () => {
      const y = scrollYRef.current;
      bodyStyle.position = "";
      bodyStyle.top = "";
      bodyStyle.width = "";
      bodyStyle.overflowY = "";
      window.scrollTo(0, y);
    };
  }, [focused]);

  const closeOverlay = () => {
    setFocusedTeam(null);
  };

  const profileRows = focused
    ? [
        { label: "Low-speed corners", key: "low_speed_corners" },
        { label: "Medium-speed corners", key: "medium_speed_corners" },
        { label: "High-speed corners", key: "high_speed_corners" },
        { label: "Straight-line speed", key: "straight_line" },
        { label: "Full throttle", key: "full_throttle" },
        { label: "Deployment", key: "deployment" },
      ]
    : [];

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
        <div className="fixed inset-0 z-40 bg-black/65 p-4">
          <button
            aria-label="Close constructor detail"
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={closeOverlay}
          />
          <div className="relative mx-auto max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-card border border-line bg-panel p-5 shadow-panel">
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
                onClick={closeOverlay}
                className="rounded-pill border border-line bg-surface-3 px-3 py-1 text-caption text-secondary"
              >
                Close
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <section className="rounded-inner border border-line bg-surface-2 p-4">
                <h4 className="text-label text-primary">Corner-class breakdown</h4>
                <div className="mt-3 space-y-2">
                  {profileRows.map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-pill bg-surface-3 px-3 py-1.5">
                      <span className="text-caption text-secondary">{item.label}</span>
                      <span className="text-caption tabular text-primary">
                        {(focused.profile[item.key] ?? 0).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
                <h4 className="mt-4 text-label text-primary">Driver pairing</h4>
                <div className="mt-2 space-y-1 text-caption text-secondary">
                  {teamDrivers.map((driver) => (
                    <p key={driver.abbr}>
                      {driver.full_name ?? driver.abbr} ({driver.abbr})
                    </p>
                  ))}
                  {!teamDrivers.length && <p>No cached drivers for this team in this session.</p>}
                </div>
                <h4 className="mt-4 text-label text-primary">Evidence</h4>
                <div className="mt-2 space-y-1 text-secondary-body text-muted">
                  {focused.evidence.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
                <div className="mt-4">
                  <PerformanceSignature profile={focused.profile} profileRanks={focused.profile_ranks} />
                </div>
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

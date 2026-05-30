import { motion, useReducedMotion } from "framer-motion";
import type { InsightsResponse, InsightSelection, MetricsResponse } from "../api/types";
import { ConstructorLogo } from "./ConstructorLogo";

function cleanPhrase(text: string): string {
  return text.split("—").join(",");
}

interface InsightPanelProps {
  insights: InsightsResponse;
  metrics: MetricsResponse | null;
  selected: InsightSelection | null;
}

function renderInsightText(phrases: string[], refined: string | null): string {
  if (refined && refined.trim().length > 0) return cleanPhrase(refined);
  return cleanPhrase(phrases.join(" "));
}

export function InsightPanel({ insights, metrics, selected }: InsightPanelProps) {
  const prefersReducedMotion = useReducedMotion();

  const driverItems = selected?.kind === "driver"
    ? insights.drivers.filter((d) => d.id === selected.id)
    : insights.drivers;

  const constructorItems = selected?.kind === "constructor"
    ? insights.constructors.filter((c) => c.id === selected.id)
    : insights.constructors;

  return (
    <motion.div
      className="w-full rounded-card border border-line bg-panel p-5 shadow-panel"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-card-heading font-medium tracking-card-heading text-text">
          Insights
        </h2>
        <p className="text-micro text-muted">
          {insights.mode === "quali" ? "Qualifying mode" : "Race mode"}
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-label font-medium text-text">Constructors</h3>
        {constructorItems.slice(0, selected ? 1 : 6).map((item) => (
          <article key={item.id} className="rounded-inner border border-line bg-glass px-3 py-2">
            <div className="flex items-center gap-2">
              <ConstructorLogo team={item.id} />
              <p className="text-label text-text">{item.id}</p>
            </div>
            <p className="mt-1 text-micro text-muted">
              {renderInsightText(item.phrases, item.refined)}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-5 space-y-3">
        <h3 className="text-label font-medium text-text">Drivers</h3>
        {driverItems.slice(0, selected ? 1 : 8).map((item) => (
          <article key={item.id} className="rounded-inner border border-line bg-glass px-3 py-2">
            <p className="text-label text-text">{item.id}</p>
            <p className="mt-1 text-micro text-muted">
              {renderInsightText(item.phrases, item.refined)}
            </p>
          </article>
        ))}
      </section>

      {metrics?.applicable && (
        <p className="mt-4 text-micro text-muted">
          Metrics include top/min speed, throttle share, deployment trend, and corner minima.
        </p>
      )}
    </motion.div>
  );
}

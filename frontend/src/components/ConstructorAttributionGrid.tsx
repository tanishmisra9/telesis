import type { InsightItem } from "../api/types";
import { PerformanceSignature } from "./PerformanceSignature";

interface ConstructorAttributionGridProps {
  constructors: InsightItem[];
}

export function ConstructorAttributionGrid({ constructors }: ConstructorAttributionGridProps) {
  return (
    <section className="rounded-card border border-line bg-panel p-5 shadow-panel">
      <h2 className="text-card-heading font-medium tracking-card-heading text-text">
        Constructor attribution
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {constructors.map((entry) => (
          <article key={entry.id} className="rounded-inner border border-line bg-surface-2 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-label text-primary">{entry.id}</h3>
              <span className="text-caption text-muted">{entry.confidence} confidence</span>
            </div>
            <ul className="space-y-1 text-caption text-secondary">
              {entry.headline_nuggets.map((nugget) => (
                <li key={nugget}>{nugget}</li>
              ))}
            </ul>
            <div className="mt-3">
              <PerformanceSignature profile={entry.profile} />
            </div>
            <div className="mt-3 space-y-1 text-micro text-muted">
              {entry.evidence.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

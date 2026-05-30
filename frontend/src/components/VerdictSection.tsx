interface VerdictSectionProps {
  verdict: string;
}

export function VerdictSection({ verdict }: VerdictSectionProps) {
  return (
    <section className="rounded-card border border-line bg-panel p-5 shadow-panel">
      <h2 className="text-card-heading font-medium tracking-card-heading text-text">
        The verdict
      </h2>
      <p className="mt-3 max-w-prose text-body text-secondary">{verdict}</p>
    </section>
  );
}

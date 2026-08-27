// The solution page generates its answer with a Groq call during the server
// render (see page.tsx), which takes several seconds. Without this file
// Next.js has nothing to show while that runs, so the browser stays parked on
// the intake screen with a dead "Loading…" button and then jumps — the whole
// wait reads as the app having frozen. This paints the destination
// immediately instead, in the shape the real page will take.
const shimmer = {
  background:
    "linear-gradient(90deg, var(--border) 25%, color-mix(in oklch, var(--border) 45%, var(--card)) 50%, var(--border) 75%)",
  backgroundSize: "200% 100%",
  animation: "solution-skeleton 1.4s ease-in-out infinite",
  borderRadius: "var(--radius-md)",
} as const;

function Line({ width, height = 13 }: { width: string; height?: number }) {
  return <div style={{ ...shimmer, width, height }} aria-hidden="true" />;
}

export default function SolutionLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      {/* Scoped here rather than globals.css: this is the only thing that
          uses it, and globals.css is a high-traffic file. */}
      <style>{`@keyframes solution-skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { [style*="solution-skeleton"] { animation: none !important; } }`}</style>

      <div className="row-between">
        <span className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          ← Back to edit
        </span>
        <span className="badge">Step 2 of 2</span>
      </div>

      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
        <h1 className="display" style={{ fontSize: "clamp(20px, 2.6vw, 25px)" }}>
          Building your solution…
        </h1>
      </header>

      <p className="hint" role="status" aria-live="polite" style={{ marginTop: -14, marginBottom: 18 }}>
        Working through your problem step by step. This usually takes a few seconds.
      </p>

      <section className="card" style={{ borderColor: "var(--success)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Line width="38%" height={11} />
          <Line width="82%" />
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Step-by-step guide</span>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                    opacity: 0.35,
                  }}
                >
                  {i + 1}
                </div>
                {i < 3 ? <div style={{ width: 2, flex: 1, background: "var(--border)", margin: "4px 0" }} /> : null}
              </div>
              <div
                className="card"
                style={{ marginBottom: 8, flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}
              >
                <Line width={i % 2 === 0 ? "34%" : "44%"} height={12} />
                <Line width={i % 2 === 0 ? "88%" : "72%"} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

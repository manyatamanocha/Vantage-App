import { Flame, MessageCircleQuestion, Target, TrendingUp } from "lucide-react";

const FEATURES = [
  {
    icon: Target,
    color: "var(--primary)",
    title: "Solve real problems",
    body: "Messy client ask in. Sharp AI approach out.",
  },
  {
    icon: Flame,
    color: "#F59E0B",
    title: "Daily streaks",
    body: "One scenario a day. Guess first, no peeking.",
  },
  {
    icon: MessageCircleQuestion,
    color: "#EC4899",
    title: "Daily quizzes",
    body: "Level up your buzzword game.",
  },
  {
    icon: TrendingUp,
    color: "var(--success)",
    title: "Level up",
    body: "Watch your gut instinct get sharper, day by day.",
  },
];

export function WhatsInside() {
  return (
    <div className="mt-14">
      <div style={{ textAlign: "center", fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 750, marginBottom: 22 }}>
        What&apos;s inside <span style={{ display: "inline-block", transform: "rotate(-8deg)" }}>✨</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map((feature, i) => {
          const Icon = feature.icon;
          const tilt = i % 2 === 0 ? -3 : 3;
          return (
            <div
              key={feature.title}
              className="landing-feature-tile"
              style={{
                textAlign: "center",
                padding: "26px 20px",
                borderRadius: "var(--radius-2xl)",
                background: `linear-gradient(150deg, color-mix(in oklch, ${feature.color} 12%, var(--card)), var(--card))`,
                border: `1px solid color-mix(in oklch, ${feature.color} 28%, var(--border))`,
                animationDelay: `${i * 90}ms`,
              }}
            >
              <span
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 52, height: 52, borderRadius: "var(--radius-lg)", marginBottom: 14,
                  background: feature.color, color: "#fff",
                  transform: `rotate(${tilt}deg)`,
                  boxShadow: `0 8px 20px -8px color-mix(in oklch, ${feature.color} 70%, transparent)`,
                }}
              >
                <Icon size={24} aria-hidden="true" />
              </span>
              <div style={{ fontWeight: 750, fontSize: 15.5, marginBottom: 5 }}>{feature.title}</div>
              <p className="card-text" style={{ color: "var(--muted-foreground)" }}>{feature.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

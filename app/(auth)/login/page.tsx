import { Flame, MessageCircleQuestion, Target, TrendingUp } from "lucide-react";
import { EmailLoginForm } from "../email-login-form";

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

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // The middleware appends `?next=…` when it turns an unauthenticated visitor
  // away from a protected route, so signing in returns them where they meant
  // to go instead of dumping everyone on the dashboard.
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : "/";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-10 sm:px-8 sm:py-14">
      <div style={{ textAlign: "center" }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
            padding: "6px 14px", borderRadius: 999, marginBottom: 16,
            background: "color-mix(in oklch, var(--primary) 14%, transparent)", color: "var(--primary)",
          }}
        >
          <Flame size={13} aria-hidden="true" /> Build AI judgment, one problem at a time
        </span>

        <div className="font-heading text-[32px] font-bold tracking-tight sm:text-[38px]">Vantage AI</div>
        <p className="mx-auto mt-3 max-w-[440px] text-[15px] leading-[1.6] text-muted-foreground">
          Turn a messy client ask into the right AI approach — and build the judgment to see it
          yourself, before we ever show you the answer.
        </p>
      </div>

      <div className="mx-auto mt-8 w-full max-w-[380px]">
        <EmailLoginForm next={target} />
      </div>

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
    </main>
  );
}

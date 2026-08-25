import { Flame, MessageCircleQuestion, Target, TrendingUp } from "lucide-react";
import { EmailLoginForm } from "../email-login-form";

const FEATURES = [
  {
    icon: Target,
    color: "var(--primary)",
    title: "Solve real client problems",
    body: "Bring a live client ask, get back the AI approach that actually fits it — never a named tool, always a category you can reason about.",
  },
  {
    icon: Flame,
    color: "#F59E0B",
    title: "Daily practice, real streaks",
    body: "A fresh client scenario every day. Guess before we reveal — that's what turns \"Vantage told me\" into \"I checked myself.\"",
  },
  {
    icon: MessageCircleQuestion,
    color: "#EC4899",
    title: "Jargon quiz, judged by difficulty",
    body: "Easy, medium, hard — pick your level and build the vocabulary that comes up when you're actually in the room with a client.",
  },
  {
    icon: TrendingUp,
    color: "var(--success)",
    title: "Watch your judgment improve",
    body: "First-guess accuracy, tracked over time. Not a vanity stat — a measure of whether the skill actually transferred.",
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
        <p style={{ textAlign: "center", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 18 }}>
          What&apos;s inside
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="card" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 38, height: 38, borderRadius: "var(--radius-md)", flexShrink: 0,
                    background: `color-mix(in oklch, ${feature.color} 16%, transparent)`, color: feature.color,
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>{feature.title}</div>
                  <p className="card-text" style={{ color: "var(--muted-foreground)" }}>{feature.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

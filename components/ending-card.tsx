"use client";

import { useState } from "react";

/**
 * Shared "Got what I needed / Explain more / Example / Follow-up" close,
 * used after Reveal and after the practice-session in-line reveal — a
 * natural end to the task, not another quiz. Mirrors the mockup's
 * endingCard()/wireEndingCard() pair (UI Design Log.md).
 *
 * "Follow-up" honestly acknowledges a typed question instead of fabricating
 * an AI answer to it — no model call happens here.
 */
export function EndingCard({
  explainMore,
  example,
  followupPlaceholder = "What would help?",
  variant = "full",
}: {
  explainMore: string;
  example: string;
  followupPlaceholder?: string;
  /** "minimal" keeps just Got what I needed / Explain more — used by the daily quiz, where Example/Follow-up don't add anything beyond the term's own explanation already shown above. */
  variant?: "full" | "minimal";
}) {
  const [selected, setSelected] = useState<
    "got" | "explain" | "example" | "followup" | null
  >(null);
  const [followupText, setFollowupText] = useState("");
  const [followupSent, setFollowupSent] = useState(false);

  const allChips: { key: "got" | "explain" | "example" | "followup"; label: string }[] = [
    { key: "got", label: "Got what I needed" },
    { key: "explain", label: "Explain more" },
    { key: "example", label: "Example" },
    { key: "followup", label: "Follow-up" },
  ];
  const chips = variant === "minimal" ? allChips.slice(0, 2) : allChips;

  return (
    <section className="card ending-card">
      <span className="card-label">Got what you needed?</span>
      <div className="chip-row">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setSelected(chip.key)}
            aria-pressed={selected === chip.key}
            className="chip-btn"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {selected === "got" ? (
        <p className="ending-panel card-text">Glad that helped.</p>
      ) : null}

      {selected === "explain" ? (
        <div className="ending-panel card-text">{explainMore}</div>
      ) : null}

      {selected === "example" ? (
        <div className="ending-panel card-text">{example}</div>
      ) : null}

      {selected === "followup" ? (
        <div className="ending-panel field">
          <label htmlFor="ending-followup">Ask a follow-up</label>
          <textarea
            id="ending-followup"
            rows={2}
            value={followupText}
            onChange={(e) => setFollowupText(e.target.value)}
            placeholder={followupPlaceholder}
            className="input"
          />
          <div className="actions">
            <button
              type="button"
              onClick={() => setFollowupSent(true)}
              disabled={followupSent || !followupText.trim()}
              className="btn btn-secondary"
            >
              Send
            </button>
          </div>
          {followupSent ? (
            <p className="card-text">Noted — thanks for the feedback.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

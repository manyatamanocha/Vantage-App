"use client";

import { useState } from "react";
import { updateSettings } from "./actions";

interface SettingsFormProps {
  initialDifficulty?: string;
  initialFrequency?: string;
  userId: string;
}

export function SettingsForm({
  initialDifficulty,
  initialFrequency,
  userId,
}: SettingsFormProps) {
  const [difficulty, setDifficulty] = useState(initialDifficulty || "medium");
  const [frequency, setFrequency] = useState(initialFrequency || "daily");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      await updateSettings(userId, {
        practiceDifficulty: difficulty,
        practiceFrequency: frequency,
      });
      setMessage("Settings saved successfully!");
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const DIFFICULTIES = ["easy", "medium", "hard"] as const;
  const FREQUENCIES = ["daily", "weekly", "monthly"] as const;
  const isError = message.startsWith("Error");

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div className="field">
        <span>Practice difficulty</span>
        <div className="segmented" role="group" aria-label="Practice difficulty">
          {DIFFICULTIES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={difficulty === value}
              disabled={isSubmitting}
              onClick={() => setDifficulty(value)}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Practice frequency</span>
        <div className="segmented" role="group" aria-label="Practice frequency">
          {FREQUENCIES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={frequency === value}
              disabled={isSubmitting}
              onClick={() => setFrequency(value)}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {message ? (
        <p role={isError ? "alert" : "status"} className={isError ? "text-sm text-destructive" : "text-sm text-success"}>
          {message}
        </p>
      ) : null}

      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

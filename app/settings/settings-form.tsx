"use client";

import { useState } from "react";
import { updateSettings } from "./actions";

interface SettingsFormProps {
  initialDifficulty?: string;
  initialFrequency?: string;
  initialDefaultQuestionType?: string;
  userId: string;
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const FREQUENCIES = ["daily", "weekly", "off"] as const;
const QUESTION_TYPES = [
  { value: "scenario", label: "Scenario based question" },
  { value: "quiz", label: "Quiz Time" },
] as const;

export function SettingsForm({
  initialDifficulty,
  initialFrequency,
  initialDefaultQuestionType,
  userId,
}: SettingsFormProps) {
  const [difficulty, setDifficulty] = useState(initialDifficulty || "medium");
  const [frequency, setFrequency] = useState(initialFrequency || "daily");
  const [questionType, setQuestionType] = useState(initialDefaultQuestionType || "scenario");
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
        defaultQuestionType: questionType,
      });
      setMessage("Settings saved successfully!");
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isError = message.startsWith("Error");

  return (
    <form onSubmit={handleSubmit}>
      <div className="card">
      <span className="card-label" style={{ marginBottom: 14 }}>Practice preferences</span>

      <div className="toggle-row">
        <div>
          <div className="label">Challenge difficulty</div>
          <div className="desc">How hard the daily case should be</div>
        </div>
        <div className="segmented" role="group" aria-label="Challenge difficulty">
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

      <div className="toggle-row">
        <div>
          <div className="label">Practice frequency</div>
          <div className="desc">How often a new case appears</div>
        </div>
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

      <div className="toggle-row">
        <div>
          <div className="label">Default question type</div>
          <div className="desc">Choose your preferred practice mode</div>
        </div>
        <select
          className="input"
          aria-label="Default question type"
          value={questionType}
          disabled={isSubmitting}
          onChange={(e) => setQuestionType(e.target.value)}
          style={{ width: "auto" }}
        >
          {QUESTION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {message ? (
        <p role={isError ? "alert" : "status"} className={isError ? "text-sm text-destructive" : "text-sm text-success"}>
          {message}
        </p>
      ) : null}
      </div>

      <div className="actions" style={{ marginTop: 26 }}>
        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

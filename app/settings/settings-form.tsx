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

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div className="field">
        <label htmlFor="difficulty">
          Practice Difficulty
        </label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          disabled={isSubmitting}
          className="input disabled:opacity-50"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="frequency">
          Practice Frequency
        </label>
        <select
          id="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          disabled={isSubmitting}
          className="input disabled:opacity-50"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {message && (
        <div className={`text-sm ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
          {message}
        </div>
      )}

      <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}

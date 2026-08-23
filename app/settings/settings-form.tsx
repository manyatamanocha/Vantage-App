"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="form-group">
        <label htmlFor="difficulty" className="block text-sm font-medium mb-2">
          Practice Difficulty
        </label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          disabled={isSubmitting}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="frequency" className="block text-sm font-medium mb-2">
          Practice Frequency
        </label>
        <select
          id="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          disabled={isSubmitting}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50"
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

      <Button type="submit" disabled={isSubmitting} variant="default">
        {isSubmitting ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}

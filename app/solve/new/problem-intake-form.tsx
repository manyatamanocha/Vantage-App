"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff } from "lucide-react";
import { createDraftSolve } from "./actions";

interface SpeechRecognitionResultLike {
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function ProblemIntakeForm() {
  const router = useRouter();
  const [rawInput, setRawInput] = useState("");
  const [industry, setIndustry] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");

  const speechSupported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    baseTextRef.current = rawInput;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const separator = baseTextRef.current && !baseTextRef.current.endsWith(" ") ? " " : "";
      setRawInput(baseTextRef.current + separator + transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const { solveId } = await createDraftSolve({
          rawInput,
          industry: industry.trim() || undefined,
          source: "live",
        });
        router.push(`/solve/${solveId}/structure`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline" aria-label="Solve progress">
        <div className="stepdots" aria-label="Step 1 of 5"><span className="on" /><span /><span /><span /><span /></div>
        <span className="datechip">Client ask</span>
      </div>
      <header>
        <h1 className="display">What are you solving today?</h1>
        <p className="lede">Start with what your client actually said. We&apos;ll turn the messy ask into a clear problem.</p>
      </header>
      <form onSubmit={handleSubmit} className="stack">
        <label className="field" htmlFor="rawInput">
          <span>1. Ask</span>
          <div className="input-row">
          <textarea
            id="rawInput"
            name="rawInput"
            required
            rows={4}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Paste what your client actually said."
            className="input min-h-32 flex-1"
          />
          {speechSupported && (
            <button
              type="button"
              className="btn btn-icon"
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              aria-pressed={isListening}
              onClick={toggleListening}
            >
              {isListening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
            </button>
          )}
          </div>
          <span className="hint">Use the microphone to dictate your client&apos;s ask.</span>
      </label>

        <label className="field" htmlFor="industry">
          <span>Industry <span className="hint">(optional)</span></span>
        <input
          id="industry"
          name="industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="e.g. Retail, Healthcare, Financial services"
          className="input"
        />
        </label>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={isPending || !rawInput.trim()}>
        {isPending ? "Understanding…" : "Understand my problem"}
          </button>
        </div>
      </form>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  Lock,
  Mic,
  MessageCircle,
  MessageSquare,
  Sparkles,
  SpellCheck,
  TrendingUp,
  Users,
  FileText,
} from "lucide-react";
import { checkAskGrammar, createDraftSolve, refineAsk } from "./actions";
import { SuggestedPromptTerminal } from "./suggested-prompt-terminal";

interface SpeechRecognitionResultLike {
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const MAX_ASK_LENGTH = 10000;

// Starter prompts modeling the real translation gap this form exists for
// (see Persona.md) — a specific client-services problem, not a generic
// "ask me anything" example. Shown only while the field is empty so they
// read as inspiration, not clutter once someone's actually typing.
const SUGGESTED_PROMPTS = [
  "My client's support team is drowning in repetitive tickets — where could AI actually help?",
  "I have 5,000 survey responses to make sense of before Friday's client readout.",
  "The client wants a churn-prediction model but we have no data science team.",
  "I need to summarize a 60-page due diligence report by tomorrow morning.",
  "How would I use AI to spot patterns across a year of messy sales data?",
];

// Short-label quick-pick chips, one per SUGGESTED_PROMPTS entry — same
// underlying prompts, just a glanceable row above the full typewriter list
// instead of making someone read five full sentences to find a starting point.
const SUGGESTED_PROMPT_CHIPS = [
  { label: "Automate support tickets", icon: MessageSquare, promptIndex: 0 },
  { label: "Analyze survey data", icon: TrendingUp, promptIndex: 1 },
  { label: "Predict client churn", icon: Users, promptIndex: 2 },
  { label: "Summarize reports", icon: FileText, promptIndex: 3 },
] as const;

export function ProblemIntakeForm() {
  const router = useRouter();
  const [rawInput, setRawInput] = useState("");
  // Tagged with the exact input it was computed for, so a stale suggestion is
  // never rendered against text the user has since changed.
  const [grammarCorrection, setGrammarCorrection] = useState<{ forInput: string; text: string } | null>(null);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  const micStreamRef = useRef<MediaStream | null>(null);
  const rawInputRef = useRef("");
  // Chrome's SpeechRecognition periodically ends a "continuous" session on
  // its own between phrases — a well-known quirk, not something we asked
  // for. These two refs distinguish that from an actual stop, so onend can
  // decide whether to quietly restart (seamless dictation) or really stop.
  const intentionalStopRef = useRef(false);
  const fatalErrorRef = useRef(false);

  // Step 2: the LLM's refined restatement of rawInput, shown for the user to
  // confirm before actually committing anything to the database.
  const [refinedGoal, setRefinedGoal] = useState<string | null>(null);
  const [problemType, setProblemType] = useState("");
  const [isRefining, startRefining] = useTransition();
  const [isConfirming, startConfirming] = useTransition();

  useEffect(() => {
    rawInputRef.current = rawInput;
  }, [rawInput]);

  // Live grammar/spelling check, debounced to fire ~900ms after typing
  // pauses rather than on every keystroke — an LLM call is too slow/costly
  // to fire on every keystroke, and a pause is when a suggestion is useful.
  useEffect(() => {
    const trimmed = rawInput.trim();
    // No synchronous clear here: the correction is tagged with the input it
    // was computed for, and the render below only shows it when that tag
    // still matches. That also fixes a real bug — the previous version could
    // briefly show the last correction against freshly-typed text.
    if (!trimmed) return;
    const timer = setTimeout(() => {
      setIsCheckingGrammar(true);
      checkAskGrammar(trimmed)
        .then((result) => {
          setGrammarCorrection(result.changed ? { forInput: trimmed, text: result.correctedText } : null);
        })
        .catch(() => {
          // Grammar checking is a nice-to-have, not a blocker — fail silently.
          setGrammarCorrection(null);
        })
        .finally(() => setIsCheckingGrammar(false));
    }, 900);
    return () => clearTimeout(timer);
  }, [rawInput]);

  function releaseMicStream() {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
  }

  // Server-safe: starts false on both server and the client's first render
  // (matching what the server rendered), then flips true after mount if the
  // browser actually supports it. Gating the mic button's very presence on a
  // `typeof window !== "undefined"` check computed inline caused it to
  // render on the client but not the server — a real hydration mismatch that
  // made React discard and rebuild the whole form right as someone might be
  // interacting with it, which is what made the mic look like it "broke" on
  // click.
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    setSpeechSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    return () => {
      intentionalStopRef.current = true;
      recognitionRef.current?.stop();
      releaseMicStream();
    };
  }, []);

  function startRecognitionSession(Ctor: SpeechRecognitionCtor) {
    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    baseTextRef.current = rawInputRef.current;

    recognition.onresult = (event) => {
      // event.results is cumulative for the whole session (every result
      // since this recognition object started, finalized or not) —
      // event.resultIndex only marks which entry most recently changed, not
      // where the transcript starts. Summing from resultIndex instead of 0
      // was silently dropping every earlier phrase the moment a new one
      // began, which is what made spoken text disappear mid-dictation.
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const separator = baseTextRef.current && !baseTextRef.current.endsWith(" ") ? " " : "";
      setRawInput((baseTextRef.current + separator + transcript).slice(0, MAX_ASK_LENGTH));
    };

    recognition.onerror = (event) => {
      // Both are benign here — "no-speech" is just a pause, and "aborted"
      // is our own stop() call. onend (fired right after either) is what
      // actually decides whether to restart or finalize.
      if (event.error === "no-speech" || event.error === "aborted") return;
      fatalErrorRef.current = true;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access was blocked — allow it in your browser's site settings to dictate.");
      } else {
        setError(`Voice input stopped unexpectedly (${event.error}). You can try again or type instead.`);
      }
    };

    recognition.onend = () => {
      if (intentionalStopRef.current || fatalErrorRef.current) {
        setIsListening(false);
        releaseMicStream();
        return;
      }
      // Not a real stop — restart immediately so dictation reads as one
      // continuous session instead of capturing one disconnected phrase
      // per pause. isListening / the mic icon deliberately isn't touched.
      try {
        startRecognitionSession(Ctor);
      } catch {
        setIsListening(false);
        releaseMicStream();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  async function toggleListening() {
    if (isListening) {
      intentionalStopRef.current = true;
      recognitionRef.current?.stop();
      return;
    }

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    setError(null);
    intentionalStopRef.current = false;
    fatalErrorRef.current = false;

    // SpeechRecognition.start() is supposed to trigger the browser's own
    // microphone permission prompt on first use, but that's inconsistent
    // across browsers — some silently fail instead of prompting if the
    // permission state is anything other than a clean "not yet asked".
    // Requesting getUserMedia directly first is the standard, reliable way
    // to force that native prompt (or get a clear denial we can act on)
    // before handing off to SpeechRecognition.
    //
    // Deliberately NOT stopping this stream right away: releasing it and
    // immediately having SpeechRecognition try to open its own capture
    // session raced with the OS/browser still tearing down the previous one
    // — the device briefly looked busy, and SpeechRecognition failed right
    // after starting. Kept alive until recognition actually ends instead.
    try {
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(
          "Microphone access is blocked for this site. Check your browser's site settings (and your OS's microphone privacy settings) and allow access, then try again."
        );
      } else if (name === "NotFoundError") {
        setError("No microphone was found on this device.");
      } else {
        setError("Couldn't access the microphone. You can type instead.");
      }
      return;
    }

    try {
      startRecognitionSession(Ctor);
      setIsListening(true);
    } catch {
      setError("Couldn't start voice input. You can type instead.");
      releaseMicStream();
    }
  }

  function applySuggestedPrompt(prompt: string) {
    setRawInput(prompt);
    setGrammarCorrection(null);
  }

  function handleRefine(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startRefining(async () => {
      try {
        const result = await refineAsk(rawInput);
        setRefinedGoal(result.goal);
        setProblemType(result.problemType);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleConfirm() {
    setError(null);
    startConfirming(async () => {
      try {
        const { solveId } = await createDraftSolve({
          rawInput,
          source: "live",
          goal: (refinedGoal ?? "").trim(),
          problemType,
        });
        router.push(`/solve/${solveId}/solution`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <h1 className="display">
          What are you <span style={{ color: "var(--primary)" }}>solving</span> today?
        </h1>
        <p className="lede">Input what you want to discuss</p>
      </header>
      <form onSubmit={handleRefine} className="stack">
        <label className="field" htmlFor="rawInput">
          <span className="ask-away-label">
            <MessageCircle size={16} aria-hidden="true" /> Ask Awayyyy
          </span>
          <div className="ask-away-wrap">
            <textarea
              id="rawInput"
              name="rawInput"
              required
              rows={4}
              maxLength={MAX_ASK_LENGTH}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Type your question or problem here…"
              className="input ask-away-input"
            />
            {speechSupported ? (
              <button
                type="button"
                className="btn btn-icon ask-away-mic"
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
                aria-pressed={isListening}
                onClick={toggleListening}
              >
                <Mic aria-hidden="true" />
              </button>
            ) : null}
            <span className="ask-away-counter">
              {rawInput.length.toLocaleString()} / {MAX_ASK_LENGTH.toLocaleString()}
            </span>
          </div>

          {(() => {
            // Only show a suggestion still matching what's in the box.
            const suggestion =
              grammarCorrection && grammarCorrection.forInput === rawInput.trim()
                ? grammarCorrection.text
                : null;
            if (!rawInput.trim() || (!isCheckingGrammar && !suggestion)) return null;
            return (
              <div
                className="card"
                style={{ marginTop: 10, padding: "10px 14px", background: "var(--muted, var(--card))" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: suggestion ? 6 : 0 }}>
                  <SpellCheck size={13} aria-hidden="true" style={{ color: "var(--muted-foreground)" }} />
                  <span className="hint" style={{ fontSize: 11.5 }}>
                    {isCheckingGrammar ? "Checking grammar…" : "Suggested wording"}
                  </span>
                </div>
                {suggestion ? <p style={{ fontSize: 13.5, margin: 0 }}>{suggestion}</p> : null}
              </div>
            );
          })()}

          {!rawInput.trim() ? (
            <div style={{ marginTop: 14 }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                <Sparkles size={15} aria-hidden="true" style={{ color: "var(--primary)" }} />
                Not sure where to start? Try one of these
              </span>
              <div className="ask-away-chip-row">
                {SUGGESTED_PROMPT_CHIPS.map(({ label, icon: Icon, promptIndex }) => (
                  <button
                    key={label}
                    type="button"
                    className="ask-away-chip"
                    onClick={() => applySuggestedPrompt(SUGGESTED_PROMPTS[promptIndex])}
                  >
                    <Icon size={14} aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!rawInput.trim() ? (
            <div style={{ marginTop: 14 }}>
              <span
                style={{
                  display: "block",
                  marginBottom: 10,
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--muted-foreground)",
                }}
              >
                Examples
              </span>
              <SuggestedPromptTerminal prompts={SUGGESTED_PROMPTS} onSelect={applySuggestedPrompt} />
            </div>
          ) : null}
      </label>

        <div className="actions" style={{ justifyContent: "center" }}>
          <button className="btn btn-primary" type="submit" disabled={isRefining || !rawInput.trim()}>
            {isRefining ? "Checking…" : "Submit"}
          </button>
        </div>
      </form>

      {refinedGoal ? (
        <>
          <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
            <ArrowDown size={18} style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
          </div>

          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Is that what you mean?</h2>

          <section
            className="card"
            style={{
              borderColor: "var(--primary)",
              boxShadow: "0 0 0 1px var(--primary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "color-mix(in oklch, var(--primary) 18%, transparent)",
                  color: "var(--primary)",
                  flexShrink: 0,
                }}
              >
                <Sparkles size={13} aria-hidden="true" />
              </div>
              <span style={{ color: "var(--primary)", fontWeight: 650, fontSize: 14 }}>
                Here&apos;s a refined version:
              </span>
            </div>

            <p className="quote-card card-text" style={{ fontStyle: "italic", margin: 0 }}>
              &ldquo;{refinedGoal}&rdquo;
            </p>
          </section>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {refinedGoal ? (
        <div className="actions" style={{ justifyContent: "center", flexDirection: "column", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={isConfirming || !refinedGoal?.trim()}
          >
            {isConfirming ? "Loading…" : "Let's solve →"}
          </button>
          <p className="hint" style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
            <Lock size={11} aria-hidden="true" /> You can modify this anytime
          </p>
        </div>
      ) : null}
    </main>
  );
}

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

export function ProblemIntakeForm() {
  const router = useRouter();
  const [rawInput, setRawInput] = useState("");
  const [industry, setIndustry] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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

  useEffect(() => {
    rawInputRef.current = rawInput;
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
      </div>
      <header>
        <h1 className="display">What are you solving today?</h1>
        <p className="lede">Input what you want to discuss</p>
      </header>
      <form onSubmit={handleSubmit} className="stack">
        <label className="field" htmlFor="rawInput">
          <span>Ask Awayyyy</span>
          <div className="input-row">
          <textarea
            id="rawInput"
            name="rawInput"
            required
            rows={4}
            maxLength={MAX_ASK_LENGTH}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
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
          <span className="hint" style={{ display: "block", textAlign: "right", fontSize: 11.5 }}>
            Type or speak. {rawInput.length.toLocaleString()} / {MAX_ASK_LENGTH.toLocaleString()} characters
          </span>
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

        <div className="actions" style={{ justifyContent: "center" }}>
          <button className="btn btn-primary" type="submit" disabled={isPending || !rawInput.trim()}>
        {isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </main>
  );
}

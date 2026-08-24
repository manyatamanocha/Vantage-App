"use client";

import { useState } from "react";

/**
 * Preview/Copy/Download for the generated draft (screen 2g/2h). Purely
 * client-side interaction on text the server already generated and
 * persisted — no further Groq calls happen here.
 */
export function HandbackViewer({ draftText }: { draftText: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser; the text is still
      // visible on screen for a manual copy, so this is not fatal.
    }
  }

  function handleDownload() {
    const blob = new Blob([draftText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "takeaway.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-label="Takeaway draft">
      <p className="text-sm leading-6">{draftText}</p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-secondary px-3.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/75"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-secondary px-3.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/75"
        >
          Download
        </button>
      </div>
    </section>
  );
}

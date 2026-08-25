"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

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
      <p className="card-text" style={{ marginBottom: 14 }}>{draftText}</p>

      <div className="actions">
        <button type="button" onClick={handleCopy} className="btn btn-secondary">
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={handleDownload} className="btn btn-secondary">
          <Download size={16} aria-hidden="true" /> Download
        </button>
      </div>
    </section>
  );
}

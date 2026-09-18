"use client";

import { useState } from "react";

/**
 * Copies `value` to the clipboard and confirms inline. Language-free on
 * purpose: the English-only staff dashboard uses it as-is, and student pages
 * pass translated labels through LocalizedCopyButton.
 */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied ✓",
  failedLabel = "Copy failed",
  className = "",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  failedLabel?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    setState((await writeClipboard(value)) ? "copied" : "failed");
    setTimeout(() => setState("idle"), 1600);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      disabled={!value}
      className={`border border-paper-edge bg-white px-2.5 py-1.5 font-sans text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-muted transition-colors hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-40 ${className}`}
    >
      <span aria-live="polite">
        {state === "copied" ? copiedLabel : state === "failed" ? failedLabel : label}
      </span>
    </button>
  );
}

/**
 * The async Clipboard API is refused without a secure context, a user gesture,
 * or permission — conditions that vary by browser and embedding. Fall back to
 * the legacy selection-based copy before telling staff it failed. The failure
 * state is still reported plainly, never swallowed.
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

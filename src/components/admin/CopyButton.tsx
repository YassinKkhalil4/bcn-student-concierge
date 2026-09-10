"use client";

import { useState } from "react";

/** Copies `value` to the clipboard and confirms inline. */
export function CopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
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
      className={`rounded-md border border-bone-line bg-white px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-bone-warm hover:text-ink disabled:opacity-40 ${className}`}
    >
      <span aria-live="polite">
        {state === "copied" ? "Copied ✓" : state === "failed" ? "Copy failed" : label}
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

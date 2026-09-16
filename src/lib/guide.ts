/**
 * The guide lead magnet: where the file lives, what it is called, and the
 * framing around it on /guide.
 */

/**
 * The public URL. STABLE — never version it. A new edition replaces
 * assets/guide/landing-in-barcelona.pdf in place, so every link already
 * forwarded (and printed on school handouts) keeps working.
 */
export const GUIDE_PATH = "/downloads/landing-in-barcelona.pdf";

/** The name the file is saved under, whatever the URL is. */
export const GUIDE_FILENAME = "Landing-in-Barcelona-2026.pdf";

/**
 * Who the page is talking to. The guide's own voice ("You've been here two
 * weeks. The clock started the day you landed.") is for students already in
 * Barcelona; that stops being true around mid-November and becomes true
 * again for the January intake.
 *
 *   "already-here"  September → mid-November, and January → February
 *   "arriving"      the weeks before an intake
 *
 * Switching this one value swaps every framing line on /guide (the
 * guide.framing.* messages); nothing else on the page needs editing.
 */
export type GuideFraming = "arriving" | "already-here";
export const GUIDE_FRAMING: GuideFraming = "already-here";

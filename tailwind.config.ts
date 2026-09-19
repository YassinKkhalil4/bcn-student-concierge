import type { Config } from "tailwindcss";

/**
 * The design system is the guide's.
 *
 * /guide already carried the brand's real voice — navy, crimson, Archivo over
 * Source Serif, a chamfered corner — while every other page ran on warm bone,
 * olive and whatever serif the visitor's operating system happened to own. A
 * student who downloads the guide and then opens the pricing page should not
 * feel they changed companies. These tokens promote the guide's language to
 * the whole site, so there is one brand and one place to change it.
 *
 * Tokens are named for their job (paper, ink, accent), never for their hue.
 * Every foreground/background pair below is checked for WCAG AA; the `soft`
 * and `bright` steps exist precisely because the obvious value failed.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  /**
   * `hover:` compiles to `@media (hover: hover)`, so it applies only where a
   * pointer can actually hover.
   *
   * Without this, a tap on a phone leaves :hover latched on the element until
   * something else is tapped — and .btn-secondary's hover is a full inversion
   * from transparent to solid ink. Every secondary button a student touched
   * stayed inverted behind them, which reads as "still loading" on the one
   * screen where they are waiting to find out whether their file went through.
   */
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        /** The page. Warm, because paper is warm and screens are not. */
        paper: {
          DEFAULT: "#FBFAF7",
          dim: "#F3F0E9", // alternating bands
          line: "#E3DED3", // hairlines
          edge: "#CFC7B7", // a rule that is meant to be noticed
        },
        /** Text, and the dark field. Cold navy against the warm paper. */
        ink: {
          DEFAULT: "#16202B",
          deep: "#0C141C", // the one full-bleed dark band
          muted: "#47515E", // secondary text — 7.72:1 on paper
          soft: "#626B77", // meta and helper text — 4.74:1 on the dim band
          line: "#2A3744", // hairlines on the dark field
        },
        /** The single accent. One hue, three jobs, no second accent anywhere. */
        accent: {
          DEFAULT: "#C2263C",
          deep: "#9C1B2F", // hover, and small text that needs AAA on paper
          bright: "#EE6479", // the ONLY accent legible on ink — 5.28:1
          tint: "#F8EDEE", // alert and note grounds on paper
        },
        /**
         * The boundary of an interactive control.
         *
         * Separate from `paper.edge` because the two rules answer different
         * standards. `paper.edge` divides blocks of text and is allowed to be
         * quiet; a control's own outline is held to WCAG 1.4.11's 3:1, because
         * for an empty input the border IS the control — there is no label
         * inside it to identify what the box is. `paper.edge` gave 1.68:1 on
         * white, so every input on the site failed that.
         *
         * 3.60:1 on white, 3.45:1 on paper, 3.16:1 on the dim band — the three
         * grounds an input is ever drawn on.
         */
        field: {
          line: "#8F8674",
        },
        /** Foregrounds for the dark field. */
        onink: {
          DEFAULT: "#FBFAF7",
          muted: "#B6BDC6", // 8.69:1 on ink
          soft: "#98A1AC", // 6.29:1 on ink
        },
      },
      fontFamily: {
        // Archivo: a grotesque drawn from printed signage. Headings and every
        // control, because form labels must not be set in a reading serif.
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Source Serif 4: prose only, at 16px and up. The product is documents;
        // the copy that argues for it should read like one.
        serif: ["var(--font-serif)", "Georgia", "serif"],
        // JetBrains Mono: case references, form codes (EX-17), prices, dates.
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Fluid display scale. Six languages means a German headline is a third
        // longer than its English source, so the scale interpolates rather than
        // jumping at breakpoints.
        "display-xl": ["clamp(2.125rem, 1.35rem + 3.3vw, 4.25rem)", { lineHeight: "1.02", letterSpacing: "-0.026em", fontWeight: "800" }],
        "display-lg": ["clamp(1.75rem, 1.28rem + 2.1vw, 3.1rem)", { lineHeight: "1.06", letterSpacing: "-0.022em", fontWeight: "800" }],
        "display-md": ["clamp(1.5rem, 1.24rem + 1.05vw, 2.05rem)", { lineHeight: "1.13", letterSpacing: "-0.018em", fontWeight: "700" }],
        "display-sm": ["clamp(1.15rem, 1.07rem + 0.34vw, 1.35rem)", { lineHeight: "1.22", letterSpacing: "-0.012em", fontWeight: "700" }],
        // Reading sizes, for the serif.
        lede: ["1.1875rem", { lineHeight: "1.6" }],
        read: ["1.0625rem", { lineHeight: "1.68" }],
        // Meta, for the mono and small sans.
        meta: ["0.8125rem", { lineHeight: "1.45" }],
      },
      maxWidth: {
        content: "1240px",
        measure: "68ch", // prose never runs wider than this
        narrow: "34rem",
      },
      borderWidth: { "3": "3px" },
    },
  },
  plugins: [],
} satisfies Config;

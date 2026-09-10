import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0F1613", muted: "#4A5551", soft: "#7C8783" },
        bone: { DEFAULT: "#FBFAF7", warm: "#F4F1EA", line: "#E4DFD4" },
        olive: { DEFAULT: "#2F4F3E", deep: "#1E3629", light: "#5C7A66" },
        terracotta: { DEFAULT: "#B4552F", light: "#D97F58" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      maxWidth: { content: "1180px" },
    },
  },
  plugins: [],
} satisfies Config;

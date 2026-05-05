/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#0e1116",
        panel: "#171b25",
        accent: "#3dd9b4",
        accent2: "#ffb84d",
        neon: "#7cf4d8",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(61,217,180,0.3), 0 12px 30px rgba(0,0,0,0.35)",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.7)", opacity: "0.2" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 rgba(124,244,216,0)" },
          "50%": { boxShadow: "0 0 28px rgba(124,244,216,0.35)" },
        },
      },
      animation: {
        pop: "pop 180ms ease-out",
        pulseGlow: "pulseGlow 1.7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
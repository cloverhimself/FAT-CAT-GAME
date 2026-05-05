/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
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
    },
  },
  plugins: [],
};
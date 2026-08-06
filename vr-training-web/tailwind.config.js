/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0F1C2E",
        surface: "#16243A",
        raised: "#1E3047",
        border: "#33486A",
        ink: "#E8EEF6",
        muted: "#93A4BC",
        primary: "#2DD4BF",
        primaryInk: "#06231F",
        secondary: "#38BDF8",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(45, 212, 191, 0.25), 0 8px 30px rgba(45, 212, 191, 0.12)",
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Orbitron'", "monospace"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
        body: ["'Rajdhani'", "sans-serif"],
      },
      colors: {
        emergency: {
          50: "#fff0f0",
          100: "#ffdede",
          400: "#ff4444",
          500: "#ff2020",
          600: "#e60000",
          900: "#3d0000",
        },
        system: {
          400: "#00aaff",
          500: "#0088ff",
          600: "#0066cc",
          900: "#001a33",
        },
        safe: {
          400: "#00ff88",
          500: "#00cc6a",
          600: "#009950",
          900: "#001a0d",
        },
        dark: {
          900: "#030712",
          800: "#080f1a",
          700: "#0d1626",
          600: "#111d33",
          500: "#162140",
          400: "#1e2d4d",
        },
      },
      animation: {
        "pulse-emergency": "pulse-emergency 1s ease-in-out infinite",
        "scan-line": "scan-line 3s linear infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        "pulse-emergency": {
          "0%, 100%": { opacity: 1, transform: "scale(1)" },
          "50%": { opacity: 0.7, transform: "scale(1.05)" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 10px rgba(255, 32, 32, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(255, 32, 32, 0.8)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};

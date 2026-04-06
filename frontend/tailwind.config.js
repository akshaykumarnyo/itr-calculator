/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["'Playfair Display'", "serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        saffron: {
          50:  "#fff8ed",
          100: "#ffefd4",
          200: "#ffd9a8",
          300: "#ffbc72",
          400: "#ff9438",
          500: "#ff7514",
          600: "#f05a0a",
          700: "#c7420a",
          800: "#9e3510",
          900: "#7f2e11",
        },
        navy: {
          800: "#0f172a",
          900: "#080f1e",
          950: "#040a15",
        },
        jade: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "number-count": "countUp 1s ease forwards",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(20px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grain": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}

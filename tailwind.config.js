/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  plugins: [require("tailwind-scrollbar")],
  theme: {
    fontSize: {
      s: "0.75rem",
      m: "1rem",
      l: "1.5rem",
    },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#000000",
      warning: "#ffcc00",
      danger: "#f54b4c",
      primary: "#336699",
      secondary: "#996633",
      tertiary: "#369369",
      bgB: "#333333",
      bgA: "#112233",
      subtle: "#969696",
      darkgrey: "#434343",
      ring: "#2e528c",
      dark: "#000000cc",
    },
    extend: {
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        zoomIn: {
          "0%": { transform: "scale(0)" },
          "100%": { transform: "scale(1)" },
        },
        parallaxLeft: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        parallaxLeft: "parallaxLeft 9s linear infinite",
        fadeIn: "fadeIn 1200ms linear 1",
        zoomIn: "zoomIn 300ms ease 1",
      },
    },
    fontFamily: {
      sans: ['"Regular"', "sans-serif"],
      bold: ['"bold"', "sans-serif"],
    },
  },
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "hsl(355 85% 47%)",
          fg: "hsl(0 0% 100%)",
          strong: "hsl(354 92% 36%)",
          soft: "hsl(356 90% 96%)"
        },
        ink: "hsl(0 0% 6%)"
      },
      borderRadius: {
        xl2: "1rem"
      }
    }
  },
  plugins: []
};
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/config/tailwind-preset.css",
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;
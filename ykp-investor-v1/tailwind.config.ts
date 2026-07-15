import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: { colors: {
    border: 'hsl(214 32% 91%)', muted: 'hsl(210 40% 96%)',
    foreground: 'hsl(222 47% 11%)', background: 'hsl(0 0% 100%)',
    primary: { DEFAULT: 'hsl(222 47% 11%)', foreground: 'hsl(210 40% 98%)' },
    destructive: { DEFAULT: 'hsl(0 72% 51%)', foreground: 'hsl(210 40% 98%)' }
  }}},
  plugins: []
};
export default config;
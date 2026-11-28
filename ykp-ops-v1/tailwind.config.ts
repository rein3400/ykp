import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'hsl(355 85% 47%)',
          fg: 'hsl(0 0% 100%)',
          strong: 'hsl(354 92% 36%)'
        },
        ink: 'hsl(0 0% 6%)',
        border: 'hsl(214 32% 91%)',
        muted: { DEFAULT: 'hsl(210 40% 96%)', foreground: 'hsl(215 16% 47%)' },
        card: { DEFAULT: 'hsl(0 0% 100%)', foreground: 'hsl(222 47% 11%)' },
        foreground: 'hsl(222 47% 11%)',
        background: 'hsl(0 0% 100%)',
        primary: {
          DEFAULT: 'hsl(222 47% 11%)',
          foreground: 'hsl(210 40% 98%)'
        },
        destructive: {
          DEFAULT: 'hsl(0 72% 51%)',
          foreground: 'hsl(210 40% 98%)'
        }
      }
    }
  },
  plugins: []
};

export default config;
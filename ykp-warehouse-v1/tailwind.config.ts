import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(214 32% 91%)',
        muted: { DEFAULT: 'hsl(210 40% 96%)', foreground: 'hsl(215 16% 43%)' }, // a11y: darkened from 47%→43% — #5c6b7f on #f8fafc = 5.19:1, on #f1f5f9 = 4.96:1 (axe flagged 4.48/4.28)
        card: { DEFAULT: 'hsl(0 0% 100%)', foreground: 'hsl(222 47% 11%)' },
        foreground: 'hsl(222 47% 11%)',
        background: 'hsl(0 0% 100%)',
        primary: { DEFAULT: 'hsl(222 47% 11%)', foreground: 'hsl(210 40% 98%)' },
        destructive: { DEFAULT: 'hsl(0 72% 51%)', foreground: 'hsl(210 40% 98%)' },
        warning: 'hsl(38 92% 50%)',
        success: 'hsl(142 71% 45%)'
      }
    }
  },
  plugins: []
};

export default config;
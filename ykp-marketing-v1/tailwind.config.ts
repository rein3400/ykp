import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'hsl(355 85% 47%)',
          fg: 'hsl(0 0% 100%)',
          strong: 'hsl(354 92% 36%)',
          soft: 'hsl(356 90% 96%)'
        },
        ink: 'hsl(0 0% 6%)'
      }
    }
  },
  plugins: []
};

export default config;

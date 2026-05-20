/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9efff',
          500: '#1b7cff',
          600: '#0052cc',
          700: '#003f9e',
        },
        aqua: { 500: '#00bcd4', 600: '#0097a7' },
      },
      boxShadow: { soft: '0 10px 30px rgba(15, 23, 42, 0.08)' },
      borderRadius: { card: '16px' },
    },
  },
  plugins: [],
};

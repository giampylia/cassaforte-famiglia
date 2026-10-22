/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        punch: '0 6px 24px -4px rgba(15, 23, 42, 0.14), 0 2px 6px -1px rgba(15, 23, 42, 0.08)',
        'punch-dark': '0 8px 28px -4px rgba(0, 0, 0, 0.45)',
      }
    },
  },
  plugins: [],
};

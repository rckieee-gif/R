/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', 
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Here is your custom color palette!
      colors: {
        primary: '#1D4ED8',      // Accessible app accent
        secondary: '#475569',    // Neutral support
        neutral: {
          light: '#F6F7F9',      // Backgrounds
          border: '#D7DCE3',     // Cards, borders
        },
        semantic: {
          danger: '#DC2626',     // Red
          success: '#16A34A',    // Green
          warning: '#F59E0B',    // Amber
          info: '#1D4ED8',       // Blue
        }
      }
    },
  },
  plugins: [],
}

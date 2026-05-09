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
        primary: '#6C5CE7',      // Soft Purple
        secondary: '#C9A84C',    // Muted Gold
        neutral: {
          light: '#F0F2F5',      // Backgrounds
          border: '#E4E6EB',     // Cards, borders
        },
        semantic: {
          danger: '#DC2626',     // Red
          success: '#16A34A',    // Green
          warning: '#F59E0B',    // Amber
          info: '#0EA5E9',       // Blue
        }
      }
    },
  },
  plugins: [],
}
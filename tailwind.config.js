// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",  // ← this line was missing
  ],
  theme: {
    extend: {
      fontFamily: {
        // Poppins is now the default sans family (loaded in index.html), so the
        // whole app renders in it consistently — not just elements that opted in
        // with the font-poppins class.
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
        poppins: ["Poppins", "sans-serif"],
      },
    },
  },
  plugins: [],
} 

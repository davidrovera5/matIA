/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        earth: {
          950: '#0f0a06',
          900: '#1a120b',
          800: '#261509',
          700: '#3b2012',
          600: '#5c3520',
          500: '#7a4a2e',
        },
        yerba: {
          300: '#bef264',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
          700: '#4d7c0f',
        },
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-yerba': '0 0 24px rgba(132, 204, 22, 0.55)',
        'glow-yerba-lg': '0 0 40px rgba(132, 204, 22, 0.65)',
      },
    },
  },
  plugins: [],
}

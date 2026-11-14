/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy:    { DEFAULT: '#1a3a5c', light: '#234876' },
        primary: { DEFAULT: '#4f46e5', light: '#eef2ff', hover: '#4338ca' },
        accent:  { DEFAULT: '#4f46e5', light: '#eef2ff', hover: '#4338ca' },
        uni: {
          border:  '#e2e8f0',
          bg:      '#f8fafc',
          muted:   '#64748b',
          success: '#10b981',
          warn:    '#f59e0b',
          danger:  '#ef4444',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

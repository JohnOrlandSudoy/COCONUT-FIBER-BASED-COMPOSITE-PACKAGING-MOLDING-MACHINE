/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'slide-in-from-right': 'slide-in-from-right 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
};

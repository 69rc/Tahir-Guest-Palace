/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdbff',
          300: '#8ec5ff',
          400: '#59a5ff',
          500: '#3382ff',
          600: '#1b62f5',
          700: '#144fe1',
          800: '#1741b6',
          900: '#193b8f',
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef1',
          200: '#d5d9e0',
          300: '#b0b8c5',
          400: '#8591a3',
          500: '#677488',
          600: '#525c70',
          700: '#434a5c',
          800: '#3a404e',
          900: '#1e222d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(30,34,45,0.04), 0 1px 3px 0 rgba(30,34,45,0.06)',
        pop: '0 4px 12px -2px rgba(30,34,45,0.12), 0 2px 4px -2px rgba(30,34,45,0.08)',
      },
    },
  },
  plugins: [],
};

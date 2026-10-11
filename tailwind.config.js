/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Epso Brand Colors matching the logo
        epso: {
          red: '#C6382B',
          'red-hover': '#B02A1F',
          'red-light': '#FDF2F2',
          amber: '#F59E0B',
          'amber-hover': '#D97706',
          orange: '#EA580C',
        },
        brand: {
          50: '#FDF2F2',
          100: '#FDE8E8',
          200: '#FBD5D5',
          300: '#F8B4B4',
          400: '#F05252',
          500: '#E02424',
          600: '#C6382B', // Epso Primary Red
          700: '#B02A1F',
          800: '#902017',
          900: '#771D1D',
          DEFAULT: '#C6382B',
        },
        // Legacy forest aliases gracefully mapped to brand / dark
        forest: {
          50: '#FDF2F2',
          100: '#FDE8E8',
          200: '#FBD5D5',
          300: '#F8B4B4',
          400: '#F05252',
          500: '#C6382B',
          600: '#B02A1F',
          700: '#C6382B',
          800: '#902017',
          900: '#771D1D',
          950: '#141212',
        },
        accent: {
          light: '#FDE68A',
          DEFAULT: '#F59E0B', // Epso Flame Amber
          dark: '#D97706',
        },
        canvas: {
          DEFAULT: '#F8F9FA', // Light canvas
          muted: '#F1F2F4',
          card: '#FFFFFF',
          dark: '#141212', // Dark background matching reference image
          'card-dark': '#1E1B1B', // Dark card
          'surface-dark': '#242020', // Elevated modal/popover
        },
        charcoal: {
          DEFAULT: '#141212', // Main dark text
          muted: '#6B7280',
          subtle: '#9CA3AF',
          border: '#E5E7EB',
          'border-dark': '#2E2828',
          'text-dark': '#FFFFFF',
          'muted-dark': '#A39E9B',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Malayalam"', 'Inter', 'system-ui', 'sans-serif'],
        malayalam: ['"Noto Sans Malayalam"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        none: 'none',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'apple-card': '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'apple-card-dark': '0 4px 20px rgba(0, 0, 0, 0.4)',
        'apple-modal': '0 20px 40px -15px rgba(0, 0, 0, 0.3)',
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring-snap': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}

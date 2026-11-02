/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // Primary accent #2563EB
          700: '#1d4ed8', // Accent hover #1D4ED8
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        slate: {
          25: '#fcfcfd',
          50: '#f8fafc',  // Main background #F8FAFC
          100: '#f1f5f9', // Muted background #F1F5F9
          200: '#e2e8f0', // Borders #E2E8F0
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b', // Secondary text #64748B
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#172033', // Primary text #172033
          950: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        sm: '0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.08)',
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
        lift: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}

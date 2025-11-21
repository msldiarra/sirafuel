import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // GasBuddy-inspired color palette
        primary: {
          teal: '#14B8A6', // Teal for headers and active states
          orange: '#F97316', // Orange for primary actions
          red: '#EF4444', // Red for urgent actions
        },
        background: {
          light: '#FDF6EC', // Cream background
          dark: '#0F172A', // Dark blue
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],      // 12px - Labels, timestamps
        'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }],  // 14px - Secondary text
        'base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],          // 16px - Body text
        'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }], // 18px - Card titles
        'xl': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],  // 20px - Section headers
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],     // 24px - Page titles
      },
    },
  },
  plugins: [],
}
export default config


/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brandGreen: '#00ED64',      // Primary green pill CTA
        brandGreenDark: '#00684A',  // Secondary green link color
        brandGreenSoft: '#E8F8F0',  // Mint background for featured items/success badges
        brandTealDeep: '#001E2B',   // Deep navy/teal for header bands, sidebars, footer
        brandTeal: '#00684A',       // Mid-spectrum teal
        canvas: '#FFFFFF',          // Clean white page backgrounds
        canvasDark: '#0B1A30',      // Code-block/mockup dark terminal background
        surface: '#F9FBFA',         // Sections and input borders
        ink: '#001E2B',             // Deep navy text
        slate: '#5C6F84',           // Muted description text
      },
      fontFamily: {
        sans: [
          'Euclid Circular A',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'Source Code Pro',
          'SF Mono',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      spacing: {
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
        section: '64px',
        'section-lg': '96px',
        hero: '120px',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        xxl: '24px',
      },
    },
  },
  plugins: [],
}

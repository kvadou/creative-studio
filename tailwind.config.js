/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './client/index.html',
    './client/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    // Add custom breakpoints
    screens: {
      'xs': '375px',  // Extra small - most phones
      'sm': '640px',  // Small - large phones/small tablets
      'md': '768px',  // Medium - tablets
      'lg': '1024px', // Large - laptops
      'xl': '1280px', // Extra large - desktops
      '2xl': '1536px', // 2X large - large desktops
    },
    extend: {
      colors: {
        // Acme Creative Brand Colors
        stc: {
          // Primary Purple
          purple: {
            50: '#F5F3F8',
            100: '#E8E3F0',
            200: '#D1C7E1',
            300: '#B4A3CC',
            400: '#967FB7',
            500: '#6A469D', // Main brand color
            600: '#5A3B85',
            700: '#4A306D',
            800: '#3A2555',
            900: '#2A1A3D',
          },
          // Light cyan-blue background
          bg: '#E8FBFF',
          // Accent colors
          blue: '#50C8DF',
          green: '#34B256',
          yellow: '#FACC29',
          orange: '#F79A30',
          pink: '#DA2E72',
          navy: '#2D2F8E',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px -2px rgba(106, 70, 157, 0.08), 0 4px 16px -4px rgba(106, 70, 157, 0.12)',
        'card-hover': '0 4px 12px -2px rgba(106, 70, 157, 0.12), 0 8px 24px -4px rgba(106, 70, 157, 0.16)',
        'glow': '0 0 20px rgba(106, 70, 157, 0.15)',
      },
      backgroundImage: {
        'gradient-header': 'linear-gradient(135deg, #6A469D 0%, #5A3B85 50%, #4A306D 100%)',
        'gradient-accent': 'linear-gradient(135deg, #50C8DF 0%, #6A469D 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

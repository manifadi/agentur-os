import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        surface: 'var(--bg-surface)',
        card: 'var(--bg-card)',
        input: 'var(--bg-input)',
        hover: 'var(--bg-hover)',
        subtle: 'var(--bg-subtle)',
        'sidebar-bg': 'var(--sidebar-bg)',
        'sidebar-border': 'var(--sidebar-border)',
        'sidebar-text': 'var(--sidebar-text)',
        'sidebar-text-hover': 'var(--sidebar-text-hover)',
        'sidebar-active-bg': 'var(--sidebar-active-bg)',
        'sidebar-active-text': 'var(--sidebar-active-text)',
        'sidebar-hover-bg': 'var(--sidebar-hover-bg)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-placeholder': 'var(--text-placeholder)',
        'border-default': 'var(--border-default)',
        'border-strong': 'var(--border-strong)',
        'border-subtle': 'var(--border-subtle)',
        // Kurz-Aliase: die App nutzt durchgehend `border-default` / `border-strong`
        // (statt `border-border-default`). Ohne diese Aliase fällt Tailwind auf
        // `currentColor` zurück → im Dark Mode rein-weiße Borders. Diese Aliase
        // mappen die Klassen korrekt auf die Theme-Tokens (hell + dunkel).
        default: 'var(--border-default)',
        strong: 'var(--border-strong)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          text: 'var(--accent-text)',
          subtle: 'var(--accent-subtle)',
          'subtle-hover': 'var(--accent-subtle-hover)',
        },
      },
      // Default-Border-Farbe auf Theme-Token statt Tailwinds currentColor —
      // verhindert weiße Borders im Dark Mode bei bloßem `border`/`border-t` etc.
      borderColor: {
        DEFAULT: 'var(--border-default)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        '2xl': 'var(--shadow-2xl)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
export default config;

import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          muted: "hsl(var(--sidebar-muted))",
        },
        ui: {
          info: "hsl(var(--ui-info))",
          text: {
            primary: "hsl(var(--ui-text-primary))",
            secondary: "hsl(var(--ui-text-secondary))",
            tertiary: "hsl(var(--ui-text-tertiary))",
            muted: "hsl(var(--ui-text-muted))",
          },
          border: {
            light: "hsl(var(--ui-border-light))",
            medium: "hsl(var(--ui-border-medium))",
          },
          surface: {
            subtle: "hsl(var(--ui-surface-subtle))",
            hover: "hsl(var(--ui-surface-hover))",
            selected: "hsl(var(--ui-surface-selected))",
          },
        },
        salary: {
          DEFAULT: "hsl(var(--salary-bg))",
          foreground: "hsl(var(--salary-foreground))",
        },
        linkedin: {
          DEFAULT: "hsl(var(--linkedin-bg))",
          foreground: "hsl(var(--linkedin-foreground))",
        },
        ai: {
          DEFAULT: "hsl(var(--ai-bg))",
          foreground: "hsl(var(--ai-foreground))",
          border: "hsl(var(--ai-border))",
        },
        locked: {
          DEFAULT: "hsl(var(--locked-bg))",
          border: "hsl(var(--locked-border))",
        },
        tag: {
          DEFAULT: "hsl(var(--tag-bg))",
          foreground: "hsl(var(--tag-foreground))",
        },
        contact: {
          DEFAULT: "hsl(var(--contact-bg))",
          foreground: "hsl(var(--contact-foreground))",
        },
        timeline: {
          current: "hsl(var(--timeline-current))",
          ring: "hsl(var(--timeline-ring))",
          past: "hsl(var(--timeline-past))",
          line: "hsl(var(--timeline-line))",
        },
        "current-badge": {
          DEFAULT: "hsl(var(--current-badge-bg))",
          foreground: "hsl(var(--current-badge-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

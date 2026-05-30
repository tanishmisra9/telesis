import type { Config } from "tailwindcss";
import { colors, radii, spacing, typography } from "./src/design/tokens";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: colors.canvas,
        "surface-1": colors.surface1,
        "surface-2": colors.surface2,
        "surface-3": colors.surface3,
        "surface-glass": colors.surfaceGlass,
        panel: colors.panel,
        glass: colors.glass,
        primary: colors.textPrimary,
        secondary: colors.textSecondary,
        tertiary: colors.textTertiary,
        text: colors.text,
        muted: colors.mutedText,
        hairline: colors.hairline,
        line: colors.hairline,
        accent: {
          DEFAULT: colors.accent,
          hover: colors.accentHover,
          pressed: colors.accentPressed,
          tint: colors.accentTint,
          ring: colors.accentRing,
          border: colors.accentBorder,
          contrast: colors.accentContrast,
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        hero: typography.sizes.hero,
        "section-title": typography.sizes.sectionTitle,
        "card-heading": typography.sizes.cardHeading,
        body: typography.sizes.body,
        "body-sm": typography.sizes.secondaryBody,
        "secondary-body": typography.sizes.secondaryBody,
        label: typography.sizes.label,
        caption: typography.sizes.caption,
        micro: typography.sizes.micro,
      },
      letterSpacing: {
        display: typography.tracking.display,
        hero: typography.tracking.hero,
        "section-title": typography.tracking.sectionTitle,
        "card-heading": typography.tracking.cardHeading,
        body: typography.tracking.body,
        micro: typography.tracking.micro,
      },
      lineHeight: {
        headline: typography.lineHeight.headline,
        body: typography.lineHeight.body,
      },
      borderRadius: {
        nav: radii.nav,
        card: radii.card,
        inner: radii.inner,
        pill: radii.pill,
      },
      spacing: {
        "page-x": spacing.pageXMobile,
        "page-x-md": spacing.pageXDesktop,
        "nav-offset": spacing.navOffset,
        section: spacing.section,
      },
      maxWidth: {
        content: spacing.maxContentWidth,
        prose: spacing.proseWidth,
      },
      boxShadow: {
        glass: "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 1px 2px rgba(0, 0, 0, 0.12), 0 10px 30px rgba(0, 0, 0, 0.24)",
        panel: "0 1px 1px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.28), 0 16px 40px rgba(0,0,0,0.22)",
        "panel-hover":
          "0 2px 2px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.38), 0 24px 56px rgba(0,0,0,0.28)",
        "accent-glow": "0 0 40px rgba(232, 163, 61, 0.14)",
        "ih-1": colors.ih1,
        "ih-2": colors.ih2,
        "ih-3": colors.ih3,
      },
      backdropBlur: {
        glass: "24px",
        modal: "32px",
        tooltip: "16px",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;

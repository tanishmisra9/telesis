export const colors = {
  canvas: "#0b0b0f",
  panel: "#15151b",
  glass: "rgba(20, 20, 25, 0.65)",
  text: "#f5f5f7",
  mutedText: "rgba(245, 245, 247, 0.62)",
  hairline: "rgba(255, 255, 255, 0.08)",
  innerHighlight: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
  accent: "#E8A33D",
  accentHover: "#F2B861",
  accentPressed: "#C98524",
  accentTint: "rgba(232, 163, 61, 0.14)",
  accentTintStrong: "rgba(232, 163, 61, 0.18)",
  accentRing: "rgba(232, 163, 61, 0.40)",
  accentBorder: "rgba(232, 163, 61, 0.30)",
  accentGlow: "0 0 40px rgba(232, 163, 61, 0.14)",
  accentContrast: "#2B1902",
  selection: "rgba(232, 163, 61, 0.18)",
  ghostHover: "rgba(255, 255, 255, 0.06)",
  rowHover: "rgba(255, 255, 255, 0.02)",
  topBandStart: "rgba(8, 8, 12, 0.62)",
  topBandMid: "rgba(8, 8, 12, 0.40)",
  topBandFade: "rgba(8, 8, 12, 0.16)",
} as const;

/** Circuit map visual layers (M4.5) */
export const circuit = {
  trackSurface: "#2a2a32",
  trackEdge: "rgba(255, 255, 255, 0.16)",
  sectorNeutral: "rgba(245, 245, 247, 0.45)",
  sector1: "#5B8DEF",
  sector2: "#E8A33D",
  sector3: "#6BCB8B",
  drs: "#E8A33D",
  chevron: "rgba(245, 245, 247, 0.55)",
  startFinish: "#f5f5f7",
  startFinishAccent: "#E8A33D",
} as const;

export const typography = {
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
  sizes: {
    hero: ["3.5rem", { lineHeight: "1.1" }],
    sectionTitle: ["2.125rem", { lineHeight: "1.15" }],
    cardHeading: ["1.3125rem", { lineHeight: "1.2" }],
    body: ["1.0625rem", { lineHeight: "1.65" }],
    secondaryBody: ["0.9375rem", { lineHeight: "1.6" }],
    label: ["0.8125rem", { lineHeight: "1.4" }],
    micro: ["0.6875rem", { lineHeight: "1.4" }],
  },
  weights: {
    regular: 400,
    medium: 500,
  },
  tracking: {
    hero: "-0.045em",
    sectionTitle: "-0.035em",
    cardHeading: "-0.015em",
    body: "-0.01em",
    secondaryBody: "0",
    label: "0",
    micro: "0.01em",
  },
  lineHeight: {
    headline: "1.15",
    body: "1.65",
  },
} as const;

export const spacing = {
  maxContentWidth: "1360px",
  proseWidth: "760px",
  pageXMobile: "1.75rem",
  pageXDesktop: "2.5rem",
  pageBottom: "5rem",
  navOffset: "7rem",
  section: "2.5rem",
  topBandHeight: "126px",
} as const;

export const radii = {
  pill: "9999px",
  nav: "24px",
  card: "16px",
  inner: "12px",
  circle: "50%",
} as const;

export const shadows = {
  innerHighlight: colors.innerHighlight,
  glass:
    "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 1px 2px rgba(0, 0, 0, 0.12), 0 10px 30px rgba(0, 0, 0, 0.24)",
  panel:
    "0 1px 1px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.28), 0 16px 40px rgba(0,0,0,0.22)",
  panelHover:
    "0 2px 2px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.38), 0 24px 56px rgba(0,0,0,0.28)",
  accentGlow: colors.accentGlow,
} as const;

export const blur = {
  nav: "24px",
  topBand: "26px",
  modal: "32px",
  input: "24px",
  tooltip: "16px",
  pageTransition: "16px",
} as const;

export const easing = {
  apple: [0.22, 1, 0.36, 1] as const,
  pageTransition: {
    duration: 0.42,
    ease: [0.22, 1, 0.36, 1] as const,
  },
  stagger: {
    duration: 0.26,
    delayStep: 0.025,
    ease: [0.22, 1, 0.36, 1] as const,
  },
  hover: {
    duration: 0.2,
  },
} as const;

export const springs = {
  interactive: { type: "spring" as const, stiffness: 400, damping: 32 },
  layout: { type: "spring" as const, stiffness: 260, damping: 28 },
  scroll: { type: "spring" as const, stiffness: 180, damping: 28 },
} as const;

export const pageTransition = {
  initial: { opacity: 0, filter: "blur(16px)" },
  animate: { opacity: 1, filter: "blur(0px)" },
  exit: { opacity: 0, filter: "blur(8px)" },
  transition: easing.pageTransition,
} as const;

# Apple-Inspired Dark UI Design System
### A reusable design prompt for communicating frontend style preferences

---

## Overview

This design system is inspired by Apple's dark-mode aesthetic — refined, intentional, and confident. It is not a copy of Apple's products, but a philosophical translation: deep dark canvases, frosted glass surfaces, restrained typography, physics-based motion, and a single warm accent color. Everything is built to feel quiet and premium, never loud or cluttered.

The guiding principle is **purposeful minimalism**: every element earns its place. Negative space is used generously. Animations exist to orient the user, not to entertain them.

---

## Color Palette

### Core Tokens

| Token | Value | Usage |
|---|---|---|
| `--canvas` | `#0b0b0f` | Root page background — near-black with a faint cool tint |
| `--panel` | `#15151b` | Card and surface backgrounds — one step above canvas |
| `--glass` | `rgba(20, 20, 25, 0.65)` | Frosted glass elements (navbars, modals, inputs) |
| `--text` | `#f5f5f7` | Primary text — Apple's warm off-white, never pure white |
| `--muted-text` | `rgba(245, 245, 247, 0.62)` | Secondary text, placeholders, metadata |
| `--hairline` | `rgba(255, 255, 255, 0.08)` | Borders, dividers, subtle outlines |
| `--inner-highlight` | `inset 0 1px 0 rgba(255, 255, 255, 0.06)` | Top-edge light sheen on glass panels |

### Accent Color

A single warm amber-gold is the only expressive color in the system. It should be used sparingly — on icons, active states, tags, focus rings, and CTAs.

| Token | Value | Usage |
|---|---|---|
| `accent` | `#E8A33D` | Default accent — warm amber |
| `accent-hover` | `#F2B861` | Lightened on hover |
| `accent-pressed` | `#C98524` | Darkened on active/press |
| `accent-tint` | `rgba(232, 163, 61, 0.12–0.18)` | Background tints for active pills, badges, icon containers |
| `accent-ring` | `rgba(232, 163, 61, 0.40)` | Focus ring color |
| `accent-border` | `rgba(232, 163, 61, 0.30)` | Subtle outlined badges |
| `accent-glow` | `0 0 40px rgba(232, 163, 61, 0.14)` | Ambient glow on icon containers |

### Philosophy
- The palette is dark, near-monochromatic, and intentionally limited.
- Never use more than one accent color.
- Avoid gradients on text or backgrounds. Depth comes from shadows and blur, not color gradients.
- Use the accent at low opacity (`0.10–0.18`) for background tints, never full saturation except on the accent element itself.
- Text selection highlight: `rgba(232, 163, 61, 0.18)`.

---

## Typography

### Font Stack

```css
font-family: Inter, -apple-system, BlinkMacSystemFont,
  "SF Pro Text", "SF Pro Display",
  system-ui, sans-serif;
```

Inter is used as the primary web font. On Apple devices, the system will naturally fall back to SF Pro. This gives the design a native feel on macOS and iOS without licensing SF Pro directly.

Enable OpenType features for refined rendering:

```css
font-feature-settings: "ss01", "cv11";
text-rendering: optimizeLegibility;
```

### Type Scale

| Role | Size | Weight | Tracking | Notes |
|---|---|---|---|---|
| Hero / Display | `56–70px` | `500` (medium) | `-0.045em` | Page titles, landing headlines |
| Section Title | `34–42px` | `500` | `-0.035em` | View headers |
| Card Heading | `19–22px` | `500` | `-0.015em` | Panel and card titles |
| Body | `17–19px` | `400` | `-0.01em` | Descriptive paragraph text |
| Secondary Body | `15–16px` | `400` | `0` | Metadata, subtitles |
| Label / Caption | `13–14px` | `400–500` | `0` | Badges, tags, nav items |
| Micro | `11–12px` | `400` | `+0.01em` | Keyboard shortcuts, timestamps |

### Philosophy
- Use `font-weight: 500` (medium) for headlines — never bold (`700`) unless a single word needs emphasis.
- Negative letter-spacing is essential on large type. The tighter the tracking, the more Apple the feel.
- Line height on body copy: `1.6–1.75`. On headlines: `1.1–1.2`.
- Avoid uppercase text except for keyboard shortcut labels.
- Never underline links. Use `color: inherit` and let hover states or context indicate interactivity.

---

## Glassmorphism and Surfaces

Glass is the most distinctive element of this design language. It should feel like a frosted panel floating above a dark canvas, not a transparent overlay.

### Glass Surface Recipe

```css
.glass-surface {
  background: rgba(20, 20, 25, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),  /* top-edge inner highlight */
    0 1px 2px rgba(0, 0, 0, 0.12),
    0 10px 30px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}
```

### Blur Values by Context

| Context | Blur Amount | Saturation |
|---|---|---|
| Navigation bar | `blur(24px)` | default |
| Page-top fade band | `blur(26px) saturate(112%)` | slightly boosted |
| Modal / drawer | `blur(32px)` | default |
| Input fields | `backdrop-blur-2xl` (24px) | default |
| Tooltip | `blur(16px)` | default |

### Top-of-Page Fade Band

A tall frosted gradient band is pinned to the top of the viewport and fades from opaque at the top to transparent at the bottom. It creates the illusion that the navbar is melting into the page content.

```css
.top-glass-band {
  position: fixed;
  inset: 0 0 auto 0;
  height: 126px;
  background: linear-gradient(
    180deg,
    rgba(8, 8, 12, 0.62) 0%,
    rgba(8, 8, 12, 0.40) 42%,
    rgba(8, 8, 12, 0.16) 74%,
    rgba(8, 8, 12, 0.00) 100%
  );
  backdrop-filter: blur(26px) saturate(112%);
  mask-image: linear-gradient(
    180deg,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,0.96) 72%,
    rgba(0,0,0,0) 100%
  );
}
```

### Panel Shadows

Cards and panels use multi-layer shadows for realistic depth:

```css
/* Resting state */
box-shadow:
  0 1px 1px rgba(0,0,0,0.18),
  0 4px 12px rgba(0,0,0,0.28),
  0 16px 40px rgba(0,0,0,0.22);

/* Hover / elevated state */
box-shadow:
  0 2px 2px rgba(0,0,0,0.22),
  0 8px 24px rgba(0,0,0,0.38),
  0 24px 56px rgba(0,0,0,0.28);
```

---

## Border Radius

Apple uses generous, consistent corner radii. Avoid mixing shapes.

| Element | Radius |
|---|---|
| Pill buttons and inputs | `9999px` (fully rounded) |
| Navigation bar | `24px` |
| Cards / panels | `16px` |
| Inner components | `12px` |
| Small chips / tags | `9999px` (pill) |
| Icon containers | `50%` (circle) |

---

## Motion and Animation

Motion is **physics-based, not duration-based**. Use spring animations everywhere interactive elements move. Reserve eased transitions for fades and page transitions.

### Framer Motion Defaults

**Spring — interactive elements (nav, scroll-driven, input resize):**
```js
{ type: "spring", stiffness: 400, damping: 32 }
```

**Spring — layout / indicator pills:**
```js
{ type: "spring", stiffness: 260, damping: 28 }
```

**Spring — scroll-linked opacity / blur:**
```js
useSpring(value, { stiffness: 180, damping: 28 })
```

**Ease — page transitions, content reveals:**
```js
{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }
```
This is a custom ease that accelerates fast and decelerates smoothly — similar to `easeOutExpo`.

**Ease — entry stagger (list items, cards):**
```js
{ duration: 0.26, delay: index * 0.025, ease: [0.22, 1, 0.36, 1] }
```

### Page Transition (Blur Fade)

Pages enter and exit with a blur-fade. This is the most Apple-native transition effect — used in iOS app launches and macOS Spotlight.

```js
initial: { opacity: 0, filter: "blur(16px)" }
animate: { opacity: 1, filter: "blur(0px)" }
exit:    { opacity: 0, filter: "blur(8px)" }
transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
```

### Scroll-Driven Nav Compaction

The navbar compacts (reduces padding, shrinks text) when the user scrolls down, and restores when they scroll back up. The transition is spring-based so it feels physical, not mechanical.

```js
// Detect direction + threshold
if (value < 16) setCompact(false);
else if (goingDown && value > 42) setCompact(true);
else if (!goingDown) setCompact(false);

// Animate padding with spring
animate={{ paddingTop: compact ? 11 : 14 }}
transition={{ type: "spring", stiffness: 400, damping: 32 }}
```

### Hover States

- Cards and list rows lift slightly on hover: `y: -1` with `duration: 0.2`.
- Background tints appear via `transition-colors duration-200` — never instant.
- Ghost buttons use `rgba(255,255,255,0.06)` as hover background on dark.

### Staggered Entry Animations

All lists, grids, and sequences of items should enter with a staggered delay:

```js
// Each item
initial={{ opacity: 0, y: -10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: index * 0.025, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
```

### Reduced Motion

Always respect `prefers-reduced-motion`. Provide a fallback that uses only opacity fades with no transforms or blur:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

In Framer Motion: pass `undefined` for animation props when `useReducedMotion()` returns `true`.

---

## Component Patterns

### Buttons

Three variants: primary, secondary, ghost.

- **Primary**: Filled amber accent, pill shape, dark contrasting text (`#2B1902`). Shadow applied. Never use white text on the accent color.
- **Secondary**: Glass surface, pill shape, hairline border, backdrop blur.
- **Ghost**: No border, no background. Rounded-xl. Subtle hover tint. Used for icon buttons and nav items.

All buttons use `font-size: 14px`, `font-weight: 500`, `transition duration-200`.

Focus rings use the accent color at 40% opacity: `rgba(232, 163, 61, 0.40)`.

### Inputs

Pill-shaped (`border-radius: 9999px`), glass background with `backdrop-blur-2xl`, hairline border.

Focus state: accent-tinted ring, `rgba(232, 163, 61, 0.40)`.

Keyboard shortcut hints (e.g. `⌘K`) appear as small pill-shaped labels at the trailing edge of the input, using `text-muted` and a hairline border.

### Navigation Bar

- Fixed, floating, pill/rounded-rectangle shaped.
- Glass surface with `blur(24px)`.
- The active nav item uses a `layoutId` animated background pill (Framer Motion `layoutId="active-nav-pill"`) to animate smoothly between links.
- Active background: `rgba(232, 163, 61, 0.14)` with an `inset` shadow border at `rgba(232, 163, 61, 0.18)`.
- Active text: full `--text`. Inactive text: `--muted-text` with `hover:text-text`.

### Tags / Badges

Two styles:
1. **Accent badge**: `bg-[rgba(232,163,61,0.12)]`, `border border-[rgba(232,163,61,0.30)]`, `text-accent`, pill shape, `13px`.
2. **Neutral chip**: `bg-glass`, `border border-line`, `text-muted`, pill shape.

### Cards / Rows

- Cards: `bg-panel`, `border border-line`, `rounded-[16px]`, multi-layer shadow.
- List rows: full-width, `border-b border-line`, `py-6 px-2`. Subtle `rgba(255,255,255,0.02)` hover background.
- Row hover: `y: -1` via Framer Motion `whileHover`.

### Dividers

A thin `<div>` with `border-t border-line opacity-40` or just `border-line`. Often given a fixed `w-16` centered width for decorative section breaks.

### Icon Containers

Circular containers with an accent tint background and an optional ambient glow shadow:

```jsx
<div className="flex h-24 w-24 items-center justify-center rounded-full
  bg-[rgba(232,163,61,0.10)]
  shadow-[0_0_40px_rgba(232,163,61,0.14)]">
  <Icon size={50} strokeWidth={1.5} className="text-accent" />
</div>
```

Icon stroke weight: always `strokeWidth={1.5}`. Never filled icons except for status indicators.

---

## Layout and Spacing

- **Max content width**: `1360px`, centered with `mx-auto`.
- **Horizontal padding**: `px-7` mobile, `md:px-10` desktop.
- **Vertical page padding**: `pb-20`.
- **Nav offset**: page content starts at `pt-28` to account for fixed navbar height.
- **Section spacing**: `gap-10` or `space-y-10` between major sections.

Spacing is generous. Allow content to breathe. A centered, narrow column (`max-w-[760px]`) is preferred for text-heavy views like landing pages and chat interfaces.

---

## Writing and UX Copy

Apple's copy is short, confident, and warm. Apply these rules:

- Headlines are sentence case, never ALL CAPS.
- Taglines are poetic and brief, not feature-lists.
- Placeholder text is instructional but inviting (e.g. "Search title or abstract").
- Empty states use a large headline (`48–62px`) and a short subtitle (`17px muted`), nothing more.
- Error messages are calm and human, not technical.
- Avoid exclamation points.

---

## Accessibility

- All interactive elements have focus-visible rings using the accent color.
- `prefers-reduced-motion` is respected universally — animations degrade to opacity-only.
- Color contrast: `--text` (`#f5f5f7`) on `--canvas` (`#0b0b0f`) passes WCAG AA at all type sizes.
- `aria-pressed` for toggle buttons. `aria-hidden` for decorative elements.
- Never rely solely on color to communicate state — use shape, position, or text as backup.

---

## Implementation Stack (Reference)

| Layer | Choice |
|---|---|
| Framework | React + TypeScript |
| Styling | Tailwind CSS with CSS custom properties |
| Animation | Framer Motion (`motion`, `AnimatePresence`, `useSpring`, `useTransform`, `useReducedMotion`) |
| Icons | Lucide React (`strokeWidth={1.5}` throughout) |
| Font | Inter via Google Fonts |
| Build | Vite |

---

## Summary Checklist

When starting a new project in this style, verify:

- [ ] Canvas is near-black with a cool undertone (`#0b0b0f` or equivalent)
- [ ] A single warm accent color is defined — amber, not blue or purple
- [ ] All interactive surfaces use glass + `backdrop-filter: blur(24px+)`
- [ ] Typography uses Inter or SF Pro, with negative tracking on large headings
- [ ] Buttons are pill-shaped with glass or accent fill
- [ ] Animations use spring physics for interactive elements, eased curves for content
- [ ] Page transitions use blur-fade (`filter: blur(16px)` to `blur(0px)`)
- [ ] Nav item active states use an animated `layoutId` pill
- [ ] `prefers-reduced-motion` disables all transforms and blur animations
- [ ] All focus rings use the accent color at 40% opacity
- [ ] Spacing is generous — content never feels cramped
- [ ] Copy is short, confident, lowercase-first, no exclamation points

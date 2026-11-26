# UI/UX Design Checklist for the xTrails apps

Source: teardown of happycad.ai (YC) on 2026-11-19, plus the common patterns of current YC-style product sites. Mapped to our stack (Vite + React 19 + TypeScript) and the xTrails design system.

## 1. What happycad.ai actually does (measured, not guessed)

| Technique | How they do it |
|---|---|
| Framework | Next.js (Turbopack build), Tailwind CSS |
| Smooth scroll | Lenis (`<html class="lenis">`) |
| 3D hero | `robot-dog.glb` rendered into `<canvas>` (WebGL, bundled, likely react-three-fiber) |
| Interactive hero | Prompt box with a cycling example prompt, 5 example chips that swap the 3D model and its spec card |
| Typography | One family (Archivo), H1 weight 600, negative tracking (-0.035em), short 2-line promise |
| Background | Light grey `#F9FAFB`, dotted grid, one soft radial colour glow behind the hero |
| Surfaces | Floating pill nav, "glass" cards with layered shadows: inset white top highlight + 1px hairline ring + long soft drop shadow |
| Buttons | Pill radius, 12/24 padding, `transition: transform .5s, background .5s` with `cubic-bezier(.4,0,.2,1)` |
| Proof instead of claims | Real product UI as illustration: feature tree, stress numbers, safety factor, file list with sizes |
| Narrative | Numbered 4-step "how it works", example gallery (swipe shelf), old-way vs new-way comparison, audience sections, privacy facts, CTA |
| Accessibility | Has `prefers-reduced-motion` rules |
| Not used | GSAP, Framer site builder, Webflow, video, View Transitions, scroll-driven CSS |

**Takeaway:** the "wow" is not one library. It is (a) one live, interactive object in the hero, (b) real data shown as UI, (c) restrained type and colour, (d) small physical motion everywhere, (e) high polish on shadows, spacing and timing.

## 2. Visual foundation

- [ ] One heading family, one text family, one mono for numbers (we have: Space Grotesk / Inter / JetBrains Mono)
- [ ] Headings: weight 600-700, letter-spacing -0.02 to -0.04em, line-height 1.05-1.15
- [ ] Body 15-17px, line-height 1.5-1.6, max line length 60-75 characters
- [ ] Fluid type with `clamp()` (e.g. H1 `clamp(2.25rem, 5vw, 4.5rem)`)
- [ ] Tabular numbers (`font-variant-numeric: tabular-nums`) in stats, tables, counters
- [ ] Neutral palette carries 90% of the screen; accent only for action and selection
- [ ] Colours defined in OKLCH so light/dark and tints stay perceptually even
- [ ] Spacing on a 4/8 scale only; generous section padding (96-160px desktop)
- [ ] Hairline borders (1px, low contrast) instead of heavy boxes
- [ ] Subtle texture: dot grid or noise at 3-6% opacity, one radial accent glow per hero
- [ ] Consistent radius set (controls, cards, chips); nested radius = outer minus padding
- [ ] Icons from one set, one stroke width (e.g. Lucide 1.5px)

## 3. Depth and surfaces

- [ ] Layered shadow recipe: inset top highlight + 1px ring + long soft drop shadow with negative spread
- [ ] Glass only where content scrolls under it (nav, map panels): `backdrop-filter: blur(12-20px)` + semi-opaque fill
- [ ] Floating pill navigation that shrinks or gains a border after scroll
- [ ] Elevation has 3 levels max (flat, raised, floating)
- [ ] Dark mode is designed, not inverted: lighter surfaces for elevation, reduced shadow, desaturated accent

## 4. Motion and interaction

- [ ] One easing family: `cubic-bezier(.2,.8,.2,1)` for entrances, `(.4,0,.2,1)` for state changes
- [ ] Durations: 120-200ms for hover/press, 250-400ms for panels, 500-800ms for hero entrances
- [ ] Entrance: fade + 8-16px rise, staggered 40-80ms, triggered once on scroll into view
- [ ] Buttons: hover lift (translateY -1px), press scale(.98), focus ring visible
- [ ] Cards: hover lift + shadow grow; optional pointer-follow highlight (radial gradient at cursor)
- [ ] Hero prop tilts toward the pointer (3D `rotateX/Y`, max 6-10deg)
- [ ] Number counters animate on change (NumberFlow-style rolling digits)
- [ ] Smooth scroll (Lenis) only on marketing pages, never inside the app or map
- [ ] Shared-element transitions between list and detail (View Transitions API or Motion `layoutId`)
- [ ] Scroll-linked effects (progress bar, sticky step highlighting) via CSS `animation-timeline: view()` with JS fallback
- [ ] Optimistic UI: actions reflect instantly, sync in background, undo toast instead of confirm dialogs
- [ ] Skeletons shaped like the real content, no spinners for under 1s loads
- [ ] `prefers-reduced-motion`: disable tilt, parallax, smooth scroll and staggers; keep opacity fades
- [ ] Animate only `transform` and `opacity`; never width/height/top/left

## 5. Landing page structure (YC pattern)

- [ ] Hero: one promise in under 10 words, one sentence of how, one primary CTA
- [ ] Hero contains a live, interactive product element (not a static screenshot)
- [ ] Example chips that swap the hero content (try-before-signup)
- [ ] Numbered "how it works" in 3-4 steps, each with real UI, not icons
- [ ] Gallery of concrete examples (horizontal snap-scroll shelf on mobile)
- [ ] Old way vs new way comparison, same task both sides
- [ ] Audience sections: one per user type, each with its own mini demo
- [ ] Trust: team background, privacy facts in plain words, no invented numbers or logos
- [ ] Pricing or "free to start" stated plainly
- [ ] Final CTA repeats the hero CTA

## 6. App UX (inside the product)

- [ ] One primary action per screen; everything else secondary or a link
- [ ] Empty states teach: what this is, one example, one button
- [ ] Command palette (Ctrl/Cmd+K) for navigation and actions
- [ ] Keyboard shortcuts for frequent actions, shown in tooltips
- [ ] Inline editing instead of separate edit pages
- [ ] Toasts for results, with undo; dialogs only for destructive or irreversible actions
- [ ] Bottom sheets on mobile instead of modals (drag to dismiss)
- [ ] Forms: labels above fields, inline validation on blur, errors say how to fix
- [ ] Persist UI state (filters, tabs, map position) across reloads
- [ ] Progressive disclosure: advanced options collapsed by default
- [ ] Response under 100ms for any direct manipulation; show progress for anything over 1s

## 7. Accessibility and quality

- [ ] Contrast WCAG AA minimum (4.5:1 text, 3:1 UI), checked in both themes
- [ ] Visible focus ring on every interactive element (`:focus-visible`)
- [ ] 44px minimum touch targets
- [ ] Full keyboard navigation, logical tab order, Esc closes overlays
- [ ] Semantic HTML and ARIA only where native elements fall short
- [ ] Layout works at 320px width, no horizontal scroll
- [ ] Respect `prefers-color-scheme` and `prefers-reduced-motion`

## 8. Performance (polish users feel)

- [ ] LCP under 2.5s, INP under 200ms, CLS under 0.1
- [ ] Fonts self-hosted, `woff2`, preloaded, `font-display: swap`, metric-matched fallback
- [ ] 3D/WebGL hero lazy-loaded with a static poster image first; paused when off-screen
- [ ] Images in AVIF/WebP with explicit width/height
- [ ] Route-level code splitting; heavy libs (deck.gl, three) never in the landing bundle
- [ ] Prefetch next likely route on hover

## 9. Technology options for our stack (Vite + React 19)

| Need | Option | Notes |
|---|---|---|
| Styling system | Keep current CSS tokens, or Tailwind CSS v4 | Tailwind matches what most YC sites use; migration cost is high (48 KB of existing CSS) |
| Components | Radix UI primitives / shadcn/ui | Accessible dialogs, menus, tooltips; shadcn assumes Tailwind |
| Animation | `motion` (formerly Framer Motion) | Entrances, layout animations, gestures, `layoutId` |
| Smooth scroll | `lenis` | Landing pages only |
| 3D hero | `three` + `@react-three/fiber` + `@react-three/drei` | Same approach as happycad; heavy, lazy-load |
| Animated numbers | `@number-flow/react` | Rolling digit counters |
| Command palette | `cmdk` | Ctrl/Cmd+K |
| Toasts | `sonner` | Undo toasts |
| Mobile sheets | `vaul` | Drag-to-dismiss bottom sheets |
| Icons | `lucide-react` | One consistent stroke set |
| Native, no library | View Transitions API, CSS scroll-driven animations, `@starting-style`, container queries | Zero bundle cost; check browser support per feature |

## 10. Decisions for you to specify

Answer these and I will apply the system:

1. **Scope:** landing page only, in-app UI only, or both? Which app first (CrowdTrails here, then the other four)?
2. **Styling:** keep our CSS tokens, or migrate to Tailwind v4 + shadcn/ui?
3. **Shadows:** the xTrails rule is "no card shadows". Keep it, or adopt happycad-style layered shadows on cards?
4. **Background:** add dot grid + radial accent glow?
5. **Hero object:** 3D (three.js, heavy) or a live 2D interactive (e.g. animated map with trails drawn between contacts)?
6. **Motion level:** subtle (fades, hover lifts) / medium (+ tilt, counters, shared transitions) / rich (+ 3D, smooth scroll, scroll-linked steps)?
7. **App features:** which of command palette, undo toasts, bottom sheets, skeletons, optimistic updates?
8. **Libraries:** which rows of section 9 are allowed?

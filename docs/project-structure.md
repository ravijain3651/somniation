# Somniation: Project Structure

Snapshot of the codebase so it doesn't need to be re-read. Update it when structure changes.
Last analyzed: 2026-09-20 (commit 4ebb983, branch `main`).

## What it is
Marketing website for Somniation, an IT services company. Angular 22, standalone components, signals,
Tailwind CSS v4, statically prerendered, deployed on Vercel. There is no backend and no Firebase yet
(see `/plan.md` for the planned timesheet/invoicing system).

## Stack and tooling
- Angular `^22.1` (`@angular/build:application` builder, `outputMode: "static"`, SSR prerender of all routes)
- Tailwind CSS v4 via `@tailwindcss/postcss` (`.postcssrc.json`); component style language is CSS
- Tests: `ng test` (`@angular/build:unit-test`, Vitest + jsdom). Only `src/app/app.spec.ts` exists.
- TypeScript `~6.0`, strict-ish flags (`noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns`)
- Prettier is installed, but there is no prettier config file
- npm scripts: `start` (ng serve, port 4200), `build`, `watch`, `test`
- Deploy: `vercel.ts` builds with `ng build`, serves `dist/somniation/browser` as a plain static site
  (`framework: null`), and rewrites everything to `/index.csr.html`. The Vercel Angular preset is
  bypassed on purpose (see the comment in the file).
- Prod build budgets: initial 500kB warn / 1MB error; component style 12kB warn / 20kB error
- Gitignored: `dist`, `.angular/cache`, `.env*` (`.env.local` holds a Vercel OIDC token; never print it), `.vercel`
- `.agents/skills` and `.claude/skills` hold the Angular skills (`skills-lock.json` pins them). `.vscode/mcp.json` configures the Angular CLI MCP server.
- README says "hand-rolled SCSS design tokens", which is stale: the styles are Tailwind v4 plus CSS custom properties in `src/styles.css`.

## Repository layout
```
angular.json, package.json, tsconfig*.json, vercel.ts, .postcssrc.json
plan.md                      Planned timesheet/invoicing feature (not implemented)
docs/                        This documentation
assets/brand-source/         Source logo/icon images (not served)
public/                      Static assets served from site root
  favicon*.png/svg, apple-touch-icon.png
  images/*.webp|jpg          Section photos (analytics, code, datacenter, hero-poster, meeting, mission,
                             office, security, support, team-collab)
  images/brand/logo.png      Full logo lockup; icon.png = icon only (og:image uses logo.png)
  videos/hero-digital.mp4    Home hero video
src/
  index.html                 Meta/OG tags, favicons, inline script that sets data-theme before first paint
  main.ts / main.server.ts   Bootstrap (browser / server)
  styles.css                 Global styles (see below)
  app/                       See next section
```

## `src/app`
```
app.ts, app.html             Root shell: <app-header/> <main><router-outlet/></main> <app-footer/>.
                             app.html also holds the hidden SVG icon sprite (<symbol id="i-...">)
app.config.ts                provideRouter (scroll restore 'top', anchor scrolling), client hydration with
                             event replay, app initializer sets ViewportScroller offset [0, 92] for the sticky header
app.config.server.ts         Merges appConfig with provideServerRendering(withRoutes(serverRoutes))
app.routes.ts                Lazy loadComponent routes with titles: '', services, about, contact, '**' -> NotFound
app.routes.server.ts         '**' -> RenderMode.Prerender
app.spec.ts                  Tests that the app renders the header brand and footer

core/
  data.ts                    Typed content constants: SERVICES, STATS, MILESTONES, VALUES, PROCESS,
                             TECH_PARTNERS, FAQS (plus their interfaces). Icon names map to sprite ids.
  contact-info.service.ts    ContactInfoService.info signal: address/phone/email decoded (reversed base64) only
                             in the browser after hydration, to hide them from scrapers. null during SSR.
  theme.service.ts           ThemeService: theme signal ('light'|'dark'), localStorage key 'somniation-theme',
                             falls back to OS preference, sets <html data-theme>, toggle()
  reveal.directive.ts        [reveal] with revealDelay input: fade/slide-up on scroll (IntersectionObserver)
  count-up.directive.ts      [countUp] with decimals input: number animation on scroll
  tilt.directive.ts          [tilt]: hover tilt effect
  parallax.directive.ts      [parallax]: parallax on scroll
  scroll-zoom.directive.ts   [scrollZoom]: zoom on scroll
                             All directives use afterNextRender, so they are no-ops on the server and with
                             prefers-reduced-motion.

layout/
  header/                    Sticky header (host class 'sticky top-0 z-[100]'), nav links, mobile menu,
                             theme toggle, scrolled-state signal
  footer/                    Footer: services list from SERVICES, ContactInfoService, current year

pages/                       One standalone component per route (each with .ts + .html, no separate .css)
  home/                      Hero, services overview, stats, differentiators, process, testimonials,
                             tech partners, CTA
  services/                  Six service sections, anchor-linkable (/services#cybersecurity)
  about/                     Mission, values, leadership, timeline
  contact/                   Signal Forms contact form (form/FormField/required/minLength/email/submit from
                             '@angular/forms/signals'); no backend, submit only sets sent=true. Contact info
                             card, FAQ accordion.
  not-found/                 404
```

## Conventions observed
- Standalone components, `ChangeDetectionStrategy.OnPush`, `templateUrl` with a separate `.html`, selector prefix `app-`
- Signals for state (`signal`, `input`, `input.required`); `inject()` for DI; built-in control flow
- Browser-only work goes in `afterNextRender` or behind `isPlatformBrowser`, so prerender stays safe
- Fully static prerender: no hydration mismatches, so anything browser-dependent renders after hydration
- Icons: `<svg><use href="#i-name"/></svg>` referencing the sprite in `app.html`; add new icons there
- Content lives in `core/data.ts`, not in templates
- Styling: Tailwind utilities in templates plus tokens/shared component classes in `src/styles.css`

## `src/styles.css` layout
1. `@import 'tailwindcss'`
2. `:root` and `:root[data-theme='dark']` design tokens: `--bg --surface --surface-2 --text --text-2 --muted --border --primary --primary-hover --primary-contrast --primary-soft --accent --gradient --elev-* --header-h`
3. `@custom-variant dark`, which follows `data-theme`, not the OS preference
4. `@theme inline` and `@theme`, which map tokens into Tailwind namespaces
5. `/* Base */`, then `/* Shared components */` (reusable classes)

## Implications for the planned timesheet feature (`plan.md`)
- No `environment` files, Firebase packages or `firebase.json` exist yet.
- The build is fully static prerender with catch-all `RenderMode.Prerender`. Authenticated routes
  (`/login`, `/timesheet`, `/admin`) should use `RenderMode.Client` in `app.routes.server.ts`, and
  Firebase init must be browser-only.
- `vercel.ts` already rewrites unknown paths to `/index.csr.html`, so client-only routes work in production.
- The bundled logo for invoices can live in `public/images/brand/` (`logo.png` already exists).
- Header nav links are a hard-coded `links` array in `header.ts`; a login/timesheet link would go there.
- `provideClientHydration` is on. Auth state must not change server-rendered markup.

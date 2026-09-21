# Somniation: Project Structure

Snapshot of the codebase so it doesn't need to be re-read. Update it when structure changes.
Last analyzed: 2026-09-20 (branch `feature/auth-timesheet-invoice`).

## What it is
Marketing website for Somniation, an IT services company. Angular 22, standalone components, signals,
Tailwind CSS v4, statically prerendered, deployed on Vercel. The public site has no backend; the
employee timesheet/invoicing system (`/login`, `/timesheet`, `/admin`) uses Firebase (see `/plan.md`).

## Stack and tooling
- Angular `^22.1` (`@angular/build:application` builder, `outputMode: "static"`, SSR prerender of all routes)
- Tailwind CSS v4 via `@tailwindcss/postcss` (`.postcssrc.json`); component style language is CSS
- Tests: `ng test` (`@angular/build:unit-test`, Vitest + jsdom). Only `src/app/app.spec.ts` exists.
- TypeScript `~6.0`, strict-ish flags (`noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns`)
- Prettier is installed, but there is no prettier config file
- npm scripts: `start` (ng serve, port 4200), `build`, `watch`, `test`, `emulators` (Firebase emulators with `./emulator-data` import/export)
- The Angular CLI needs Node >= 22.22 (run `nvm use node`). Java is needed for the Firestore emulator.
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
plan.md                      Timesheet/invoicing plan (sections 1-6 implemented; 7 production rollout deferred)
firebase.json, .firebaserc, firestore.rules, storage.rules, firestore.indexes.json   Emulator + security rules
emulator-data/               Emulator import/export dir (contents gitignored)
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
app.routes.ts                Lazy loadComponent routes with titles: '', services, about, contact, login,
                             timesheet (authGuard), admin (adminGuard), '**' -> NotFound
app.routes.server.ts         login/timesheet/admin -> RenderMode.Client, '**' -> RenderMode.Prerender
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

  auth.service.ts            AuthService: user/isAdmin signals, ready promise, signIn/signOut. Browser-only,
                             loads Firebase via dynamic import (SDK stays out of the initial bundle)
  auth.guard.ts              authGuard, adminGuard (/admins/{uid} check via AuthService)
  firebase/client.ts         getFirebase(): memoised init, connects emulators when environment.useEmulators
  timesheet.service.ts       Firestore /timesheets + Storage receipts; markInvoiced batch
  timesheet.model.ts, dates.ts   Types/constants; Mon-Sun week helpers (weekEnding = Sunday)
  invoice-config.ts          Issuer details (PLACEHOLDERS to fill in), payment terms
  invoice-pdf.ts             Cents-based invoice maths + pdfmake PDF (lazy-loaded) download

layout/
  header/                    Sticky header (host class 'sticky top-0 z-[100]'), nav links, mobile menu,
                             theme toggle, scrolled-state signal
  footer/                    Footer: services list, ContactInfoService, year, Employee Login / Timesheet|Admin + Sign out

pages/                       One standalone component per route (each with .ts + .html, no separate .css)
  home/                      Hero, services overview, stats, differentiators, process, testimonials,
                             tech partners, CTA
  services/                  Six service sections, anchor-linkable (/services#cybersecurity)
  about/                     Mission, values, leadership, timeline
  contact/                   Signal Forms contact form (form/FormField/required/minLength/email/submit from
                             '@angular/forms/signals'); no backend, submit only sets sent=true. Contact info
                             card, FAQ accordion.
  login/                     Shared employee/admin login (reactive form, returnUrl support)
  timesheet/                 Weekly hours form + receipt upload; read-only once invoiced
  admin/                     Timesheet dashboard with filters + invoice form/PDF/mark-as-invoiced
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

## Firebase notes
- `@angular/fire` is NOT used: its latest release only supports Angular 20. We use the plain `firebase` SDK.
- `src/environments/environment.ts` (prod, placeholder config) and `environment.development.ts` (emulators);
  `ng serve` uses development via fileReplacements. Real prod config is deferred (plan section 7).
- Emulator ports: Auth 9099, Firestore 8080, Storage 9199, UI 4000. Create users in the UI; add an
  `/admins/{uid}` doc to make an admin.

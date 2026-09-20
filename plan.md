# Implementation Plan: Angular Timesheet & Invoicing System

## Decisions
- **Admin identification**: Firestore `/admins/{uid}` document (existence = admin).
- **PDF library**: `pdfmake`.
- **Timesheet days**: Mon–Sun (7 days).
- **Receipt upload**: images only (PNG/JPG); storage path uses the file's real extension.
- **Company logo**: supplied by the owner as an image and bundled in the app's public assets (not Cloud Storage).
- **Routing**: lazy-loaded routes (`/login`, `/timesheet`, `/admin`) inside the existing Angular app; public marketing routes are unchanged.
- **Test users**: created manually via the Emulator UI (http://127.0.0.1:4000); no seed script or signup screen.
- **Login entry point**: an "Employee Login" link in the site footer (visible on every page) leads to a single `/login` page used by both employees and admins.
- **Production Firebase**: a Firebase project already exists, but no services are enabled yet (Auth, Firestore, Storage all need setup). Production rollout is **deferred**: build and test entirely on emulators first (see "Production Rollout").
- **Hosting**: stays on Vercel.
- **Invoice amounts**: PDF shows hours, hourly rate and totals. The admin enters the hourly rate on the invoice form.
- **Invoice scope**: one invoice = one employee and one or more selected weeks.
- **Resubmission**: one timesheet per employee per week. Employees may edit/resubmit until the week is invoiced; invoiced weeks are locked.

## Prerequisites
- A Java runtime (JDK 21+ recommended) installed locally, required by the Firestore emulator. Already installed (Java 24).
- Firebase CLI is already installed by the owner.
- Owner provides the logo image file (or we use the existing `public/images/brand/logo.png`).
- Owner provides the invoice issuer details for the PDF header (company name, address, contact/payment info) and confirms the currency.
- Real Firebase web config keys are needed for production only; the emulators accept dummy values.

## 1. Firebase Local Emulator Setup
- `firebase init` is interactive, so create the config files by hand instead: `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` (Authentication, Firestore, Storage emulators).
- Set emulator ports: Auth (9099), Firestore (8080), Storage (9199), Emulator UI (4000).
- Create the `./emulator-data` directory so `--import` works on first run.
- Local testing command: `firebase emulators:start --import=./emulator-data --export-on-exit`.
- Add an npm script for it.

## 2. Angular Environment Configuration
- Run `ng generate environments` (modern Angular doesn't create environment files by default).
- **Dev (`environment.development.ts`)**: `useEmulators: true` with placeholder Firebase config keys.
- **Prod (`environment.ts`)**: `useEmulators: false`; placeholder Firebase config until the deferred production rollout (Section 7) supplies the real values.
- **Initialization**: use `@angular/fire` providers in `app.config.ts` (not `main.ts`), connecting emulators exactly once:
  ```typescript
  provideFirebaseApp(() => initializeApp(environment.firebase)),
  provideAuth(() => {
    const auth = getAuth();
    if (environment.useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    return auth;
  }),
  provideFirestore(() => {
    const db = getFirestore();
    if (environment.useEmulators) connectFirestoreEmulator(db, '127.0.0.1', 8080);
    return db;
  }),
  provideStorage(() => {
    const storage = getStorage();
    if (environment.useEmulators) connectStorageEmulator(storage, '127.0.0.1', 9199);
    return storage;
  }),
  ```

## 3. User Authentication
- **Employee Login link**: add an "Employee Login" link to the bottom of every page by editing the footer component (`src/app/layout/footer/footer.html`, using `RouterLink` to `/login`). Place it in the bottom bar next to the copyright line, styled as a subtle link. When the user is already signed in, show "Timesheet" (or "Admin" for admins) instead, plus a "Sign out" action.
- One shared login screen using Firebase Auth `signInWithEmailAndPassword` (route `/login`) for both employees and admins.
- After a successful login, check `/admins/{uid}`: admins are redirected to `/admin`, employees to `/timesheet`. If a `returnUrl` query param is present (set by the guards), go there instead, provided the user is allowed to access it.
- Show a friendly error message for invalid credentials. An already-signed-in user who opens `/login` is redirected to their landing page.
- Functional route guards (`CanActivateFn`):
  - `authGuard` protects `/timesheet` and `/admin`.
  - `adminGuard` additionally checks that `/admins/{uid}` exists before allowing `/admin`.
- Users are created manually in the Emulator UI; admins are marked by adding an `/admins/{uid}` document.
- Timesheet and admin features are lazy-loaded routes in the existing app.
- **Prerender**: the site prerenders every route (`app.routes.server.ts` has `**` → `RenderMode.Prerender`). Add explicit entries for `login`, `timesheet` and `admin` with `RenderMode.Client` before the catch-all, and only initialize Firebase Auth state in the browser, so signed-in state never alters server-rendered HTML.

## 4. Timesheet Log Form & Cloud Storage
- Reactive Form capturing daily hours Mon–Sun; total computed from the seven values.
- File input for the timesheet proof/receipt image, accepting images only (PNG/JPG), validated client-side and in Storage rules.
- Upload to Cloud Storage at `/receipts/{userId}/{weekEnding}.{ext}` (`ext` from the file's actual type) via `uploadBytes`; retrieve URL with `getDownloadURL`.
- Save timesheet metadata in Firestore `/timesheets/{userId}_{weekEnding}`. The deterministic document ID enforces one timesheet per employee per week; resubmitting overwrites it (and replaces the receipt file at the same path).
- The form loads the existing timesheet for the selected week (if any) and is read-only, with a notice, once `invoiced` is true.

```json
{
  "userId": "string",
  "userEmail": "string",
  "weekEnding": "YYYY-MM-DD",
  "hours": { "Mon": 8, "Tue": 8, "Wed": 8, "Thu": 8, "Fri": 8, "Sat": 0, "Sun": 0 },
  "totalHours": 40,
  "receiptUrl": "string",
  "invoiced": false,
  "invoiceNumber": null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```
- `userEmail` is stored so the admin dashboard can show who submitted each timesheet without a users collection.
- Validate hours client-side: numbers from 0 to 24 per day.

## 5. Invoicing & Local PDF Generation
- Admin Dashboard (route `/admin`) listing timesheets from `/timesheets`, filterable by employee and by invoiced/not invoiced, with a link to each receipt image.
- Invoice form: admin selects one employee and one or more of that employee's uninvoiced weeks, then enters Invoice Date, payment terms (Net 15 / 30 / 45), and an hourly rate.
- Amounts: per-week amount = hours × rate; invoice total = sum of the selected weeks. Compute in cents (integers) or round to 2 decimals to avoid floating-point errors.
- After the PDF is generated, the admin confirms "Mark as invoiced", which sets `invoiced: true` and `invoiceNumber` on the selected timesheets (locking them for employees). Invoice numbers are entered by the admin or generated as `INV-YYYYMMDD-NN`.
- Due date calculation (without mutating the input):
  ```typescript
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + terms);
  ```
- Use `pdfmake` to build the PDF entirely on the frontend.
- PDF includes: company logo (bundled asset, embedded as a data URL), issuer details, invoice number and date, employee, payment terms, calculated due date, a per-week table (week ending, hours, rate, amount), and the total.
- Trigger the local download with pdfmake's `download()`.

## 6. Security Rules
- `/firestore.rules`:
  - Users may read their own `/timesheets` docs, and create/update them only when `userId == request.auth.uid`, the doc ID matches `{uid}_{weekEnding}`, and the existing doc (if any) is not `invoiced`. They cannot set `invoiced` or `invoiceNumber`.
  - Admins (`exists(/databases/$(database)/documents/admins/$(request.auth.uid))`) may read all timesheets and update only the `invoiced` and `invoiceNumber` fields.
  - `/admins` is not writable from clients; reads limited to the user's own doc (needed by `adminGuard`).
- `/storage.rules`:
  - Users may read and write only `/receipts/{userId}/**` where `userId == request.auth.uid`.
  - Uploads restricted to image content types and a size limit.
  - Admins may read all receipts (via Firestore `exists()` lookup in Storage rules).

## 7. Production Rollout (deferred)
Not part of the first implementation pass. The existing production Firebase project has no services enabled yet. When ready:
1. In the Firebase console, enable Authentication (Email/Password), create a Firestore database, and set up Cloud Storage (may require the Blaze plan).
2. Create a Web app in the project and paste its public config into `environment.ts` (safe to commit; see security notes).
3. Owner runs `firebase login`, then deploys rules: `firebase deploy --only firestore:rules,storage`.
4. Create employee users in the console; create the admin's `/admins/{uid}` document manually.
5. Add the Vercel production domain to Firebase Auth authorized domains, and restrict the API key to that domain (HTTP referrer) in Google Cloud Console. Optionally enable App Check.
6. Verify the Vercel build serves `/login`, `/timesheet` and `/admin` (`vercel.ts` already rewrites unknown paths to `index.csr.html`).
- Secrets policy: only public Firebase web config lives in the repo. Never commit service account keys, Admin SDK credentials, or Vercel tokens (`.env*` is already gitignored).

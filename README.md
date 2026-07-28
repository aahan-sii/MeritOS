# MeritOS

MeritOS helps applicants turn verified evidence into stronger scholarship,
fellowship, graduate-program, and grant applications. It never submits an
application automatically and flags unsupported claims before they are used.

## Local development

1. Create a Clerk application and copy its publishable and secret keys.
2. Create `.env.local` from `.env.example`.
3. Add your Neon `DATABASE_URL`, Vercel Blob token, and Clerk keys.

```bash
npm install
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`.

## Vercel deployment

This is a standard Next.js application and deploys directly through Vercel.

1. Import `aahan-sii/MeritOS` in Vercel.
2. Add `DATABASE_URL` from Neon in **Settings → Environment Variables**.
3. Create and connect a private Vercel Blob store. New projects use automatic
   OIDC authentication; legacy stores may add `BLOB_READ_WRITE_TOKEN`.
4. In Clerk, create an application. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   and `CLERK_SECRET_KEY` to Vercel.
5. Run `npm run db:migrate` locally with the production `DATABASE_URL`.
6. Deploy. Vercel automatically runs `npm run build`.

## Database migration

The generated Postgres migration is in `drizzle-postgres/`. Apply it to the
connected Postgres database before using the persistent API routes.

```bash
npm run db:migrate
```

## Chrome side panel

The working Manifest V3 extension is in `extension/`.

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose the `extension` folder.
4. Create an account in MeritOS and finish the one-time profile setup.
5. On the dashboard, select **Connect Chrome extension**.
6. Open MeritOS from Chrome's toolbar and paste the connection key.
7. Visit an application form. Open MeritOS, review the detected fields, check
   supported answers, and select **Fill approved**.

The extension does not submit forms and does not use unverified claims.

## Checks

```bash
npm run build
npm test
npm run lint
```

# MeritOS

MeritOS helps applicants turn verified evidence into stronger scholarship,
fellowship, graduate-program, and grant applications. It never submits an
application automatically and flags unsupported claims before they are used.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Vercel deployment

This is a standard Next.js application and deploys directly through Vercel.

1. Import `aahan-sii/MeritOS` in Vercel.
2. Create and connect a Postgres database (Neon is supported through the
   Vercel Marketplace), then copy its connection string to `DATABASE_URL`.
3. Create and connect a Vercel Blob store; Vercel adds
   `BLOB_READ_WRITE_TOKEN` automatically.
4. For a single-user demo, add `MERITOS_DEMO_EMAIL` with your own email.
5. Deploy. Vercel automatically runs `npm run build`.

`MERITOS_DEMO_EMAIL` is a temporary single-user identity for the demo. Before
inviting other people, replace it with a real authentication provider.

## Database migration

The generated Postgres migration is in `drizzle-postgres/`. Apply it to the
connected Postgres database before using the persistent API routes.

```bash
npm run db:generate
```

## Checks

```bash
npm run build
npm test
npm run lint
```

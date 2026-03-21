# IntelliPath — Deployment Guide

## Environment Variables

All of these must be set in your hosting platform (Vercel / Netlify) dashboard.

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Project → Connect → `?pgbouncer=true` pool URL |
| `DIRECT_URL` | Supabase → Project → Connect → direct connection URL (port 5432) |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `INNGEST_EVENT_KEY` | Inngest Dashboard → Apps → your app → Event Key |
| `INNGEST_SIGNING_KEY` | Inngest Dashboard → Apps → your app → Signing Key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/onboarding` |

---

## Step 1 — Set up Inngest Cloud (free)

> Inngest runs your background AI generation jobs without serverless timeout limits.

1. Go to [https://app.inngest.com](https://app.inngest.com) → Sign up (free)
2. Click **Create App**
3. Copy your **Event Key** (`INNGEST_EVENT_KEY`) and **Signing Key** (`INNGEST_SIGNING_KEY`)
4. Add both to your Vercel/Netlify environment variables

---

## Step 2 — Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import your repository
3. Set **Root Directory** to `intellipath` (the folder with `package.json`)
4. Add all environment variables from the table above
5. Deploy

---

## Step 3 — Sync app with Inngest (CRITICAL)

After your first successful deploy:

1. Go to [Inngest Dashboard](https://app.inngest.com) → **Apps**
2. Click **Sync new app**
3. Enter your deployed URL: `https://your-app.vercel.app/api/inngest`
4. Inngest will discover your 4 functions and register them ✅

> You must re-sync after every deploy that changes Inngest functions.

---

## Step 4 — Run Database Migrations

After deploying, push your schema to the database:

```bash
npx prisma db push
```

Or run the seed to populate initial careers/skills/internships:

```bash
node prisma/seed.js
```

---

## How Background Jobs Work in Production

```
User saves profile
    │
    ▼  (instant)
updateUser() → sends event to Inngest Cloud
    │
    ▼  return { success: true } to user
    
Inngest Cloud (async, no timeout):
    ├─ Calls your /api/inngest endpoint
    ├─ Runs generateCareerDataForUser in steps
    ├─ 4 Gemini API calls → saves to DB
    └─ Revalidates pages → user sees data after ~30-60s
```

---

## Netlify Notes

- Set build command: `cd intellipath && npm run build`
- Set publish directory: `intellipath/.next`
- Add all env vars in Netlify → Site Settings → Environment variables
- After deploy, sync with Inngest using your Netlify URL: `https://your-site.netlify.app/api/inngest`

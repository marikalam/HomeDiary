# Deploying HomeDiary

HomeDiary runs as one Docker service (API + built frontend) on **Render**,
backed by a free **Neon** Postgres database and free **Cloudflare R2** file
storage. All three are free tiers with no ongoing cost. You'll need to sign
up for each yourself (account creation isn't something I can do for you) —
this takes about 10 minutes total. None of the values below need to be
shared with anyone; you'll paste them directly into Render's own setup form.

## 1. Database — Neon

1. Go to [neon.tech](https://neon.tech) and sign up (free, no card required).
2. Create a new project, e.g. named `homediary`.
3. On the project dashboard, copy the **connection string** shown (starts
   with `postgresql://...?sslmode=require`). Keep this tab open — you'll
   paste it into Render in step 3.

## 2. File storage — Cloudflare R2

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign up free.
2. In the sidebar, open **R2 Object Storage** → **Create bucket**. Name it
   `homediary-uploads` (or anything — just remember it).
3. Find your **Account ID** (shown on the R2 overview page). This is
   `R2_ACCOUNT_ID`.
4. Go to **R2 → Manage API Tokens → Create API Token**. Give it **Object
   Read & Write** permission, scoped to the `homediary-uploads` bucket only.
5. Copy the **Access Key ID** and **Secret Access Key** shown (this is the
   only time the secret is displayed). These are `R2_ACCESS_KEY_ID` and
   `R2_SECRET_ACCESS_KEY`.
6. Leave the bucket's public access disabled — the app serves files itself
   after checking you're logged in and own them, so the bucket never needs
   to be public.

## 3. App hosting — Render

1. Go to [render.com](https://render.com) and sign up free (signing up with
   your GitHub account makes the next step automatic).
2. **New → Blueprint**, connect your GitHub account if prompted, and select
   the `marikalam/HomeDiary` repository. Render reads `render.yaml` from the
   repo automatically.
3. Render will ask you to fill in the environment variables marked as
   secrets. Paste in:
   - `DATABASE_URL` → the Neon connection string from step 1
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` → from step 2
   - `R2_BUCKET_NAME` → `homediary-uploads` (or whatever you named it)
   - `JWT_SECRET` is generated automatically by Render — leave it as is.
4. Click **Deploy Blueprint**. The first build takes a few minutes (it's
   building a Docker image). The container automatically runs the database
   migration on startup, so the tables are created on first boot — nothing
   else to run manually.
5. Once deployed, Render gives you a URL like `https://homediary.onrender.com`.
   Open it, click **Sign up**, and create your account. Every user only ever
   sees their own properties.

## 4. Google Calendar linking (optional)

This lets you connect your Google account so you can import a Google
Calendar event (like "Fridge technician comes") straight into a property's
timeline. Skip this section if you don't want that — the app works fine
without it, the "Connect Google Calendar" button just won't appear.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   sign in with your Google account. Create a new project (top-left project
   picker → **New Project**) — name it anything, e.g. `HomeDiary`.
2. Go to **APIs & Services → Library**, search for **Google Calendar API**,
   and click **Enable**.
3. Go to **APIs & Services → OAuth consent screen**.
   - User type: **External** (unless you have a Google Workspace account,
     in which case Internal also works and is simpler).
   - Fill in the app name (`HomeDiary`), your email for support and
     developer contact, and save through the steps.
   - On the **Scopes** step you can skip adding scopes here — the app
     requests them directly.
   - On the **Test users** step, add your own Google account's email. While
     the app is in "Testing" mode, only accounts you add here can connect —
     that's fine for personal use and avoids Google's full app review.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth
   client ID**.
   - Application type: **Web application**.
   - Name: anything, e.g. `HomeDiary server`.
   - Under **Authorized redirect URIs**, add:
     - `http://localhost:4000/api/google/callback` (for local dev)
     - `https://<your-render-url>/api/google/callback` (your real deployed
       URL from step 3 above, e.g. `https://homediary.onrender.com/api/google/callback`)
   - Click **Create**. Copy the **Client ID** and **Client Secret** shown.
5. In Render, add these environment variables (Dashboard → your service →
   **Environment**):
   - `GOOGLE_CLIENT_ID` → the Client ID from step 4
   - `GOOGLE_CLIENT_SECRET` → the Client Secret from step 4
   - `GOOGLE_REDIRECT_URI` → `https://<your-render-url>/api/google/callback`
     (must match exactly what you added in step 4, including `https://`)
   - Render will redeploy automatically after you save.
6. For local dev, add the same three variables to `server/.env`, using the
   `http://localhost:4000/...` redirect URI instead.
7. Open HomeDiary, sign in, and you should see a **📅 Connect Google
   Calendar** button next to your name. Connecting asks for read-only
   calendar access — HomeDiary never edits or creates anything on your
   Google Calendar, it only reads events so you can import one.

## 5. Claude photo analysis (optional)

This adds a **✨ Add from photos** button to each property's timeline. Pick
one or more photos (up to 10 are analyzed) and Claude drafts the event for
you: a title, the event type, a short summary, and a list of details it can
see — appliance brand/model, what work is being done and where, damage or
wear, readable labels or receipt totals. The original photos are attached to
the event, and nothing is saved until you review the draft and click
**Save event**. Skip this section if you don't want it — the button just
won't appear.

1. Go to [platform.claude.com](https://platform.claude.com), sign in, and
   add a payment method under **Billing** (the API is pay-as-you-go; a
   typical photo analysis costs a few cents).
2. Go to **Settings → API Keys → Create Key**, name it `HomeDiary`, and copy
   the key (starts with `sk-ant-`). It's only shown once.
3. In Render, add an environment variable (Dashboard → your service →
   **Environment**): `ANTHROPIC_API_KEY` → the key from step 2. Render
   redeploys automatically after you save.
4. For local dev, add the same variable to `server/.env`.

Photos are downscaled in your browser before being sent to Claude, so
large phone photos analyze quickly. Photos are only sent to Anthropic's API when
you use the button.

## Notes

- The free Render instance sleeps after 15 minutes of no traffic; the first
  request after that takes 30-60 seconds to wake it back up. Everything
  after that is normal speed.
- To redeploy after future code changes, just push to `main` — Render
  redeploys automatically on push.
- Local development still works the same way (`npm run dev` from the repo
  root); point `server/.env`'s `DATABASE_URL` at a Postgres database (the
  same Neon project works fine, or create a second free Neon project for
  dev) and fill in the R2 variables the same way.

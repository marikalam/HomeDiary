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

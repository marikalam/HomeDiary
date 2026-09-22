# HomeDiary

A private diary for your home(s). Sign in to your own account, add
properties, log timeline events (purchase, damage, repairs, inspections...)
with photos and documents attached, and keep separate, non-timeline
documents (purchase paperwork, insurance policies, warranties) per property.
Each account only ever sees its own properties.

## Stack

- **Backend**: Node.js, Express, TypeScript, Prisma, Postgres, Cloudflare R2
  (file storage), JWT cookie auth
- **Frontend**: React, TypeScript, Vite, React Router

In production this runs as a single Docker service on Render, with a free
Neon Postgres database and free Cloudflare R2 bucket for uploaded files. See
[DEPLOY.md](DEPLOY.md) for deploy instructions.

## Local setup

You need a Postgres database to develop against — the simplest option is a
free [Neon](https://neon.tech) project (same one used for deploys, or a
second one for dev). You'll also need a Cloudflare R2 bucket for file
uploads to work locally (see [DEPLOY.md](DEPLOY.md) for how to create both).

```bash
npm run install:all      # installs server + client dependencies
```

Copy `server/.env.example` to `server/.env` and fill in `DATABASE_URL` (from
Neon), a `JWT_SECRET` (any long random string), and the `R2_*` values (from
Cloudflare).

```bash
npm run db:migrate        # applies the database schema (first time only)
npm run dev                # starts both the API and the web app
```

This starts the API server on http://localhost:4000 and the web app on
http://localhost:5173. Open the web app, sign up for an account, and start
adding properties.

(You can also run `npm run dev:server` and `npm run dev:client` separately.)

## Project structure

```
server/            Express API + Prisma schema
  prisma/schema.prisma   Data model: User, Property, TimelineEvent, Document, Attachment
  src/routes/            REST endpoints (auth, properties, events, documents, attachments)
  src/auth.ts            Password hashing, JWT sessions, requireAuth middleware
  src/storage.ts         Cloudflare R2 (S3-compatible) file storage
client/            React app
  src/auth/               Auth context (login/register/logout, session check)
  src/pages/              AuthPage, PropertiesPage, PropertyPage
  src/components/         TimelineTab, DocumentsTab, AttachmentList
Dockerfile          Builds client + server into one deployable image
render.yaml         Render Blueprint (see DEPLOY.md)
```

## Data model

- **User** — an account (email + password). Owns properties; nobody else can
  see them.
- **Property** — a home: name, address, purchase date, notes.
- **TimelineEvent** — something that happened at a property (purchase, crack,
  structural engineer visit, repair, etc.), with a date, type, description,
  and any number of attached photos/documents.
- **Document** — a file that isn't tied to a specific timeline event, e.g.
  closing paperwork, an insurance policy, a warranty. Has a category, date,
  notes, and any number of attached files.
- **Attachment** — an uploaded file (stored in Cloudflare R2) belonging to
  either a timeline event or a document.

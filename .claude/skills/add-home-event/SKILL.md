---
name: add-home-event
description: Add an event (with photos) to the user's HomeDiary timeline through its API. Use when the user shares photos or describes something that happened at their home and wants it logged in HomeDiary ("add this to my home diary", "log this event").
---

# Add an event to HomeDiary

HomeDiary's API accepts a personal API token. The user creates one in the app
(**🤖 Connect Claude** in the header) and stores it in this environment's
settings, along with the site URL:

- `HOMEDIARY_URL` - e.g. `https://homediary.onrender.com` (no trailing slash)
- `HOMEDIARY_API_TOKEN` - starts with `hd_`

If either is missing, tell the user to add them in the cloud environment's
settings (environment menu in the session title bar -> Edit -> environment
variables) and to allow the `HOMEDIARY_URL` host under Network access, then
start a new session. Never ask them to paste the token into the chat.

Every request sends `Authorization: Bearer $HOMEDIARY_API_TOKEN`. The free
Render instance may take 30-60s to wake up, so use `--max-time 120`.

## 1. Pick the property

```bash
curl -sS --max-time 120 -H "Authorization: Bearer $HOMEDIARY_API_TOKEN" "$HOMEDIARY_URL/api/properties"
```

Use the property's `id`. If there's more than one and it isn't obvious which
one the user means, ask.

## 2. Write the event from the photos

Look at the photos yourself and draft:

- `title` - short headline, under 70 characters
- `eventType` - one of `purchase`, `damage`, `repair`, `inspection`, `maintenance`, `renovation`, `other`
- `eventDate` - `YYYY-MM-DD`, the day it happened (ask if unclear; "today" means the user's today)
- `description` - one or two summary sentences, a blank line, then `Details` and `- ` bullets
  with specifics (brands/models, what work was done and where, damage, readable labels).
  Only state what the photos show; describe people by what they're doing, never by guessed names.
- `cost` - only if the user gave one or a price is clearly visible

Show the user the draft and get a go-ahead before posting - it's their diary.

## 3. Create it, with the photos attached

```bash
curl -sS --max-time 120 -H "Authorization: Bearer $HOMEDIARY_API_TOKEN" \
  -F "title=..." -F "eventType=maintenance" -F "eventDate=2026-10-02" \
  -F "description=<description.txt" \
  -F "files=@/path/to/photo1.jpg" -F "files=@/path/to/photo2.jpg" \
  "$HOMEDIARY_URL/api/properties/<propertyId>/events"
```

Put the description in a file and pass it with `<file` so newlines and quotes
survive. Up to 20 files, 50 MB each. The response is the created event; check
it has `id` and the expected number of `attachments`, then tell the user it's
in their timeline. Add more photos to an existing event with
`POST .../events/<eventId>/attachments` (same `files` field).

import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { upload } from "../upload";
import { deleteObject, putObject } from "../storage";
import { cosineSimilarity, embedText, eventEmbeddingText } from "../embeddings";

export const eventsRouter = Router({ mergeParams: true });

eventsRouter.use(requireAuth);

async function ownedProperty(propertyId: string, userId?: string) {
  return prisma.property.findFirst({ where: { id: propertyId, userId } });
}

function parseCost(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// GET /api/properties/:propertyId/events
eventsRouter.get<{ propertyId: string }>("/", async (req, res) => {
  const property = await ownedProperty(req.params.propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });
  const events = await prisma.timelineEvent.findMany({
    where: { propertyId: req.params.propertyId },
    include: { attachments: true },
    orderBy: { eventDate: "desc" },
  });
  res.json(events);
});

// GET /api/properties/:propertyId/events/search?q=...
// Semantic search over event title/type/description, using local sentence
// embeddings (no external API) and cosine similarity - so "fridge repair"
// finds an event titled "Refrigerator technician visit" even with no
// words in common.
eventsRouter.get<{ propertyId: string }>("/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.json([]);
  const property = await ownedProperty(req.params.propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const events = await prisma.timelineEvent.findMany({
    where: { propertyId: req.params.propertyId },
    include: { attachments: true },
  });

  // Self-healing backfill: events created before this feature (or by any
  // path that skipped embedding generation) get one computed on first
  // search rather than needing a separate migration script.
  const withEmbeddings = await Promise.all(
    events.map(async (event) => {
      if (event.embedding.length > 0) return event;
      const embedding = await embedText(eventEmbeddingText(event));
      await prisma.timelineEvent.update({ where: { id: event.id }, data: { embedding } });
      return { ...event, embedding };
    })
  );

  const queryEmbedding = await embedText(q);
  const MIN_SCORE = 0.25;
  const ranked = withEmbeddings
    .map((event) => ({ event, score: cosineSimilarity(queryEmbedding, event.embedding) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  res.json(ranked.map((r) => ({ ...r.event, score: r.score })));
});

// POST /api/properties/:propertyId/events  (multipart, field "files")
eventsRouter.post<{ propertyId: string }>(
  "/",
  upload.array("files", 20),
  async (req, res) => {
    const { title, eventType, eventDate, description, cost, googleEventId, googleCalendarId, googleHtmlLink } =
      req.body;
    if (!title || !eventDate) {
      return res.status(400).json({ error: "title and eventDate are required" });
    }
    const property = await ownedProperty(req.params.propertyId, req.userId);
    if (!property) return res.status(404).json({ error: "Property not found" });

    const files = (req.files as Express.Multer.File[]) || [];
    const uploaded = await Promise.all(
      files.map(async (f) => {
        const storedName = `${crypto.randomUUID()}-${f.originalname}`;
        await putObject(storedName, f.buffer, f.mimetype);
        return {
          filename: f.originalname,
          storedName,
          mimeType: f.mimetype,
          size: f.size,
        };
      })
    );

    const embedding = await embedText(
      eventEmbeddingText({ title, eventType: eventType || "other", description })
    );

    const event = await prisma.timelineEvent.create({
      data: {
        propertyId: req.params.propertyId,
        title,
        eventType: eventType || "other",
        eventDate: new Date(eventDate),
        description: description || null,
        cost: parseCost(cost) ?? null,
        googleEventId: googleEventId || null,
        googleCalendarId: googleCalendarId || null,
        googleHtmlLink: googleHtmlLink || null,
        embedding,
        attachments: { create: uploaded },
      },
      include: { attachments: true },
    });
    res.status(201).json(event);
  }
);

// PUT /api/properties/:propertyId/events/:eventId
eventsRouter.put<{ propertyId: string; eventId: string }>(
  "/:eventId",
  async (req, res) => {
    const property = await ownedProperty(req.params.propertyId, req.userId);
    if (!property) return res.status(404).json({ error: "Property not found" });
    const { title, eventType, eventDate, description, cost } = req.body;
    const existing = await prisma.timelineEvent.findFirst({
      where: { id: req.params.eventId, propertyId: req.params.propertyId },
    });
    if (!existing) return res.status(404).json({ error: "Event not found" });
    const parsedCost = parseCost(cost);

    // Re-embed whenever any of the searchable text fields change, so the
    // stored vector never drifts out of sync with what's actually shown.
    const textChanged = title !== undefined || eventType !== undefined || description !== undefined;
    const embedding = textChanged
      ? await embedText(
          eventEmbeddingText({
            title: title ?? existing.title,
            eventType: eventType ?? existing.eventType,
            description: description !== undefined ? description : existing.description,
          })
        )
      : undefined;

    const event = await prisma.timelineEvent.update({
      where: { id: req.params.eventId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(eventType !== undefined ? { eventType } : {}),
        ...(eventDate !== undefined ? { eventDate: new Date(eventDate) } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(parsedCost !== undefined ? { cost: parsedCost } : {}),
        ...(embedding !== undefined ? { embedding } : {}),
      },
      include: { attachments: true },
    });
    res.json(event);
  }
);

// POST /api/properties/:propertyId/events/:eventId/attachments
eventsRouter.post<{ propertyId: string; eventId: string }>(
  "/:eventId/attachments",
  upload.array("files", 20),
  async (req, res) => {
    const property = await ownedProperty(req.params.propertyId, req.userId);
    if (!property) return res.status(404).json({ error: "Property not found" });
    const event = await prisma.timelineEvent.findFirst({
      where: { id: req.params.eventId, propertyId: req.params.propertyId },
    });
    if (!event) return res.status(404).json({ error: "Event not found" });

    const files = (req.files as Express.Multer.File[]) || [];
    const created = await Promise.all(
      files.map(async (f) => {
        const storedName = `${crypto.randomUUID()}-${f.originalname}`;
        await putObject(storedName, f.buffer, f.mimetype);
        return prisma.attachment.create({
          data: {
            filename: f.originalname,
            storedName,
            mimeType: f.mimetype,
            size: f.size,
            eventId: req.params.eventId,
          },
        });
      })
    );
    res.status(201).json(created);
  }
);

// DELETE /api/properties/:propertyId/events/:eventId
eventsRouter.delete<{ propertyId: string; eventId: string }>(
  "/:eventId",
  async (req, res) => {
    const property = await ownedProperty(req.params.propertyId, req.userId);
    if (!property) return res.status(404).json({ error: "Property not found" });
    const existing = await prisma.timelineEvent.findFirst({
      where: { id: req.params.eventId, propertyId: req.params.propertyId },
    });
    if (!existing) return res.status(404).json({ error: "Event not found" });

    const attachments = await prisma.attachment.findMany({
      where: { eventId: req.params.eventId },
      select: { storedName: true },
    });
    await prisma.timelineEvent.delete({ where: { id: req.params.eventId } });
    await Promise.all(attachments.map((a) => deleteObject(a.storedName).catch(() => {})));
    res.status(204).end();
  }
);

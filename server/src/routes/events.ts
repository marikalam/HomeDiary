import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { upload } from "../upload";
import { deleteObject, putObject } from "../storage";

export const eventsRouter = Router({ mergeParams: true });

eventsRouter.use(requireAuth);

async function ownedProperty(propertyId: string, userId?: string) {
  return prisma.property.findFirst({ where: { id: propertyId, userId } });
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

// POST /api/properties/:propertyId/events  (multipart, field "files")
eventsRouter.post<{ propertyId: string }>(
  "/",
  upload.array("files", 20),
  async (req, res) => {
    const { title, eventType, eventDate, description } = req.body;
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

    const event = await prisma.timelineEvent.create({
      data: {
        propertyId: req.params.propertyId,
        title,
        eventType: eventType || "other",
        eventDate: new Date(eventDate),
        description: description || null,
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
    const { title, eventType, eventDate, description } = req.body;
    const existing = await prisma.timelineEvent.findFirst({
      where: { id: req.params.eventId, propertyId: req.params.propertyId },
    });
    if (!existing) return res.status(404).json({ error: "Event not found" });
    const event = await prisma.timelineEvent.update({
      where: { id: req.params.eventId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(eventType !== undefined ? { eventType } : {}),
        ...(eventDate !== undefined ? { eventDate: new Date(eventDate) } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
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

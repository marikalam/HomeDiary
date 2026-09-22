import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { upload } from "../upload";
import { deleteObject, putObject } from "../storage";

export const documentsRouter = Router({ mergeParams: true });

documentsRouter.use(requireAuth);

async function ownedProperty(propertyId: string, userId?: string) {
  return prisma.property.findFirst({ where: { id: propertyId, userId } });
}

// GET /api/properties/:propertyId/documents
documentsRouter.get<{ propertyId: string }>("/", async (req, res) => {
  const property = await ownedProperty(req.params.propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });
  const documents = await prisma.document.findMany({
    where: { propertyId: req.params.propertyId },
    include: { attachments: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(documents);
});

// POST /api/properties/:propertyId/documents (multipart, field "files")
documentsRouter.post<{ propertyId: string }>(
  "/",
  upload.array("files", 20),
  async (req, res) => {
    const { title, category, documentDate, notes } = req.body;
    if (!title) {
      return res.status(400).json({ error: "title is required" });
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

    const document = await prisma.document.create({
      data: {
        propertyId: req.params.propertyId,
        title,
        category: category || "other",
        documentDate: documentDate ? new Date(documentDate) : null,
        notes: notes || null,
        attachments: { create: uploaded },
      },
      include: { attachments: true },
    });
    res.status(201).json(document);
  }
);

// PUT /api/properties/:propertyId/documents/:documentId
documentsRouter.put<{ propertyId: string; documentId: string }>(
  "/:documentId",
  async (req, res) => {
    const property = await ownedProperty(req.params.propertyId, req.userId);
    if (!property) return res.status(404).json({ error: "Property not found" });
    const { title, category, documentDate, notes } = req.body;
    const existing = await prisma.document.findFirst({
      where: { id: req.params.documentId, propertyId: req.params.propertyId },
    });
    if (!existing) return res.status(404).json({ error: "Document not found" });
    const document = await prisma.document.update({
      where: { id: req.params.documentId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(documentDate !== undefined
          ? { documentDate: documentDate ? new Date(documentDate) : null }
          : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
      },
      include: { attachments: true },
    });
    res.json(document);
  }
);

// POST /api/properties/:propertyId/documents/:documentId/attachments
documentsRouter.post<{ propertyId: string; documentId: string }>(
  "/:documentId/attachments",
  upload.array("files", 20),
  async (req, res) => {
    const property = await ownedProperty(req.params.propertyId, req.userId);
    if (!property) return res.status(404).json({ error: "Property not found" });
    const document = await prisma.document.findFirst({
      where: { id: req.params.documentId, propertyId: req.params.propertyId },
    });
    if (!document) return res.status(404).json({ error: "Document not found" });

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
            documentId: req.params.documentId,
          },
        });
      })
    );
    res.status(201).json(created);
  }
);

// DELETE /api/properties/:propertyId/documents/:documentId
documentsRouter.delete<{ propertyId: string; documentId: string }>(
  "/:documentId",
  async (req, res) => {
    const property = await ownedProperty(req.params.propertyId, req.userId);
    if (!property) return res.status(404).json({ error: "Property not found" });
    const existing = await prisma.document.findFirst({
      where: { id: req.params.documentId, propertyId: req.params.propertyId },
    });
    if (!existing) return res.status(404).json({ error: "Document not found" });

    const attachments = await prisma.attachment.findMany({
      where: { documentId: req.params.documentId },
      select: { storedName: true },
    });
    await prisma.document.delete({ where: { id: req.params.documentId } });
    await Promise.all(attachments.map((a) => deleteObject(a.storedName).catch(() => {})));
    res.status(204).end();
  }
);

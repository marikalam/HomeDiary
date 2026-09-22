import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { deleteObject } from "../storage";

export const propertiesRouter = Router();

propertiesRouter.use(requireAuth);

propertiesRouter.get("/", async (req, res) => {
  const properties = await prisma.property.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { events: true, documents: true } },
    },
  });
  res.json(properties);
});

propertiesRouter.get("/:id", async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!property) return res.status(404).json({ error: "Property not found" });
  res.json(property);
});

propertiesRouter.post("/", async (req, res) => {
  const { name, address, purchaseDate, notes } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Property name is required" });
  }
  const property = await prisma.property.create({
    data: {
      userId: req.userId!,
      name: name.trim(),
      address: address || null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      notes: notes || null,
    },
  });
  res.status(201).json(property);
});

propertiesRouter.put("/:id", async (req, res) => {
  const { name, address, purchaseDate, notes } = req.body;
  const existing = await prisma.property.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: "Property not found" });
  const property = await prisma.property.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
      ...(purchaseDate !== undefined
        ? { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }
        : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
    },
  });
  res.json(property);
});

propertiesRouter.delete("/:id", async (req, res) => {
  const propertyId = req.params.id;
  const existing = await prisma.property.findFirst({
    where: { id: propertyId, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: "Property not found" });

  const attachments = await prisma.attachment.findMany({
    where: {
      OR: [{ event: { propertyId } }, { document: { propertyId } }],
    },
    select: { storedName: true },
  });
  await prisma.property.delete({ where: { id: propertyId } });
  await Promise.all(attachments.map((a) => deleteObject(a.storedName).catch(() => {})));
  res.status(204).end();
});

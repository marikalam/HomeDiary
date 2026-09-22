import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { deleteObject, getObjectStream } from "../storage";

export const attachmentsRouter = Router();

attachmentsRouter.use(requireAuth);

async function ownedAttachment(attachmentId: string, userId?: string) {
  return prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      OR: [
        { event: { property: { userId } } },
        { document: { property: { userId } } },
      ],
    },
  });
}

attachmentsRouter.get("/:id/file", async (req, res) => {
  const attachment = await ownedAttachment(req.params.id, req.userId);
  if (!attachment) return res.status(404).json({ error: "Attachment not found" });
  try {
    const stream = await getObjectStream(attachment.storedName);
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(attachment.filename)}"`
    );
    stream.pipe(res);
  } catch {
    res.status(404).json({ error: "File missing in storage" });
  }
});

attachmentsRouter.delete("/:id", async (req, res) => {
  const attachment = await ownedAttachment(req.params.id, req.userId);
  if (!attachment) return res.status(404).json({ error: "Attachment not found" });
  await prisma.attachment.delete({ where: { id: req.params.id } });
  await deleteObject(attachment.storedName).catch(() => {});
  res.status(204).end();
});

import { Router } from "express";
import archiver from "archiver";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { getObjectStream } from "../storage";

export const backupRouter = Router();

backupRouter.use(requireAuth);

interface BackupAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storedName: string;
}

function isoDay(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

// Keep the original name readable inside the zip, minus anything that
// could be read as a path.
function safeName(filename: string): string {
  return filename.replace(/[\\/:*?"<>|\x00-\x1f]+/g, "_").slice(0, 120) || "file";
}

// GET /api/backup
// A zip of everything the signed-in account owns: homediary-backup.json
// (properties, timeline events, documents) plus every attached file under
// files/. Made to be imported into the HomeDiary Claude artifact, but it's
// also just a readable full backup.
backupRouter.get("/", async (req, res) => {
  const attachments = {
    select: { id: true, filename: true, mimeType: true, size: true, storedName: true },
    orderBy: { createdAt: "asc" as const },
  };
  const properties = await prisma.property.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "asc" },
    include: {
      events: { include: { attachments }, orderBy: { eventDate: "asc" } },
      documents: { include: { attachments }, orderBy: { createdAt: "asc" } },
    },
  });

  const files: { path: string; storedName: string }[] = [];
  const fileEntries = (list: BackupAttachment[]) =>
    list.map((a) => {
      const path = `files/${a.id}-${safeName(a.filename)}`;
      files.push({ path, storedName: a.storedName });
      return { filename: a.filename, mimeType: a.mimeType, size: a.size, path };
    });

  const data = {
    format: "homediary-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    properties: properties.map((p) => ({
      name: p.name,
      address: p.address,
      purchaseDate: isoDay(p.purchaseDate),
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
      events: p.events.map((e) => ({
        title: e.title,
        eventType: e.eventType,
        eventDate: isoDay(e.eventDate),
        description: e.description,
        cost: e.cost === null ? null : Number(e.cost.toString()),
        googleHtmlLink: e.googleHtmlLink,
        createdAt: e.createdAt.toISOString(),
        attachments: fileEntries(e.attachments),
      })),
      documents: p.documents.map((d) => ({
        title: d.title,
        category: d.category,
        documentDate: isoDay(d.documentDate),
        notes: d.notes,
        createdAt: d.createdAt.toISOString(),
        attachments: fileEntries(d.attachments),
      })),
    })),
  };

  const today = new Date().toISOString().slice(0, 10);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/zip");
  res.attachment(`homediary-backup-${today}.zip`);

  const zip = archiver("zip", { zlib: { level: 6 } });
  zip.on("warning", (err) => console.warn("Backup warning:", err));
  zip.on("error", (err) => {
    console.error("Backup failed:", err);
    res.destroy(err);
  });
  zip.pipe(res);
  zip.append(JSON.stringify(data, null, 2), { name: "homediary-backup.json" });

  // One file at a time, so a big library never holds more than one open
  // R2 stream. A file missing from storage is listed in missing-files.txt
  // instead of failing the whole backup.
  const missing: string[] = [];
  for (const f of files) {
    try {
      const stream = await getObjectStream(f.storedName);
      await new Promise<void>((resolve, reject) => {
        stream.once("end", resolve);
        stream.once("error", reject);
        // Photos and PDFs are already compressed, so store them as-is
        zip.append(stream, { name: f.path, store: true });
      });
    } catch {
      missing.push(f.path);
    }
  }
  if (missing.length) zip.append(missing.join("\n") + "\n", { name: "missing-files.txt" });
  await zip.finalize();
});

import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { documentsCsv, fileSlug, propertyWorkbook, timelineCsv } from "../export";

export const exportRouter = Router({ mergeParams: true });

exportRouter.use(requireAuth);

// GET /api/properties/:propertyId/export?format=xlsx
// GET /api/properties/:propertyId/export?format=csv&section=timeline|documents
// A CSV holds one table, so it exports one section; the workbook has a
// Summary, Timeline and Documents sheet.
exportRouter.get<{ propertyId: string }>("/", async (req, res) => {
  const format = req.query.format;
  const section = req.query.section;
  if (format !== "xlsx" && format !== "csv") {
    return res.status(400).json({ error: "format must be xlsx or csv" });
  }
  if (format === "csv" && section !== "timeline" && section !== "documents") {
    return res.status(400).json({ error: "section must be timeline or documents" });
  }

  const property = await prisma.property.findFirst({
    where: { id: req.params.propertyId, userId: req.userId },
  });
  if (!property) return res.status(404).json({ error: "Property not found" });

  const attachments = { select: { filename: true }, orderBy: { createdAt: "asc" as const } };
  const needEvents = format === "xlsx" || section === "timeline";
  const needDocuments = format === "xlsx" || section === "documents";
  const [events, documents] = await Promise.all([
    needEvents
      ? prisma.timelineEvent.findMany({
          where: { propertyId: property.id },
          include: { attachments },
          orderBy: { eventDate: "desc" },
        })
      : [],
    needDocuments
      ? prisma.document.findMany({
          where: { propertyId: property.id },
          include: { attachments },
          orderBy: [{ documentDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        })
      : [],
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const base = `homediary-${fileSlug(property.name)}`;
  res.setHeader("Cache-Control", "no-store");

  if (format === "xlsx") {
    const buffer = await propertyWorkbook(property, events, documents);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.attachment(`${base}-${today}.xlsx`);
    return res.send(buffer);
  }

  const csv = section === "timeline" ? timelineCsv(events) : documentsCsv(documents);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.attachment(`${base}-${section}-${today}.csv`);
  res.send(csv);
});

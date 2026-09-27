import ExcelJS from "exceljs";

// Shapes the export needs - a subset of the Prisma models, so this module
// can be exercised without a database.
export interface ExportAttachment {
  filename: string;
}

export interface ExportEvent {
  title: string;
  eventType: string;
  eventDate: Date;
  description: string | null;
  cost: { toString(): string } | null;
  attachments: ExportAttachment[];
}

export interface ExportDocument {
  title: string;
  category: string;
  documentDate: Date | null;
  notes: string | null;
  attachments: ExportAttachment[];
}

export interface ExportProperty {
  name: string;
  address: string | null;
  purchaseDate: Date | null;
  notes: string | null;
}

// Dates are stored as UTC midnight for the chosen day, so format in UTC
// to get back exactly the day the user picked.
function isoDay(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

// exceljs writes a Date as its UTC day, and stored dates are already UTC
// midnight, so they land on the right day as-is. Truncate to the day for
// anything that carries a time (like "now").
function excelDay(date: Date | null): Date | null {
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function costNumber(cost: ExportEvent["cost"]): number | null {
  if (cost === null) return null;
  const n = Number(cost.toString());
  return Number.isFinite(n) ? n : null;
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function fileList(attachments: ExportAttachment[]): string {
  return attachments.map((a) => a.filename).join("; ");
}

// ---- CSV ----

// A cell starting with one of these is run as a formula when the CSV is
// opened in Excel/Sheets, so user-entered text like "=HYPERLINK(...)" gets
// a leading apostrophe to keep it plain text.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let s = String(value);
  if (typeof value === "string" && FORMULA_PREFIX.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows: (string | number | null)[][]): string {
  // BOM so Excel opens the file as UTF-8 (accents, emoji, etc.), CRLF per RFC 4180
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function timelineCsv(events: ExportEvent[]): string {
  return toCsv([
    ["Date", "Title", "Type", "Cost", "Description", "Attachments"],
    ...events.map((e) => [
      isoDay(e.eventDate),
      e.title,
      capitalize(e.eventType),
      costNumber(e.cost),
      e.description,
      fileList(e.attachments),
    ]),
  ]);
}

export function documentsCsv(documents: ExportDocument[]): string {
  return toCsv([
    ["Date", "Title", "Category", "Notes", "Attachments"],
    ...documents.map((d) => [
      isoDay(d.documentDate),
      d.title,
      capitalize(d.category),
      d.notes,
      fileList(d.attachments),
    ]),
  ]);
}

// ---- Excel ----

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFA8643A" },
};
const DATE_FORMAT = "yyyy-mm-dd";
const MONEY_FORMAT = '"$"#,##0.00';

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

export async function propertyWorkbook(
  property: ExportProperty,
  events: ExportEvent[],
  documents: ExportDocument[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HomeDiary";
  wb.created = new Date();

  const eventCosts = events.map((e) => costNumber(e.cost));
  const totalCost = eventCosts.reduce<number>((sum, c) => sum + (c ?? 0), 0);

  // Summary
  const summary = wb.addWorksheet("Summary");
  summary.columns = [{ width: 22 }, { width: 50 }];
  const title = summary.addRow([property.name]);
  title.font = { bold: true, size: 16 };
  summary.addRow([]);
  const summaryRows: [string, string | number | Date | null][] = [
    ["Address", property.address],
    ["Purchase date", excelDay(property.purchaseDate)],
    ["Notes", property.notes],
    ["Timeline events", events.length],
    ["Documents", documents.length],
    ["Total recorded cost", totalCost],
    ["Exported", excelDay(new Date())],
  ];
  for (const [label, value] of summaryRows) {
    const row = summary.addRow([label, value ?? ""]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: "top", horizontal: "left" };
    if (value instanceof Date) row.getCell(2).numFmt = DATE_FORMAT;
    if (label === "Total recorded cost") row.getCell(2).numFmt = MONEY_FORMAT;
  }

  // Timeline
  const timeline = wb.addWorksheet("Timeline");
  timeline.columns = [
    { header: "Date", key: "date", width: 12, style: { numFmt: DATE_FORMAT } },
    { header: "Title", key: "title", width: 32 },
    { header: "Type", key: "type", width: 14 },
    { header: "Cost", key: "cost", width: 12, style: { numFmt: MONEY_FORMAT } },
    { header: "Description", key: "description", width: 50 },
    { header: "Attachments", key: "attachments", width: 36 },
  ];
  events.forEach((e, i) => {
    const row = timeline.addRow({
      date: excelDay(e.eventDate),
      title: e.title,
      type: capitalize(e.eventType),
      cost: eventCosts[i],
      description: e.description ?? "",
      attachments: fileList(e.attachments),
    });
    row.alignment = { wrapText: true, vertical: "top" };
  });
  styleHeader(timeline);
  if (events.length > 0) {
    timeline.autoFilter = { from: "A1", to: `F${events.length + 1}` };
    const totalRow = timeline.addRow({
      title: "Total",
      cost: { formula: `SUM(D2:D${events.length + 1})`, result: totalCost },
    });
    totalRow.font = { bold: true };
  }

  // Documents
  const docs = wb.addWorksheet("Documents");
  docs.columns = [
    { header: "Date", key: "date", width: 12, style: { numFmt: DATE_FORMAT } },
    { header: "Title", key: "title", width: 32 },
    { header: "Category", key: "category", width: 14 },
    { header: "Notes", key: "notes", width: 50 },
    { header: "Attachments", key: "attachments", width: 36 },
  ];
  for (const d of documents) {
    const row = docs.addRow({
      date: excelDay(d.documentDate),
      title: d.title,
      category: capitalize(d.category),
      notes: d.notes ?? "",
      attachments: fileList(d.attachments),
    });
    row.alignment = { wrapText: true, vertical: "top" };
  }
  styleHeader(docs);
  if (documents.length > 0) {
    docs.autoFilter = { from: "A1", to: `E${documents.length + 1}` };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// "Maple St. House" -> "maple-st-house"
export function fileSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "property";
}

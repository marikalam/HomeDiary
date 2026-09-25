import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { authRouter } from "./routes/auth";
import { propertiesRouter } from "./routes/properties";
import { eventsRouter } from "./routes/events";
import { documentsRouter } from "./routes/documents";
import { attachmentsRouter } from "./routes/attachments";
import { googleRouter } from "./routes/google";

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;

app.use(
  cors({
    origin: CLIENT_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/properties", propertiesRouter);
app.use("/api/properties/:propertyId/events", eventsRouter);
app.use("/api/properties/:propertyId/documents", documentsRouter);
app.use("/api/attachments", attachmentsRouter);
app.use("/api/google", googleRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Serve the built React app when it's present (single-service production deploy)
const clientDist = path.join(__dirname, "..", "public");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`HomeDiary server listening on http://localhost:${PORT}`);
});

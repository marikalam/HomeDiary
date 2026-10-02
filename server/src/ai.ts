import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";

// Photo -> timeline event drafting with Claude. Optional: the "Add from
// photos" button only appears when ANTHROPIC_API_KEY is set, the same way
// Google Calendar linking only appears when its credentials are set.
export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

// Kept in sync with EVENT_TYPES in client/src/types.ts
const EVENT_TYPES = [
  "purchase",
  "damage",
  "repair",
  "inspection",
  "maintenance",
  "renovation",
  "other",
] as const;

// eventType is a plain string rather than z.enum: the SDK only passes enums
// through to the API as a description hint, so an unexpected value would
// fail parsing. It's mapped onto EVENT_TYPES below instead.
const EventDraftSchema = z.object({
  title: z.string(),
  eventType: z.string(),
  description: z.string(),
  cost: z.number().nullable(),
});

export type EventDraft = z.infer<typeof EventDraftSchema> & { eventType: (typeof EVENT_TYPES)[number] };

// Errors whose message is safe and useful to show the user as-is
export class PhotoAnalysisError extends Error {}

// Image types the Claude API accepts. The client downscales photos to JPEG
// before sending them here, so in practice this is almost always image/jpeg.
export const ANALYZABLE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AnalyzableImageType = (typeof ANALYZABLE_IMAGE_TYPES)[number];

export function isAnalyzableImage(mimeType: string): mimeType is AnalyzableImageType {
  return (ANALYZABLE_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

const SYSTEM_PROMPT = `You help a homeowner keep a diary of everything that happens at their property.
You'll be shown one or more photos taken around the same event, and you draft a single timeline entry for it.

Look closely and pull out every useful detail a homeowner would want on record later: appliance or
fixture brand and model (from logos, badges or labels), what work is being done and where in the house,
materials and parts involved, condition of things (damage, wear, frost, leaks, exposed wiring...),
anything being removed, delivered or hauled away, and any readable text such as receipts, model or
serial numbers, or prices. Only state what the photos actually show; when you're inferring, say so
("appears to be", "likely").

Describe people only by what they're doing - never guess names or identities.

Fields:
- title: a short headline for the event, like "Replaced basement fluorescent lights" (under 70 characters).
- eventType: the closest category - exactly one of ${EVENT_TYPES.join(", ")}.
- description: one or two sentences summarizing what happened, then a blank line, then a "Details"
  list of short "- " bullet points with the specific things you noticed. Plain text, no markdown headings.
- cost: only if a price or receipt total is clearly visible in a photo; otherwise null.`;

export async function draftEventFromPhotos(
  images: { data: Buffer; mediaType: AnalyzableImageType }[],
  context: { propertyName: string; address: string | null; eventDate?: string; notes?: string }
): Promise<EventDraft> {
  const contextLines = [
    `Property: ${context.propertyName}${context.address ? ` (${context.address})` : ""}`,
    context.eventDate ? `Date of the event: ${context.eventDate}` : null,
    context.notes ? `Homeowner's note: ${context.notes}` : null,
  ].filter(Boolean);

  const response = await getClient().beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(EventDraftSchema) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.data.toString("base64") },
          })),
          {
            type: "text" as const,
            text: `${contextLines.join("\n")}\n\nDraft the timeline entry for ${
              images.length === 1 ? "this photo" : `these ${images.length} photos`
            }.`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new PhotoAnalysisError("Claude couldn't describe these photos. Try different photos or fill in the event by hand.");
  }
  if (!response.parsed_output) {
    throw new PhotoAnalysisError("Claude's response couldn't be read. Please try again.");
  }
  const draft = response.parsed_output;
  const eventType = EVENT_TYPES.find((t) => t === draft.eventType.trim().toLowerCase()) ?? "other";
  return { ...draft, eventType };
}

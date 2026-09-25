import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

// A small (~90MB, cached after first download), fast sentence-embedding
// model that runs fully locally - no API key, no per-query cost, no
// external service. Loaded lazily on first use so server boot/health
// checks aren't slowed down by it, and cached for the life of the process.
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_ID);
  }
  return extractorPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

// Vectors from embedText() are already L2-normalized, so the dot product
// alone equals cosine similarity (range -1..1, higher is more similar).
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function eventEmbeddingText(event: {
  title: string;
  eventType: string;
  description?: string | null;
}): string {
  return [event.title, event.eventType, event.description].filter(Boolean).join(". ");
}

import type { FeatureExtractionPipeline } from "@huggingface/transformers";

// A small (~90MB, cached after first download), fast sentence-embedding
// model that runs fully locally - no API key, no per-query cost, no
// external service. The package itself (not just the model) is loaded
// lazily via dynamic import: it pulls in onnxruntime-node, a ~300MB native
// module, and a static top-level import would make every route file that
// touches this one pull that in at server boot - slowing/loading it even
// for requests (or a health check) that never need an embedding.
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = import("@huggingface/transformers").then(({ pipeline }) =>
      pipeline("feature-extraction", MODEL_ID)
    );
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

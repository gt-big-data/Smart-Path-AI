const DECAY_PER_INTERVAL = 0.05;
const DECAY_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

/** Match the AI server's linear decay: 0.05 per 30 days without practice. */
export function calculateDecayedConfidence(
  confidenceScore: number,
  lastPracticedAt: Date | null | undefined,
  currentTimeMs = Date.now(),
): number {
  if (!lastPracticedAt || !Number.isFinite(lastPracticedAt.getTime())) {
    return confidenceScore;
  }
  const elapsedMs = Math.max(0, currentTimeMs - lastPracticedAt.getTime());
  const decay = elapsedMs / DECAY_INTERVAL_MS * DECAY_PER_INTERVAL;
  return Math.max(0, Math.min(1, confidenceScore - decay));
}

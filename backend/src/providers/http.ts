/**
 * fetch that, on HTTP 429 (Groq rate limit), waits the advised time (max 8s) and retries once.
 * Keeps a short burst from turning into a failed answer for the student.
 */
export async function fetchWithRateLimitRetry(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 429) return res;
  const wait = Math.min(8, Number(res.headers.get("retry-after")) || 3);
  console.warn(`Groq rate limited; retrying in ${wait}s`);
  await new Promise((r) => setTimeout(r, wait * 1000));
  return fetch(url, init);
}

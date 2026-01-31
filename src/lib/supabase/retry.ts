/**
 * src/lib/supabase/retry.ts
 * -----------------------------------------------------------------------------
 * ## RETRY HELPER (Noob Guide)
 * 
 * This is the "Don't Give Up" function. 
 * 
 * 1. PERSISTENCE: If the internet cuts out for a second, we don't 
 *    want the app to crash or lose your save.
 * 2. BACKOFF: Every time it fails, it waits a little bit LONGER before 
 *    trying again (Exponential Backoff). This avoids "spamming" the server.
 * 
 * ## VAR TRACE
 * - `operation`: (Origin: Caller) The actual task to run (like `saveProject`).
 * - `attempt`: (Origin: Loop) How many times we've tried.
 * - `wait`: (Origin: Math) The duration to sleep before the next try.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    retries?: number;
    delayMs?: number;
    backoffMs?: number;
    onRetry?: (error: unknown, attempt: number) => void;
  } = {}
): Promise<T> {
  const { retries = 3, delayMs = 400, backoffMs = 600, onRetry } = options;
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      attempt += 1;
      onRetry?.(error, attempt);
      const wait = delayMs + backoffMs * attempt;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

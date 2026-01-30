/**
 * Simple retry helper for Supabase calls.
 *
 * Uses exponential backoff to smooth over transient network disconnects.
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

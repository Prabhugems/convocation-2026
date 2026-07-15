const AMASICON_API_BASE_URL =
  process.env.AMASICON_API_BASE_URL || 'https://app.amasicon2026.com';

// Stay comfortably under the API's documented 60 requests/minute limit.
const MIN_REQUEST_INTERVAL_MS = 1100;

// Promise chain for serializing all requests to ensure concurrency-safe rate limiting.
// All calls go through this single queue so no two fetch calls can fire less than
// MIN_REQUEST_INTERVAL_MS apart, regardless of concurrent invocations.
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestCompleteTime = 0;

function scheduleRequest<T>(fn: () => Promise<T>): Promise<T> {
  const result = requestQueue.then(async () => {
    const now = Date.now();
    const timeSinceLastComplete = now - lastRequestCompleteTime;
    const delayNeeded = Math.max(0, MIN_REQUEST_INTERVAL_MS - timeSinceLastComplete);

    if (delayNeeded > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayNeeded));
    }
    lastRequestCompleteTime = Date.now();
    return fn();
  });

  // Keep the queue moving even if this call fails, so later calls aren't stuck.
  requestQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export interface DelegateRegistrationStatus {
  userExists: boolean;
  isPaymentCompleted: boolean;
}

// Thrown specifically when the API signals we've been rate-limited, so
// callers can stop the whole batch early instead of continuing to fail.
export class RateLimitedError extends Error {}

// Checks whether an email belongs to a registered, paid AMASICON 2026
// delegate. Returns null (not false) on an ordinary request failure, so
// callers can distinguish "confirmed not registered" from "couldn't
// check." Throws RateLimitedError on HTTP 429 specifically.
export async function checkDelegateByEmail(
  email: string
): Promise<DelegateRegistrationStatus | null> {
  return scheduleRequest(async () => {
    const url = `${AMASICON_API_BASE_URL}/api/delegate-by-email?email=${encodeURIComponent(
      email
    )}`;

    let response: Response;
    try {
      response = await fetch(url, { method: 'GET' });
    } catch (error) {
      console.error(`[AMASICON API] Network error for ${email}:`, error);
      return null;
    }

    if (response.status === 429) {
      throw new RateLimitedError(`Rate limited checking ${email}`);
    }

    if (!response.ok) {
      console.error(`[AMASICON API] ${response.status} for ${email}`);
      return null;
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      console.error(`[AMASICON API] JSON parse error for ${email}:`, error);
      return null;
    }

    return {
      userExists: Boolean(data.user_exists),
      isPaymentCompleted: Boolean(data.is_payment_completed),
    };
  });
}

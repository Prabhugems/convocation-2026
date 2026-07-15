const AMASICON_API_BASE_URL =
  process.env.AMASICON_API_BASE_URL || 'https://app.amasicon2026.com';

// Stay comfortably under the API's documented 60 requests/minute limit.
const MIN_REQUEST_INTERVAL_MS = 1100;

let lastRequestAt = 0;

async function waitForRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestAt = Date.now();
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
  await waitForRateLimit();

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

  const data = await response.json();
  return {
    userExists: Boolean(data.user_exists),
    isPaymentCompleted: Boolean(data.is_payment_completed),
  };
}

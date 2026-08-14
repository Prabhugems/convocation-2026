// Shared passcode gating destructive admin actions server-side. This is
// intentionally the same value already used to gate the /admin page
// client-side (src/contexts/AuthContext.tsx) — not a new secret to
// distribute, just genuine server-side enforcement where there was none.
export const ADMIN_ACTION_PASSCODE = 'conv2026';

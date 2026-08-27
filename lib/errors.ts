// Supabase errors (PostgrestError, AuthError, FunctionsHttpError) are
// plain objects with a `.message`, not `instanceof Error` — checking that
// first silently swallows the real reason and always shows a generic
// fallback instead.
export function friendlyErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const raw =
    err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : err instanceof Error
        ? err.message
        : fallback;

  // "JWT issued at future" (and similar clock-skew messages) means the
  // phone's own clock is wrong, not that anything in the app broke — this
  // raw message means nothing to a non-technical reader, so translate it
  // into the actual fix.
  if (/jwt issued.*future/i.test(raw) || /clock skew/i.test(raw)) {
    return "Your phone's clock looks off, which is blocking sign-in checks. Check Settings → General → Date & Time, turn on \"Set Automatically,\" then reopen the app.";
  }

  return raw;
}

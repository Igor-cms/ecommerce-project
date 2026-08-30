/**
 * Phone validation/sanitization helpers.
 * Shopify rejects many "almost-E.164" numbers, so we apply a stricter check
 * than just `^\+\d{6,}$`.
 */

/**
 * Normalize a raw phone string:
 * - trims
 * - removes spaces, dashes, parentheses, dots
 * - keeps the leading "+" if present
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/[^\d]/g, "");
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Strict E.164 validation aligned with Shopify expectations:
 * - must start with "+"
 * - country code starts with 1-9 (no leading 0)
 * - total length between 8 and 16 chars (incl. "+")
 *   = country code (1-3 digits) + subscriber number, max 15 digits per E.164
 */
export function isValidE164(phone: string): boolean {
  if (!phone) return false;
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Returns a normalized + validated phone, or null if input is empty.
 * Throws an Error with a friendly message if a non-empty value is invalid.
 */
export function sanitizePhoneOrThrow(raw: string | null | undefined): string | null {
  const normalized = normalizePhone(raw);
  if (!normalized) return null;
  if (!isValidE164(normalized)) {
    throw new Error(
      "Phone must be in international E.164 format (e.g. +353871234567), max 15 digits."
    );
  }
  return normalized;
}

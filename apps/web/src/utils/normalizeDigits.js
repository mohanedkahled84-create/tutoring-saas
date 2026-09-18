/**
 * Normalizes Eastern Arabic (٠-٩) and Persian (۰-۹) digits to standard ASCII digits (0-9).
 * Crucial for mobile phones where the Arabic keyboard enters Arabic-Indic numerals.
 */
export function normalizeDigits(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776))
    .trim();
}

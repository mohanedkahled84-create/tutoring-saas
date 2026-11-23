/** A batch must always name the intended students; an empty selection means none. */
export function portalRecipientIds(value: unknown): Set<string> | null {
  if (!Array.isArray(value) || value.length === 0 || value.some(id => typeof id !== 'string' || !id.trim())) return null;
  return new Set(value.map(id => id.trim()));
}

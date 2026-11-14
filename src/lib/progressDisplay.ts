export function hasResolvedProgressName(name: string, conceptId: string): boolean {
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.toLowerCase().startsWith('unknown topic')) return false;
  if (/^question \d+ concept$/i.test(normalizedName)) return false;
  if (normalizedName.toLowerCase() === conceptId.trim().toLowerCase()) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedName)) return false;
  return !/^\d+:[^:]+:\d+$/.test(normalizedName);
}

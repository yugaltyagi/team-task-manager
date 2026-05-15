/** Express 5 may type `req.params` loosely on merged routers; read by key. */
export function paramString(params: object, key: string): string | undefined {
  const v = (params as Record<string, unknown>)[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

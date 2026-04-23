export const interpolateTemplate = (body: string, variables: Record<string, string>): string =>
  body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => {
    const v = variables[key];
    return v === undefined || v === null ? '' : String(v);
  });

export const sha256Hex = async (input: string): Promise<string> => {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

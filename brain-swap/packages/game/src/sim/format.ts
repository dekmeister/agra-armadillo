/** Parse a text literal into the JSON value the schema expects (number / boolean / string). */
export function parseLiteral(text: string): string | number | boolean {
  const t = text.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t !== "" && !Number.isNaN(Number(t))) return Number(t);
  return text;
}

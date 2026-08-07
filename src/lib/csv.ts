type Cell = string | number | boolean | Date | null | undefined;

/** Byte-order mark — makes Excel read the file as UTF-8 instead of mangling non-ASCII names. */
const BOM = "\uFEFF";

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let raw = value instanceof Date ? value.toISOString() : String(value);
  // Neutralize spreadsheet formula injection: a leading =, +, -, @, or control
  // char makes Excel/Sheets evaluate member-controlled text as a formula. A
  // leading apostrophe forces the cell to be treated as literal text.
  if (/^[=+\-@\t\r]/.test(raw)) raw = `'${raw}`;
  // Quote whenever the value could otherwise break the row/column structure.
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((r) => r.map(escapeCell).join(",")),
  ];
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

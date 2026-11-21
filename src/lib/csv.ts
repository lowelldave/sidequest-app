/**
 * A small CSV reader. It handles quoted fields (with commas, quotes and line
 * breaks inside), Windows and Mac line endings, a leading byte-order mark, and
 * the semicolon or tab separators some spreadsheet programs use.
 */

function detectDelimiter(text: string): string {
  // Count the separators in the first line, ignoring any inside quotes.
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  return (Object.keys(counts) as string[]).reduce((best, d) => (counts[d] > counts[best] ? d : best), ",");
}

/** Reads CSV text into rows of cells. Rows with nothing in them are left out. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === "\n") {
      endRow();
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

/** Writes rows as CSV text, quoting any cell that needs it. */
export function toCsv(rows: string[][]): string {
  const cell = (value: string) => (/[",\r\n;\t]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

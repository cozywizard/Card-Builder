// Minimal CSV fetcher + parser for importing public Google Sheets CSV exports
export async function fetchCsv(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch CSV: ${resp.status} ${resp.statusText}`);
  const text = await resp.text();
  return parseCsvToRows(text);
}

// Very small CSV parser that supports quoted fields and commas inside quotes.
export function parseCsvToRows(csvText) {
  if (!csvText) return [];
  const rows = [];
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) return rows;

  const headers = parseCsvLine(lines[0]).map(h => h.trim());

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = values[i] !== undefined ? values[i] : '';
    }
    rows.push(obj);
  }

  return rows;
}

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

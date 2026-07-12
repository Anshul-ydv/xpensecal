// A small, dependency-free CSV parser.
//
// We parse the file ourselves (rather than pull in a library) so that, during
// the live session, every line of the parse is explainable. It handles the two
// things that actually matter for this file: quoted fields, and escaped double
// quotes ("") inside quoted fields. Newlines inside quoted fields are supported
// too. It does NOT try to be a full RFC-4180 implementation beyond that.

export type CsvTable = {
  header: string[];
  rows: string[][]; // data rows only (header removed)
};

export function parseCsv(text: string): CsvTable {
  // Normalize line endings.
  const src = text.replace(/\r\n?/g, "\n");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }

  // Flush the trailing field/record if the file didn't end with a newline.
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  // Drop fully-empty trailing records.
  const cleaned = records.filter(
    (r) => !(r.length === 1 && r[0].trim() === ""),
  );

  const [header, ...rows] = cleaned;
  return { header: header ?? [], rows };
}

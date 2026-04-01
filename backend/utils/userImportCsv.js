const csvParser = require("csv-parser");
const { Readable } = require("stream");

const EMAIL_HEADER_ALIASES = new Set(["emailaddress", "email"]);
const NAME_HEADER_ALIASES = new Set(["fullname", "name"]);
const SUPPORTED_DELIMITERS = [",", ";", "\t"];

const stripBom = (value = "") => value.replace(/^\uFEFF/, "");

const normalizeText = (value) =>
  value === null || typeof value === "undefined" ? "" : String(value).trim();

const normalizeEmail = (value) => normalizeText(value).toLowerCase();

const normalizeHeader = (value) =>
  stripBom(normalizeText(value)).replace(/[^a-z0-9]/gi, "").toLowerCase();

const countDelimiterOccurrences = (line, delimiter) => {
  let count = 0;
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
};

const splitDelimitedLine = (line, delimiter) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);

  return values;
};

// Pick the most likely delimiter from the header row so exported files from
// different spreadsheet tools still import without manual cleanup.
const detectDelimiter = (headerLine) => {
  const bestMatch = SUPPORTED_DELIMITERS
    .map((delimiter) => ({
      delimiter,
      count: countDelimiterOccurrences(headerLine, delimiter),
    }))
    .sort((left, right) => right.count - left.count)[0];

  return bestMatch?.count ? bestMatch.delimiter : ",";
};

const parseRows = (content, delimiter) =>
  new Promise((resolve, reject) => {
    const rows = [];

    Readable.from([content])
      .pipe(
        csvParser({
          separator: delimiter,
          skipComments: false,
          strict: false,
          mapHeaders: ({ header }) => normalizeHeader(header),
          mapValues: ({ value }) => normalizeText(value),
        })
      )
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });

const resolveColumnKey = (headers, aliases) =>
  headers.find((header) => aliases.has(header)) || "";

const parseUserImportCsv = async (buffer) => {
  const content = stripBom(buffer.toString("utf8"));
  const lines = content.split(/\r?\n/);
  const headerLine = lines.find((line) => normalizeText(line));

  if (!headerLine) {
    return {
      delimiter: ",",
      headers: [],
      nameKey: "",
      emailKey: "",
      rows: [],
    };
  }

  const delimiter = detectDelimiter(headerLine);
  const headers = splitDelimitedLine(headerLine, delimiter).map(normalizeHeader);
  const rows = await parseRows(content, delimiter);
  const nameKey = resolveColumnKey(headers, NAME_HEADER_ALIASES);
  const emailKey = resolveColumnKey(headers, EMAIL_HEADER_ALIASES);

  return {
    delimiter,
    headers,
    nameKey,
    emailKey,
    rows: rows.map((row, index) => ({
      row: index + 2,
      raw: row,
      name: normalizeText(row[nameKey]),
      email: normalizeEmail(row[emailKey]),
      isEmpty: Object.values(row).every((value) => !normalizeText(value)),
    })),
  };
};

module.exports = {
  normalizeEmail,
  normalizeHeader,
  normalizeText,
  parseUserImportCsv,
};

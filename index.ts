export type DnszDnsRecord = {
  /** The lowercase DNS name without a trailing dot, e.g. `"example.com"`. */
  name: string;
  /** The TTL in seconds, e.g. `60`. */
  ttl: number;
  /** The DNS class, e.g. `"IN"`. */
  class: string;
  /** The record type, e.g. `"A"`. */
  type: string;
  /** The record content, e.g. `"2001:db8::1"` or `"example.com."`. */
  content: string;
  /** A comment, e.g. `"a comment"`, `null` if absent. */
  comment: string | null;
};

export type DnszDnsData = {
  /** Array of `record` */
  records: Array<DnszDnsRecord>;
  /** The value of `$ORIGIN` in the zone file. */
  origin?: string;
  /** The value of `$TTL` in the zone file. */
  ttl?: number;
  /** An optional header at the start of the file. Can be multiline. Does not include comment markers. */
  header?: string;
};

export type DnszParseOptions = {
  /** When specified, used instead of `$ORIGIN` to resolve `@` and relative names. */
  replaceOrigin?: string | null;
  /** When true, emit `\r\n` instead of `\n` in `header`. */
  crlf?: boolean;
  /** Default class when absent. */
  defaultClass?: string;
  /** Default TTL when absent and `$TTL` is not present. */
  defaultTTL?: number;
  /** Ensure trailing dots on FQDNs in content. Supports a limited amount of record types. */
  dots?: boolean;
};

export type DnszStringifyOptions = {
  /** Whether to group records into sections. */
  sections?: boolean;
  /** When `true`, emit `\r\n` instead of `\n` for the resulting zone file. */
  crlf?: boolean;
  /** Ensure trailing dots on FQDNs in content. Supports a limited amount of record types. Default: `false`. */
  dots?: boolean;
};

// Indexes of name-like content fields per record type, used by the `dots` option
const nameLike: Record<string, Array<number>> = {
  ALIAS: [0],
  ANAME: [0],
  CNAME: [0],
  DNAME: [0],
  MX: [1],
  NAPTR: [5],
  NS: [0],
  NSEC: [0],
  PTR: [0],
  RP: [0, 1],
  RRSIG: [7],
  SIG: [7],
  SOA: [0, 1],
  SRV: [3],
  TKEY: [0],
  TSIG: [0],
};

function normalize(name: string) {
  name = name.toLowerCase();
  if (name.endsWith(".") && name.length > 1) {
    name = name.slice(0, -1);
  }
  return name.replace(/\.{2,}/g, ".").replace(/@\./g, "@");
}

function splitString(input: string, separator: string): Array<string> {
  const parts: Array<string> = [];
  let current = "";
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === "\\") {
      current += input.slice(i, i + 2);
      i++;
    } else if (char === `"`) {
      let end = input.indexOf(`"`, i + 1);
      while (end > -1 && input[end - 1] === "\\") end = input.indexOf(`"`, end + 1);
      if (end > -1) {
        current += input.slice(i, end + 1);
        i = end;
      } else {
        current += char;
      }
    } else if (char === separator) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

// RFC 1035 §5.1 parens only group data across lines, parens inside quotes are ignored
function parenDepth(s: string): number {
  let depth = 0;
  let inQuote = false;
  let escaped = false;
  for (const c of s) {
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === `"`) { inQuote = !inQuote; continue; }
    if (inQuote) continue;
    if (c === "(") depth++;
    else if (c === ")") depth--;
  }
  return depth;
}

function stripParens(s: string): string {
  if (!s.includes("(") && !s.includes(")")) return s;
  let out = "";
  let inQuote = false;
  let escaped = false;
  for (const c of s) {
    if (escaped) { escaped = false; out += c; continue; }
    if (c === "\\") { escaped = true; out += c; continue; }
    if (c === `"`) { inQuote = !inQuote; out += c; continue; }
    if (!inQuote && (c === "(" || c === ")")) continue;
    out += c;
  }
  return out.replace(/\s+/g, " ").trim();
}

function denormalize(name: string) {
  if (name && !name.endsWith(".")) {
    name += ".";
  }
  return name.replace(/\.{2,}/g, ".").replace(/@\./g, "@");
}

function addDots(content: string, type: string): string {
  if (!(type in nameLike)) return content;
  const indexes = nameLike[type];
  const parts = splitString(content, " ").map(part => part.trim()).filter(Boolean);
  for (const index of indexes) {
    if (parts[index] && !parts[index].endsWith(".")) {
      parts[index] += ".";
    }
  }
  return parts.join(" ");
}

const MAX_TTL = 2147483647;

function clampTTL(value: number): number {
  return Math.min(Math.max(0, value), MAX_TTL);
}

const ttlUnit: Record<string, number> = {s: 1, m: 60, h: 3600, d: 86400, w: 604800};

function parseTTL(ttl: string, def?: number): number {
  if (typeof def === "number" && !ttl) {
    return clampTTL(def);
  }

  const matches = Array.from(ttl.matchAll(/(\d+)([smhdw]?)/gi));
  if (!matches.length) return clampTTL(typeof def === "number" ? def : NaN);
  return clampTTL(matches.reduce((acc, match) =>
    acc + Number.parseInt(match[1]) * (ttlUnit[match[2].toLowerCase()] || 1), 0));
}

type FormatOpts = {
  origin: string,
  newline: string,
  sections: boolean,
  dots: boolean,
};

function format(records: Array<DnszDnsRecord | undefined>, type: string | null, {origin, newline, sections, dots}: FormatOpts) {
  let str = "";

  if (type) {
    str += `;; ${type} Records${newline}`;
  }

  const suffix = origin ? `.${origin}` : "";
  for (const record of records) {
    if (!record) continue;
    let name = normalize(record.name || "");

    if (origin) {
      if (name === origin) {
        name = "@";
      } else if (name.endsWith(suffix)) {
        name = name.slice(0, -suffix.length);
      } else {
        name = denormalize(name);
      }
    } else if (name.includes(".")) {
      name = denormalize(name);
    }

    const fields = [
      name,
      record.ttl,
      record.class,
      record.type,
      dots ? addDots(record.content, record.type) : record.content,
    ];

    if (record.comment) {
      fields.push(`; ${record.comment}`);
    }

    str += `${fields.join("\t")}${newline}`;
  }
  return `${str}${sections ? newline : ""}`;
}

function splitContentAndComment(str?: string): [content: string | null, comment: string | null] {
  if (!str) return [null, null];
  const [first, ...rest] = splitString(str, ";");
  const parts = [first, rest.join(";")].map(part => part.trim()).filter(Boolean);
  return [parts[0] || null, parts[1] || null];
}

/** Parse a string of a DNS zone file and returns a `data` object. */
export function parseZone(str: string, {replaceOrigin = null, crlf = false, defaultTTL = 60, defaultClass = "IN", dots = false}: DnszParseOptions = {}): DnszDnsData {
  const data: Partial<DnszDnsData> = {};
  const rawLines = str.split(/\r?\n/);
  const trimmedRawLines = rawLines.map(l => l.trim());
  const lines = trimmedRawLines.map((text, i) => ({text, inherited: /^\s/.test(rawLines[i])})).filter(({text}) => Boolean(text) && !text.startsWith(";"));
  const newline = crlf ? "\r\n" : "\n";

  // multiline record support (RFC 1035 §5.1)
  const combinedLines: typeof lines = [];
  let i = 0;
  while (i < lines.length) {
    const {text: line, inherited} = lines[i];
    const [firstContent] = splitContentAndComment(line);
    if (firstContent && parenDepth(firstContent) > 0) {
      let combined = firstContent;
      i++;
      while (i < lines.length && parenDepth(combined) > 0) {
        const [nextContent] = splitContentAndComment(lines[i].text);
        if (nextContent) combined += ` ${nextContent}`;
        i++;
      }
      combinedLines.push({text: stripParens(combined), inherited});
    } else {
      combinedLines.push({text: stripParens(line), inherited});
      i++;
    }
  }

  const headerLines: Array<string> = [];
  for (const [index, line] of trimmedRawLines.entries()) {
    if (line.startsWith(";;")) {
      headerLines.push(line.substring(2).trim());
    } else if (line === "" && index >= 1 && trimmedRawLines[index - 1].startsWith(";;")) {
      data.header = headerLines.join(newline);
      break;
    }
  }

  if (replaceOrigin) data.origin = normalize(replaceOrigin);

  const reLine = /^([a-z0-9_.\-@*/+\\]+)?\s*((?:[0-9]+[smhdw]?)+)?\s*([a-z]+[0-9]*)?\s+([a-z]+[0-9]*)?\s+(.+)$/i; // eslint-disable-line regexp/no-misleading-capturing-group -- name and ttl overlap, disambiguated after exec

  data.records = [];
  let prevName = "";
  let prevClass = defaultClass;
  for (const {text: line, inherited} of combinedLines) {
    if (line.startsWith("$")) {
      const parsedOrigin = (/^\$ORIGIN\s+(\S+)/i.exec(line) || [])[1];
      if (parsedOrigin && !replaceOrigin) data.origin = normalize(parsedOrigin);
      const parsedTtl = (/^\$TTL\s+(\S+)/i.exec(line) || [])[1];
      if (parsedTtl) data.ttl = parseTTL(parsedTtl);
      continue;
    }

    let [name, ttl, cls, type, contentAndComment] = (reLine.exec(line) || []).slice(1);
    if (!ttl && name && /^[0-9]/.test(name)) {
      ttl = name;
      name = "";
    }
    if (cls && !type) {
      type = cls;
      cls = "";
    }
    if (!cls) cls = prevClass;
    let [content, comment] = splitContentAndComment(contentAndComment);

    if (!name) name = "";
    if (!cls || !type || !content) continue;

    type = type.toUpperCase();
    cls = cls.toUpperCase();
    if (dots) content = addDots(content, type);

    // Resolve name: inheritance, then relative-to-origin (RFC 1035 §5.1)
    let resolvedName: string;
    if (inherited && prevName) {
      resolvedName = prevName;
    } else if ((!name || name === "@") && data.origin) {
      resolvedName = data.origin;
    } else if (data.origin && !name.endsWith(".")) {
      resolvedName = `${normalize(name)}.${data.origin}`;
    } else {
      resolvedName = normalize(name);
    }

    if (!resolvedName) continue;

    prevName = resolvedName;
    prevClass = cls;

    data.records.push({
      name: resolvedName,
      ttl: parseTTL(ttl, data.ttl ?? defaultTTL),
      class: cls,
      type,
      content,
      comment,
    });
  }

  if (replaceOrigin) {
    data.origin = replaceOrigin;
  }

  return data as DnszDnsData;
}

/** Parse a `data` object and return a string with the zone file contents. */
export function stringifyZone(data: DnszDnsData, {crlf = false, sections = true, dots = false}: DnszStringifyOptions = {}): string {
  const recordsByType: Record<string, Array<DnszDnsRecord>> = {};
  const newline = crlf ? "\r\n" : "\n";

  if (sections) {
    for (const record of data.records) {
      if (!recordsByType[record.type]) recordsByType[record.type] = [];
      recordsByType[record.type].push(record);
    }
  }

  let output = "";
  if (data.header) {
    output += `${data.header
      .split(/\r?\n/)
      .map(l => l.trim())
      .map(l => l ? `;; ${l}` : ";;")
      .join(newline)
      .trim()}${newline}${newline}`;
  }

  const vars: Array<string> = [];
  if (data.origin) vars.push(`$ORIGIN ${denormalize(data.origin)}`);
  if (data.ttl !== undefined) vars.push(`$TTL ${data.ttl}`);
  if (vars.length) output += `${vars.join(newline)}${newline}${newline}`;

  const formatOpts = {origin: normalize(data.origin || ""), newline, sections, dots};
  if (sections) {
    if (recordsByType.SOA) {
      output += format(recordsByType.SOA, "SOA", formatOpts);
      delete recordsByType.SOA;
    }

    for (const type of Object.keys(recordsByType).sort()) {
      output += format(recordsByType[type], type, formatOpts);
    }
  } else {
    output += format(data.records.filter(r => r.type === "SOA"), null, formatOpts);
    output += format(data.records.filter(r => r.type !== "SOA"), null, formatOpts);
  }

  return `${output.trim()}${newline}`;
}

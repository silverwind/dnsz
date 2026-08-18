export type DnszDnsRecord = {
    /**The lowercase DNS name without a trailing dot, e.g. `"example.com"`. */
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
    /**  The value of `$ORIGIN` in the zone file. */
  origin?: string;
    /** The value of `$TTL` in the zone file. */
  ttl?: number;
    /** An optional header at the start of the file. Can be multiline. Does not include comment markers. */
  header?: string;
};

export type DnszParseOptions = {
    /** When specified, replaces any `@` in `name` or `content` with it. */
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

// List of types and places where they have name-like content, used on the `dot` option.
const nameLike = {
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
  name = (name || "").toLowerCase();
  if (name.endsWith(".") && name.length > 1) {
    name = name.substring(0, name.length - 1);
  }
  return name.replace(/\.{2,}/g, ".").replace(/@\./g, "@");
}

function splitString(input: string, {separator = " ", quotes = []}: {separator?: string, quotes?: Array<string>} = {}) {
  const ast = {type: "root", nodes: [], stash: [""]};
  const stack = [ast];
  const string = input;
  let value: string;
  let node: any;
  let i = -1;
  const state: Record<string, any> = {stack};

  const block = () => (state.block = stack[stack.length - 1]);
  const peek = () => string[i + 1];
  const next = () => string[++i];
  const append = (value: string) => {
    state.value = value;
    if (value) {
      state.block.stash[state.block.stash.length - 1] += value;
    }
  };

  const closeIndex = (value: string, startIdx: number) => {
    let idx = string.indexOf(value, startIdx);
    if (idx > -1 && string[idx - 1] === "\\") {
      idx = closeIndex(value, idx + 1);
    }
    return idx;
  };

  while (i < string.length - 1) {
    state.value = value = next();
    state.index = i;
    block();

    if (value === "\\") {
      if (peek() === "\\") {
        append(value + next());
      } else {
        append(value);
        append(next());
      }
      continue;
    }

    if (quotes.includes(value)) {
      const pos = i + 1;
      const idx = closeIndex(value, pos);

      if (idx > -1) {
        append(value);
        append(string.slice(pos, idx));
        append(string[idx]);
        i = idx;
        continue;
      }

      append(value);
      continue;
    }

    if (value === separator && state.block.type === "root") {
      state.block.stash.push("");
      continue;
    }

    append(value);
  }

  node = stack.pop();
  while (node !== ast) {
    value = (node.parent.stash.pop() + node.stash.join("."));
    node.parent.stash = node.parent.stash.concat(value.split("."));
    node = stack.pop();
  }

  return node.stash;
}

// RFC 1035 §5.1: parens group data across line boundaries and have no
// other meaning. These helpers ignore parens inside quoted strings.
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

function addDots(content: string, indexes: Array<number>): string {
  const parts = splitString(content, {
    quotes: [`"`],
    separator: " ",
  }).map((s: string) => s.trim()).filter(Boolean);
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

function parseTTL(ttl: string | number, def?: number): number {
  if (typeof ttl === "number") {
    return clampTTL(ttl);
  }

  if (typeof def === "number" && !ttl) {
    return clampTTL(def);
  }

  const matches = Array.from(ttl.matchAll(/(\d+)([smhdw]?)/gi));
  if (!matches.length) return clampTTL(typeof def === "number" ? def : NaN);
  return clampTTL(matches.reduce((acc, [, num, unit]) =>
    acc + Number.parseInt(num) * (ttlUnit[unit.toLowerCase()] || 1), 0));
}

type FormatOpts = {
  origin: string,
  newline: string,
  sections: boolean,
  dots: boolean,
};

function format(records: Array<DnszDnsRecord | undefined>, type: string | null, {origin, newline, sections, dots}: FormatOpts) {
  let str = ``;

  if (sections && type) {
    str += `;; ${type} Records${newline}`;
  }

  const suffix = origin ? `.${origin}` : "";
  for (const record of records || []) {
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
    } else {
      name = normalize(name);
    }

    let content = record.content;
    if (dots && record.type in nameLike) {
      content = addDots(content, nameLike[record.type as keyof typeof nameLike]);
    }

    const fields = [
      name,
      record.ttl,
      record.class,
      record.type,
      content,
    ];

    if (record.comment) {
      fields.push(`; ${record.comment}`);
    }

    str += `${fields.join("\t")}${newline}`;
  }
  return `${str}${sections ? newline : ""}`;
}

function splitContentAndComment(str?: string): [content: string | null, comment: string | null | undefined] {
  if (!str) return [null, null];
  const splitted = splitString(str, {
    quotes: [`"`],
    separator: ";",
  });

  let parts: Array<string>;
  if (splitted.length > 2) { // more than one semicolon
    parts = [splitted[0], splitted.slice(1).join(";")];
  } else {
    parts = splitted;
  }

  parts = parts.map((part: string) => (part || "").trim()).filter(Boolean);

  if (parts.length <= 2) {
    return [parts[0] || null, parts[1] || null];
  } else {
    const comment = parts.pop();
    const content = parts.join("; ");
    return [content, comment];
  }
}

/** Parse a string of a DNS zone file and returns a `data` object. */
export function parseZone(str: string, {replaceOrigin = null, crlf = false, defaultTTL = 60, defaultClass = "IN", dots = false}: DnszParseOptions = {}): DnszDnsData {
  const data: Partial<DnszDnsData> = {};
  const rawLines = str.split(/\r?\n/);
  const trimmedRawLines = rawLines.map(l => l.trim());
  let lines = trimmedRawLines.map((text, i) => ({text, inherited: /^\s/.test(rawLines[i])})).filter(({text}) => Boolean(text) && !text.startsWith(";"));
  const newline = crlf ? "\r\n" : "\n";

  // multiline record support (RFC 1035 §5.1)
  const combinedLines: typeof lines = [];
  let i = 0;
  while (i < lines.length) {
    const {text: line, inherited} = lines[i];
    const [firstContent] = splitContentAndComment(line);
    const head = firstContent || "";
    if (parenDepth(head) > 0) {
      let combined = head;
      i++;
      while (i < lines.length && parenDepth(combined) > 0) {
        const [nextContent] = splitContentAndComment(lines[i].text);
        const next = (nextContent || "").trim();
        if (next) combined += ` ${next}`;
        i++;
      }
      combinedLines.push({text: stripParens(combined), inherited});
    } else {
      combinedLines.push({text: stripParens(line), inherited});
      i++;
    }
  }
  lines = combinedLines;

  // search for header
  const headerLines: Array<string> = [];
  let valid: boolean = false;
  for (const [index, line] of trimmedRawLines.entries()) {
    if (line.startsWith(";;")) {
      headerLines.push(line.substring(2).trim());
    } else if (line === "" && index >= 1 && trimmedRawLines[index - 1]?.startsWith(";;")) {
      valid = true;
      break;
    }
  }
  if (valid && headerLines.length) {
    data.header = headerLines.join(newline);
  }

  if (replaceOrigin) data.origin = normalize(replaceOrigin);

  // eslint-disable-next-line regexp/no-misleading-capturing-group
  const reLine = /^([a-z0-9_.\-@*/+\\]+)?\s*((?:[0-9]+[smhdw]?)+)?\s*([a-z]+[0-9]*)?\s+([a-z]+[0-9]*)?\s+(.+)$/i;

  data.records = [];
  let prevName = "";
  let prevClass = defaultClass;
  for (const {text: line, inherited} of lines) {
    if (line.startsWith("$")) {
      const parsedOrigin = (/^\$ORIGIN\s+(\S+)/i.exec(line) || [])[1];
      if (parsedOrigin && !replaceOrigin) data.origin = normalize(parsedOrigin);
      const parsedTtl = (/^\$TTL\s+(\S+)/i.exec(line) || [])[1];
      if (parsedTtl) data.ttl = parseTTL(normalize(parsedTtl));
      continue;
    }

    let [, name, ttl, cls, type, contentAndComment] = reLine.exec(line) || [];
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
    content = (content || "").trim();
    if (dots && type in nameLike) {
      content = addDots(content, nameLike[type as keyof typeof nameLike]);
    }

    // Resolve name: inheritance, then relative-to-origin (RFC 1035 §5.1)
    const isAbsolute = name.endsWith(".");
    let resolvedName: string;
    if (inherited && prevName) {
      resolvedName = prevName;
    } else if ((!name || name === "@") && data.origin) {
      resolvedName = data.origin;
    } else if (name && name !== "@" && !isAbsolute && data.origin) {
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
      comment: (comment || "").trim() || null,
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

  const origin = normalize(data.origin || "");
  if (sections) {
    if (recordsByType.SOA) {
      output += format(recordsByType.SOA, "SOA", {origin, newline, sections, dots});
      delete recordsByType.SOA;
    }

    for (const type of Object.keys(recordsByType).sort()) {
      output += format(recordsByType[type], type, {origin, newline, sections, dots});
    }
  } else {
    const recordsSOA = data.records.filter(r => r.type === "SOA");
    const recordsMinusSOA = data.records.filter(r => r.type !== "SOA");

    output += format(recordsSOA, null, {origin, newline, sections, dots});
    output += format(recordsMinusSOA, null, {origin, newline, sections, dots});
  }

  return `${output.trim()}${newline}`;
}

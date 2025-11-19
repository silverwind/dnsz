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

function normalize(name?: string) {
  name = (name || "").toLowerCase();
  if (name.endsWith(".") && name.length > 1) {
    name = name.substring(0, name.length - 1);
  }
  return name.replace(/\.{2,}/g, ".").replace(/@\./, "@");
}

function splitString(input: string, {separator = " ", quotes = []}: {separator?: string, quotes?: Array<string>} = {}) {
  const ast = {type: "root", nodes: [], stash: [""]};
  const stack = [ast];
  const string = input;
  let value: string;
  let node: any;
  let i = -1;
  const state: Record<string, any> = {
    input,
    separator,
    stack,
    prev: () => string[i - 1],
    next: () => string[i + 1],
  };

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

function denormalize(name: string) {
  if (!name.endsWith(".") && name.length > 1) {
    name = `${name}.`;
  }
  return name.replace(/\.{2,}/g, ".").replace(/@\./, "@");
}

function esc(str: string) {
  return str.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function addDots(content: string, indexes: Array<number>): string {
  const parts = splitString(content, {
    quotes: [`"`],
    separator: " ",
  }).map((s: string) => s.trim()).filter(Boolean);
  for (const index of indexes) {
    if (!parts[index].endsWith(".")) {
      parts[index] += ".";
    }
  }
  return parts.join(" ");
}

function parseTTL(ttl: string | number, def?: number): number {
  if (typeof ttl === "number") {
    return ttl;
  }

  if (def && !ttl) {
    return def;
  }

  if (/s$/i.test(ttl)) {
    ttl = parseInt(ttl);
  } else if (/m$/i.test(ttl)) {
    ttl = parseInt(ttl) * 60;
  } else if (/h$/i.test(ttl)) {
    ttl = parseInt(ttl) * 60 * 60;
  } else if (/d$/i.test(ttl)) {
    ttl = parseInt(ttl) * 60 * 60 * 24;
  } else if (/w$/i.test(ttl)) {
    ttl = parseInt(ttl) * 60 * 60 * 24 * 7;
  } else {
    ttl = parseInt(ttl);
  }

  return ttl;
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

  for (const record of records || []) {
    if (!record) continue;
    let name = normalize(record.name || "");

    if (origin) {
      if (name === origin) {
        name = "@";
      } else if (name.endsWith(origin)) {
        // subdomain, remove origin and trailing dots
        name = normalize(name.replace(new RegExp(`${esc(`${origin}.`)}?$`, "gm"), ""));
      } else {
        // assume it's a subdomain, remove trailing dots
        name = normalize(name);
      }
    } else {
      if (name.includes(".")) {
        // assume it's a fqdn, add trailing dots
        name = denormalize(name);
      } else {
        name = normalize(name);
      }
    }

    let content = record.content;
    if (dots && Object.keys(nameLike).includes(record.type)) {
      const indexes: Array<number> = nameLike[record.type as keyof typeof nameLike];
      content = addDots(content, indexes);
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
  const rawLines = str.split(/\r?\n/).map(l => l.trim());
  const lines = rawLines.filter(l => Boolean(l) && !l.startsWith(";"));
  const newline = crlf ? "\r\n" : "\n";

  // search for header
  const headerLines: Array<string> = [];
  let valid: boolean = false;
  for (const [index, line] of rawLines.entries()) {
    if (line.startsWith(";;")) {
      headerLines.push(line.substring(2).trim());
    } else {
      const prev = rawLines[index - 1];
      if (line === "" && index > 1 && prev.startsWith(";;")) {
        valid = true;
        break;
      }
    }
  }
  if (valid && headerLines.length) {
    data.header = headerLines.join(newline);
  }

  // https://regex101.com/r/aKuGyZ/3
  const reLine = /^([a-z0-9_.\-@*]+)?\s*([0-9]+[smhdw]?)?\s*([a-z]+)?\s+([a-z]+[0-9]*)?\s+(.+)$/i;

  // create records
  data.records = [];
  for (const line of lines) {
    const parsedOrigin = (/\$ORIGIN\s+(\S+)/.exec(line) || [])[1];
    if (parsedOrigin && !data.origin) {
      data.origin = normalize(parsedOrigin);
    }

    const parsedTtl = (/\$TTL\s+(\S+)/.exec(line) || [])[1];
    if (line.startsWith("$TTL ") && !data.ttl) {
      data.ttl = parseTTL(normalize(parsedTtl));
    }

    let [, name, ttl, cls, type, contentAndComment] = reLine.exec(line) || [];
    if (!ttl && name && /[0-9]+/.test(name)) { // no name
      ttl = name;
      name = "";
    }
    if (cls && !type) { // class is optional
      type = cls;
      cls = "";
    }
    if (!cls) {
      cls = defaultClass;
    }
    let [content, comment] = splitContentAndComment(contentAndComment);

    if (!name) {
      name = "";
    }

    if (!cls || !type || !content) {
      continue;
    }

    type = type.toUpperCase();
    content = (content || "").trim();
    if (dots && Object.keys(nameLike).includes(type)) {
      content = addDots(content, nameLike[type as keyof typeof nameLike]);
    }

    data.records.push({
      name: normalize((["", "@"].includes(name) && data.origin) ? data.origin : name),
      ttl: parseTTL(ttl, data.ttl !== undefined ? data.ttl : defaultTTL),
      class: cls.toUpperCase(),
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
  const recordsByType: Record<string, [DnszDnsRecord?]> = {};
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
  if (data.ttl) vars.push(`$TTL ${data.ttl}`);
  if (vars.length) output += `${vars.join(newline)}${newline}${newline}`;

  const origin = normalize(data.origin);
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

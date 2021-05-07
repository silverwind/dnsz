import splitString from "split-string";

// TODO:
//   - both: support multiline value format (e.g. SOA)

const defaults = {
  parse: {
    replaceOrigin: null,
    crlf: false,
    defaultTTL: 60,
    dots: false,
  },
  stringify: {
    crlf: false,
    sections: true,
    dots: false,
  },
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

const re = /^([a-z0-9_.\-@*]+)?[\s]*([0-9]+[smhdw]?)?[\s]*([a-z]+)[\s]+([a-z]+)[\s]+(.+)?$/i;
const reTTL = /^[0-9]+[smhdw]?$/;

function normalize(name) {
  name = (name || "").toLowerCase();
  if (name.endsWith(".") && name.length > 1) {
    name = name.substring(0, name.length - 1);
  }
  return name.replace(/\.{2,}/g, ".").replace(/@\./, "@");
}

function denormalize(name) {
  if (!name.endsWith(".") && name.length > 1) {
    name = `${name}.`;
  }
  return name.replace(/\.{2,}/g, ".").replace(/@\./, "@");
}

function esc(str) {
  return str.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function addDots(content, indexes) {
  const parts = splitString(content, {quotes: [`"`], separator: " "}).map(s => s.trim()).filter(s => !!s);
  for (const index of indexes) {
    if (!parts[index].endsWith(".")) {
      parts[index] += ".";
    }
  }
  return parts.join(" ");
}

function parseTTL(ttl, def) {
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

function format(records, type, {origin, newline, sections, dots}) {
  let str = ``;

  if (sections) {
    str += `;; ${type} Records${newline}`;
  }

  for (const record of records) {
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
      content = addDots(content, nameLike[record.type]);
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

function splitContentAndComment(str) {
  if (!str) return [null, null];
  const splitted = splitString(str, {quotes: [`"`], separator: ";"});

  let parts;
  if (splitted.length > 2) { // more than one semicolon
    parts = [splitted[0], splitted.slice(1).join(";")];
  } else {
    parts = splitted;
  }

  parts = parts.map(part => (part || "").trim()).filter(part => !!part);

  if (parts.length <= 2) {
    return [parts[0] || null, parts[1] || null];
  } else {
    const comment = parts.pop();
    const content = parts.join("; ");
    return [content, comment];
  }
}

export function parse(str, {replaceOrigin = defaults.parse.replaceOrigin, crlf = defaults.parse.crlf, defaultTTL = defaults.parse.defaultTTL, dots = defaults.parse.defaultTTL} = defaults.parse) {
  const data = {};
  const rawLines = str.split(/\r?\n/).map(l => l.trim());
  const lines = rawLines.filter(l => Boolean(l) && !l.startsWith(";"));
  const newline = crlf ? "\r\n" : "\n";

  // search for header
  const headerLines = [];
  let valid;
  for (const [index, line] of Object.entries(rawLines)) {
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

  // create records
  data.records = [];
  for (const line of lines) {
    let _, name, ttl, cls, type, contentAndComment;

    const parsedOrigin = (/\$ORIGIN\s+([^\s]+)/.exec(line) || [])[1];
    if (parsedOrigin && !data.origin) {
      data.origin = normalize(parsedOrigin);
    }

    const parsedTtl = (/\$TTL\s+([^\s]+)/.exec(line) || [])[1];
    if (line.startsWith("$TTL ") && !data.ttl) {
      data.ttl = parseTTL(normalize(parsedTtl));
    }

    const match = re.exec(line) || [];
    if (match.length === 6) {
      [_, name, ttl, cls, type, contentAndComment] = match;
      if (name && !ttl && reTTL.test(name)) {
        ttl = name;
        name = undefined;
      }
    } else if (match.length === 5) {
      if (reTTL.test(match[1])) { // no name
        [_, ttl, cls, type, contentAndComment] = match;
      } else { // no ttl
        [_, name, cls, type, contentAndComment] = match;
      }
    } else if (match.length === 4) { // no name and ttl
      [_, cls, type, contentAndComment] = match;
    }

    let [content, comment] = splitContentAndComment(contentAndComment);

    ttl = parseTTL(ttl, data.ttl !== undefined ? data.ttl : defaultTTL);

    if (!name) {
      name = "";
    }

    if (!cls || !type || !content) {
      continue;
    }

    type = type.toUpperCase();
    content = (content || "").trim();
    if (dots && Object.keys(nameLike).includes(type)) {
      content = addDots(content, nameLike[type]);
    }

    data.records.push({
      name: normalize((["", "@"].includes(name) && data.origin) ? data.origin : name),
      ttl,
      class: cls.toUpperCase(),
      type,
      content,
      comment: (comment || "").trim() || null,
    });
  }

  if (replaceOrigin) {
    data.origin = replaceOrigin;
  }

  return data;
}

export function stringify(data, {crlf = defaults.stringify.crlf, sections = defaults.stringify.sections, dots = defaults.stringify.dots} = defaults.stringify) {
  const recordsByType = {};
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

  const vars = [];
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

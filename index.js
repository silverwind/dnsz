"use strict";

// TODO:
//   - both: optional TTL column
//   - both: support parsing TTLs like 1D, 1W, 3h, 1w
//   - both: support multiline value format

const re = /^([a-z0-9_.-@]+)[\s]+([0-9]+)[\s]+([a-z]+)[\s]+([a-z]+)[\s]+([^;]+);?(.+)?$/i;
const reWithoutTTL = /^([a-z0-9_.-@]+)[\s]+([a-z]+)[\s]+([a-z]+)[\s]+([^;]+);?(.+)?$/i;

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

function isCommentLine(line) {
  return line.startsWith(";; ") && line.length > 3;
}

function format(records, type, origin) {
  let str = `;; ${type} Records\n`;

  for (const record of records) {
    let name;
    if (origin && (record.name || "").includes(origin)) {
      const re = new RegExp(esc(origin + ".") + "?", "gm");
      name = denormalize(record.name.replace(re, "@"));
    } else {
      name = denormalize(record.name);
    }

    let content;
    if (origin && (record.content || "").includes(origin)) {
      const re = new RegExp(esc(origin + ".") + "?", "gm");
      content = record.content.replace(re, "@");
    } else {
      content = record.content;
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

    str += `${fields.join("\t")}\n`;
  }
  return `${str}\n`;
}

module.exports.parse = (str, {replaceOrigin} = {}) => {
  const data = {records: []};
  const rawLines = str.split(/\r?\n/).map(l => l.trim());
  const lines = rawLines.filter(l => Boolean(l) && !l.startsWith(";"));

  // search for header
  const headerLines = [];
  let valid;
  for (const [index, line] of Object.entries(rawLines)) {
    if (isCommentLine(line)) {
      const headerLine = line.substring(3).trim();
      if (headerLine) {
        headerLines.push(headerLine);
      }
    } else {
      const prev = rawLines[index - 1];
      if (line === "" && index > 1 && isCommentLine(prev)) {
        valid = true;
        break;
      }
    }
  }
  if (valid && headerLines.length) {
    data.header = headerLines.join("\n");
  }

  if (replaceOrigin) {
    data.origin = replaceOrigin;
  } else {
    // search for $ORIGIN
    for (const line of lines) {
      if (line.startsWith("$ORIGIN ")) {
        data.origin = normalize(line.replace(/;.+/, "").trim().substring("$ORIGIN ".length));
        break;
      }
    }
  }

  // search for $TTL
  let ttlVariable;
  for (const line of lines) {
    if (line.startsWith("$TTL ")) {
      ttlVariable = normalize(line.replace(/;.+/, "").trim().substring("$TTL ".length));
      data.ttl = ttlVariable;
      break;
    }
  }

  // create records
  for (const line of lines) {
    let _, name, ttl, cls, type, content, comment;
    [_, name, ttl, cls, type, content, comment] = re.exec(line) || [];

    if (!name && ttlVariable) {
      [_, name, cls, type, content, comment] = reWithoutTTL.exec(line) || [];
      ttl = ttlVariable;
    }

    if (!name) continue;

    data.records.push({
      name: normalize((name.includes("@") && data.origin) ? name.replace(/@/g, data.origin) : name),
      ttl: Number(ttl),
      class: cls.toUpperCase(),
      type: type.toUpperCase(),
      content: ((content.includes("@") && data.origin) ? content.replace(/@/g, data.origin) : content).trim(),
      comment: (comment || "").trim() || null,
    });
  }

  return data;
};

module.exports.stringify = data => {
  const recordsByType = {};

  for (const record of data.records) {
    if (!recordsByType[record.type]) recordsByType[record.type] = [];
    recordsByType[record.type].push(record);
  }

  let output = "";

  if (data.header) {
    output += data.header.split(/\r?\n/).filter(l => !!l).map(l => `;; ${l}`).join("\n").trim() + "\n\n";
  }

  const vars = [];
  if (data.origin) vars.push(`$ORIGIN ${denormalize(data.origin)}`);
  if (data.ttl) vars.push(`$TTL ${data.ttl}`);
  if (vars.length) output += vars.join("\n") + "\n\n";

  // output SOA first
  if (recordsByType.SOA) {
    output += format(recordsByType.SOA, "SOA", normalize(data.origin));
    delete recordsByType.SOA;
  }

  for (const type of Object.keys(recordsByType).sort()) {
    output += format(recordsByType[type], type, normalize(data.origin));
  }

  return `${output.trim()}\n`;
};

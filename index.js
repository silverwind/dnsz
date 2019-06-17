"use strict";

// TODO:
//   - support $ORIGIN and @ replacement
//   - support $TTL and optional TTL column
//   - support comments at the end of the line
//   - support parsing TTLs like 1D, 1W, 3h, 1w

const re = /^([a-z0-9_.-]+)[\s]+([0-9]+)[\s]+([a-z]+)[\s]+([a-z]+)[\s]+(.+)$/i;

function normalize(name) {
  name = (name || "").toLowerCase();
  if (name.endsWith(".") && name.length > 1) {
    name = name.substring(0, name.length - 1);
  }
  return name;
}

function denormalize(name) {
  if (!name.endsWith(".") && name.length > 1) {
    name = `${name}.`;
  }
  return name;
}

function format(records, type) {
  let str = `;; ${type} Records\n`;
  for (const record of records) {
    str += `${denormalize(record.name)}\t${record.ttl}\t${record.class}\t${record.type}\t${record.content}\n`;
  }
  return `${str}\n`;
}

module.exports.parse = str => {
  const data = {records: []};
  const lines = str.split(/\r?\n/).map(l => l.trim()).filter(l => Boolean(l) && !l.startsWith(";"));

  for (const line of lines) {
    const [_, name, ttl, cls, type, content] = re.exec(line) || [];
    if (!name) continue;
    data.records.push({
      name: normalize(name).toLowerCase(),
      ttl: Number(ttl),
      class: cls.toUpperCase(),
      type: type.toUpperCase(),
      content: content.trim(),
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

  // output SOA first
  if (recordsByType.SOA) {
    output += format(recordsByType.SOA, "SOA");
    delete recordsByType.SOA;
  }

  for (const type of Object.keys(recordsByType).sort()) {
    output += format(recordsByType[type], type);
  }

  return `${output.trim()}\n`;
};

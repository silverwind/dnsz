"use strict";

const m = require(".");
const assert = require("assert").strict;
const fs = require("fs").promises;
const {join} = require("path");

const exit = err => {
  if (err) console.error(err);
  process.exit(err ? 1 : 0);
};

const main = async () => {
  {
    const str = await fs.readFile(join(__dirname, "tests", "simple.txt"), "utf8");
    const parsed = m.parse(str);
    const roundtripped = m.stringify(parsed);
    assert.deepEqual(str, roundtripped);
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "origin.txt"), "utf8");
    const parsed = m.parse(str);
    const roundtripped = m.stringify(parsed);
    assert.deepEqual(str, roundtripped);
    assert(parsed.records.length === 5);
    for (const record of parsed.records) {
      assert(record.name);
      assert(record.ttl);
      assert(record.class);
      assert(record.type);
      assert(record.content);
      assert(typeof record.comment === "string" || record.comment === null);
      assert(!record.name.includes("@"));
      assert(!record.content.includes("@"));
    }
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "ttl.txt"), "utf8");
    const parsed = m.parse(str);
    assert(parsed.records.length === 5);
    for (const record of parsed.records) {
      assert(record.name);
      assert(record.ttl);
      assert(record.class);
      assert(record.type);
      assert(record.content);
      assert(typeof record.comment === "string" || record.comment === null);
      assert(!record.name.includes("@"));
      assert(!record.content.includes("@"));
    }
  }
};

main().then(exit).catch(exit);

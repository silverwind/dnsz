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
    assert.deepEqual(roundtripped, str);
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "origin.txt"), "utf8");
    const parsed = m.parse(str);
    const roundtripped = m.stringify(parsed);
    assert.deepEqual(roundtripped, str);
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
    parsed.origin = "testzone.com";
    const withOrigin = m.stringify(parsed);
    assert(/^\$ORIGIN\s.+$/m.test(withOrigin));
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
    parsed.ttl = 60;
    const withTTL = m.stringify(parsed);
    assert(/^\$TTL\s[0-9]+$/m.test(withTTL));
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "header.txt"), "utf8");
    const parsed = m.parse(str);
    const roundtripped = m.stringify(parsed);
    assert.deepEqual(roundtripped, str);
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "origin.txt"), "utf8");
    const replaceOrigin = "another.com";
    const parsed = m.parse(str, {replaceOrigin});
    assert.deepEqual(parsed.origin, replaceOrigin);
    for (const record of parsed.records) {
      assert(record.name.includes(replaceOrigin));
    }
  }
};

main().then(exit).catch(exit);

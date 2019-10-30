"use strict";

const dnsz = require(".");
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
    const parsed = dnsz.parse(str);
    const roundtripped = dnsz.stringify(parsed);
    assert.deepEqual(roundtripped, str);
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "origin.txt"), "utf8");
    const parsed = dnsz.parse(str);
    const roundtripped = dnsz.stringify(parsed);
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
    const withOrigin = dnsz.stringify(parsed);
    assert(/^\$ORIGIN\s.+$/m.test(withOrigin));
  }
  {
    const data = {
      "origin": "originzone.com",
      "records": [
        {
          "name": "originzone.com.",
          "ttl": 3600,
          "class": "IN",
          "type": "SOA",
          "content": "originzone.com. root.originzone.com. 2031242781 7200 3600 86400 3600",
          "comment": null
        },
        {
          "name": "a.originzone.com.",
          "ttl": 60,
          "class": "IN",
          "type": "A",
          "content": "1.2.3.4",
          "comment": "a comment"
        },
      ],
    };
    const result = dnsz.stringify(data, {sections: true, dots: true});
    assert(/^@/m.test(result));
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "ttl.txt"), "utf8");
    const parsed = dnsz.parse(str);
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
    const withTTL = dnsz.stringify(parsed);
    assert(/^\$TTL\s[0-9]+$/m.test(withTTL));
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "header.txt"), "utf8");
    const parsed = dnsz.parse(str);
    const roundtripped = dnsz.stringify(parsed);
    assert.deepEqual(roundtripped, str);
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "origin.txt"), "utf8");
    const replaceOrigin = "another.com";
    const parsed = dnsz.parse(str, {replaceOrigin});
    assert.deepEqual(parsed.origin, replaceOrigin);
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "nosections.txt"), "utf8");
    const parsed = dnsz.parse(str);
    const roundtripped = dnsz.stringify(parsed, {sections: false});
    assert.deepEqual(roundtripped, str);
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "noname.txt"), "utf8");
    const parsed = dnsz.parse(str);
    const roundtripped = dnsz.stringify(parsed);
    assert.deepEqual(roundtripped, str);
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "nottl.txt"), "utf8");
    const parsed = dnsz.parse(str);
    for (const record of parsed.records) {
      assert.equal(typeof record.name, "string");
      assert.equal(typeof record.ttl, "number");
      assert(record.class);
      assert(record.type);
      assert(record.content);
    }
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "ttlunits.txt"), "utf8");
    const parsed = dnsz.parse(str);
    for (const record of parsed.records) {
      if (record.type === "SOA") {
        assert.equal(record.ttl, 3600);
      }
      assert.equal(typeof record.name, "string");
      assert.equal(typeof record.ttl, "number");
      assert(!Number.isNaN(record.ttl));
      assert(record.class);
      assert(record.type);
      assert(record.content);
    }
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "semicontent.txt"), "utf8");
    const parsed = dnsz.parse(str);
    const roundtripped = dnsz.stringify(parsed);
    assert.deepEqual(roundtripped, str);
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "dash.txt"), "utf8");
    const parsed = dnsz.parse(str);
    const roundtripped = dnsz.stringify(parsed);
    assert.deepEqual(roundtripped, str);
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "wildcard.txt"), "utf8");
    const parsed = dnsz.parse(str);
    const roundtripped = dnsz.stringify(parsed);
    assert.deepEqual(roundtripped, str);
  }
  {
    const dotsstr = await fs.readFile(join(__dirname, "tests", "dots.txt"), "utf8");
    const nodotsstr = await fs.readFile(join(__dirname, "tests", "nodots.txt"), "utf8");
    assert.deepEqual(dnsz.stringify(dnsz.parse(dotsstr, {dots: false}), {dots: false}), dotsstr);
    assert.deepEqual(dnsz.stringify(dnsz.parse(dotsstr, {dots: false}), {dots: true}), dotsstr);
    assert.deepEqual(dnsz.stringify(dnsz.parse(dotsstr, {dots: true}), {dots: true}), dotsstr);
    assert.deepEqual(dnsz.stringify(dnsz.parse(nodotsstr, {dots: false}), {dots: false}), nodotsstr);
    assert.deepEqual(dnsz.stringify(dnsz.parse(nodotsstr, {dots: false}), {dots: true}), dotsstr);
    assert.deepEqual(dnsz.stringify(dnsz.parse(nodotsstr, {dots: true}), {dots: true}), dotsstr);
  }
  {
    const str = await fs.readFile(join(__dirname, "tests", "comments.txt"), "utf8");
    const parsed = dnsz.parse(str);
    const roundtripped = dnsz.stringify(parsed);
    assert.deepEqual(roundtripped, str);
  }
};

main().then(exit).catch(exit);

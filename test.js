"use strict";

const {parse, stringify} = require(".");
const {readFile} = require("fs").promises;
const {resolve} = require("path");

test("roundtrip", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/simple.txt"), "utf8");
  const parsed = parse(str);
  const roundtripped = stringify(parsed);
  expect(roundtripped).toEqual(str);
});

test("basic", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/origin.txt"), "utf8");
  const parsed = parse(str);
  const roundtripped = stringify(parsed);
  expect(roundtripped).toEqual(str);
  expect(parsed.records.length).toEqual(5);

  for (const record of parsed.records) {
    expect(record.name).toBeTruthy();
    expect(record.ttl).toBeTruthy();
    expect(record.class).toBeTruthy();
    expect(record.type).toBeTruthy();
    expect(record.content).toBeTruthy();
    expect(typeof record.comment === "string" || record.comment === null).toBeTruthy();
    expect(!record.name.includes("@")).toBeTruthy();
    expect(!record.content.includes("@")).toBeTruthy();
  }

  parsed.origin = "testzone.com";
  const withOrigin = stringify(parsed);
  expect(/^\$ORIGIN\s.+$/m.test(withOrigin)).toBe(true);
});

test("origin", async () => {
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
  const result = stringify(data, {sections: true, dots: true});
  expect(/^@/m.test(result)).toBe(true);
});

test("ttl", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/ttl.txt"), "utf8");
  const parsed = parse(str);
  expect(parsed.records.length).toEqual(5);
  for (const record of parsed.records) {
    expect(record.name).toBeTruthy();
    expect(record.ttl).toBeTruthy();
    expect(record.class).toBeTruthy();
    expect(record.type).toBeTruthy();
    expect(record.content).toBeTruthy();
    expect(typeof record.comment === "string" || record.comment === null).toBeTruthy();
    expect(!record.name.includes("@")).toBeTruthy();
    expect(!record.content.includes("@")).toBeTruthy();
  }
  parsed.ttl = 60;
  const withTTL = stringify(parsed);
  expect(/^\$TTL\s[0-9]+$/m.test(withTTL)).toBe(true);
});

test("header", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/header.txt"), "utf8");
  const parsed = parse(str);
  const roundtripped = stringify(parsed);
  expect(roundtripped).toEqual(str);
});

test("replaceOrigin", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/origin.txt"), "utf8");
  const replaceOrigin = "another.com";
  const parsed = parse(str, {replaceOrigin});
  expect(parsed.origin).toEqual(replaceOrigin);
});

test("nosections", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/nosections.txt"), "utf8");
  const parsed = parse(str);
  const roundtripped = stringify(parsed, {sections: false});
  expect(roundtripped).toEqual(str);
});

test("noname", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/noname.txt"), "utf8");
  const parsed = parse(str);
  const roundtripped = stringify(parsed);
  expect(roundtripped).toEqual(str);
});

test("nottl", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/nottl.txt"), "utf8");
  const parsed = parse(str);
  for (const record of parsed.records) {
    expect(typeof record.name).toEqual("string");
    expect(typeof record.ttl).toEqual("number");
    expect(record.class).toBeTruthy();
    expect(record.type).toBeTruthy();
    expect(record.content).toBeTruthy();
  }
});

test("ttlunits", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/ttlunits.txt"), "utf8");
  const parsed = parse(str);
  for (const record of parsed.records) {
    if (record.type === "SOA") {
      expect(record.ttl).toEqual(3600);
    }
    expect(typeof record.name).toEqual("string");
    expect(typeof record.ttl).toEqual("number");
    expect(!Number.isNaN(record.ttl)).toBeTruthy();
    expect(record.class).toBeTruthy();
    expect(record.type).toBeTruthy();
    expect(record.content).toBeTruthy();
  }
});

test("semicontent", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/semicontent.txt"), "utf8");
  const parsed = parse(str);
  const roundtripped = stringify(parsed);
  expect(roundtripped).toEqual(str);
});

test("dash", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/dash.txt"), "utf8");
  const parsed = parse(str);
  const roundtripped = stringify(parsed);
  expect(roundtripped).toEqual(str);
});

test("wildcard", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/wildcard.txt"), "utf8");
  const parsed = parse(str);
  const roundtripped = stringify(parsed);
  expect(roundtripped).toEqual(str);
});

test("dots", async () => {
  const dotsstr = await readFile(resolve(__dirname, "fixtures/dots.txt"), "utf8");
  const nodotsstr = await readFile(resolve(__dirname, "fixtures/nodots.txt"), "utf8");
  expect(stringify(parse(dotsstr, {dots: false}), {dots: false})).toEqual(dotsstr);
  expect(stringify(parse(dotsstr, {dots: false}), {dots: true})).toEqual(dotsstr);
  expect(stringify(parse(dotsstr, {dots: true}), {dots: true})).toEqual(dotsstr);
  expect(stringify(parse(nodotsstr, {dots: false}), {dots: false})).toEqual(nodotsstr);
  expect(stringify(parse(nodotsstr, {dots: false}), {dots: true})).toEqual(dotsstr);
  expect(stringify(parse(nodotsstr, {dots: true}), {dots: true})).toEqual(dotsstr);
});

test("comments", async () => {
  const str = await readFile(resolve(__dirname, "fixtures/comments.txt"), "utf8");
  const parsed = parse(str);
  const roundtripped = stringify(parsed);
  expect(roundtripped).toEqual(str);
});

/* eslint-disable @stylistic/js/no-tabs */
import {parseZone, stringifyZone} from "./index.ts";
import {readFileSync} from "node:fs";

test("roundtrip", () => {
  const str = readFileSync(new URL("fixtures/simple.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("basic", () => {
  const str = readFileSync(new URL("fixtures/origin.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
  expect(parseZoned.records.length).toEqual(5);

  for (const record of parseZoned.records) {
    expect(record.name).toBeTruthy();
    expect(record.ttl).toBeTruthy();
    expect(record.class).toBeTruthy();
    expect(record.type).toBeTruthy();
    expect(record.content).toBeTruthy();
    expect(typeof record.comment === "string" || record.comment === null).toBeTruthy();
    expect(!record.name.includes("@")).toBeTruthy();
    expect(!record.content.includes("@")).toBeTruthy();
  }

  parseZoned.origin = "testzone.com";
  const withOrigin = stringifyZone(parseZoned);
  expect(/^\$ORIGIN\s.+$/m.test(withOrigin)).toBe(true);
});

test("origin", () => {
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
  const result = stringifyZone(data, {sections: true, dots: true});
  expect(/^@/m.test(result)).toBe(true);
});

test("ttl", () => {
  const str = readFileSync(new URL("fixtures/ttl.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  expect(parseZoned.records.length).toEqual(5);
  for (const record of parseZoned.records) {
    expect(record.name).toBeTruthy();
    expect(record.ttl).toBeTruthy();
    expect(record.class).toBeTruthy();
    expect(record.type).toBeTruthy();
    expect(record.content).toBeTruthy();
    expect(typeof record.comment === "string" || record.comment === null).toBeTruthy();
    expect(!record.name.includes("@")).toBeTruthy();
    expect(!record.content.includes("@")).toBeTruthy();
  }
  parseZoned.ttl = 60;
  const withTTL = stringifyZone(parseZoned);
  expect(/^\$TTL\s[0-9]+$/m.test(withTTL)).toBe(true);
});

test("header", () => {
  const str = readFileSync(new URL("fixtures/header.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("replaceOrigin", () => {
  const str = readFileSync(new URL("fixtures/origin.txt", import.meta.url), "utf8");
  const replaceOrigin = "another.com";
  const parseZoned = parseZone(str, {replaceOrigin});
  expect(parseZoned.origin).toEqual(replaceOrigin);
});

test("nosections", () => {
  const str = readFileSync(new URL("fixtures/nosections.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned, {sections: false});
  expect(roundtripped).toEqual(str);
});

test("noname", () => {
  const str = readFileSync(new URL("fixtures/noname.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("nottl", () => {
  const str = readFileSync(new URL("fixtures/nottl.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  for (const record of parseZoned.records) {
    expect(typeof record.name).toEqual("string");
    expect(typeof record.ttl).toEqual("number");
    expect(record.class).toBeTruthy();
    expect(record.type).toBeTruthy();
    expect(record.content).toBeTruthy();
  }
});

test("ttlunits", () => {
  const str = readFileSync(new URL("fixtures/ttlunits.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  for (const record of parseZoned.records) {
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

test("semicontent", () => {
  const str = readFileSync(new URL("fixtures/semicontent.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("dash", () => {
  const str = readFileSync(new URL("fixtures/dash.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("wildcard", () => {
  const str = readFileSync(new URL("fixtures/wildcard.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("dots", () => {
  const dotsstr = readFileSync(new URL("fixtures/dots.txt", import.meta.url), "utf8");
  const nodotsstr = readFileSync(new URL("fixtures/nodots.txt", import.meta.url), "utf8");
  expect(stringifyZone(parseZone(dotsstr, {dots: false}), {dots: false})).toEqual(dotsstr);
  expect(stringifyZone(parseZone(dotsstr, {dots: false}), {dots: true})).toEqual(dotsstr);
  expect(stringifyZone(parseZone(dotsstr, {dots: true}), {dots: true})).toEqual(dotsstr);
  expect(stringifyZone(parseZone(nodotsstr, {dots: false}), {dots: false})).toEqual(nodotsstr);
  expect(stringifyZone(parseZone(nodotsstr, {dots: false}), {dots: true})).toEqual(dotsstr);
  expect(stringifyZone(parseZone(nodotsstr, {dots: true}), {dots: true})).toEqual(dotsstr);
});

test("comments", () => {
  const str = readFileSync(new URL("fixtures/comments.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("soa parens", () => {
  const str = readFileSync(new URL("fixtures/soaparens.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("type65534", () => {
  const str = readFileSync(new URL("fixtures/type65534.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("inoptional", () => {
  const str = readFileSync(new URL("fixtures/inoptional.txt", import.meta.url), "utf8");
  const parseZoned = parseZone(str);
  expect(parseZoned).toMatchInlineSnapshot(`
    {
      "records": [
        {
          "class": "IN",
          "comment": null,
          "content": "1.2.3.4",
          "name": "example.com",
          "ttl": 300,
          "type": "A",
        },
        {
          "class": "IN",
          "comment": null,
          "content": "10 mail.example.com.",
          "name": "example.com",
          "ttl": 600,
          "type": "MX",
        },
        {
          "class": "IN",
          "comment": null,
          "content": "foo.com.",
          "name": "example.com",
          "ttl": 172800,
          "type": "NS",
        },
        {
          "class": "IN",
          "comment": null,
          "content": "bar.com.",
          "name": "example.com",
          "ttl": 172800,
          "type": "NS",
        },
        {
          "class": "IN",
          "comment": null,
          "content": ""test"",
          "name": "example.com",
          "ttl": 300,
          "type": "TXT",
        },
        {
          "class": "IN",
          "comment": null,
          "content": "foo.com.",
          "name": "_dmarc.example.com",
          "ttl": 300,
          "type": "CNAME",
        },
        {
          "class": "IN",
          "comment": null,
          "content": "0 0 5060 sip.foo.com.",
          "name": "_sip._tcp.example.com",
          "ttl": 600,
          "type": "SRV",
        },
        {
          "class": "IN",
          "comment": null,
          "content": "0 0 5061 sips.foo.com.",
          "name": "_sips._tcp.example.com",
          "ttl": 600,
          "type": "SRV",
        },
      ],
    }
  `);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toMatchInlineSnapshot(`
    ";; A Records
    example.com.	300	IN	A	1.2.3.4

    ;; CNAME Records
    _dmarc.example.com.	300	IN	CNAME	foo.com.

    ;; MX Records
    example.com.	600	IN	MX	10 mail.example.com.

    ;; NS Records
    example.com.	172800	IN	NS	foo.com.
    example.com.	172800	IN	NS	bar.com.

    ;; SRV Records
    _sip._tcp.example.com.	600	IN	SRV	0 0 5060 sip.foo.com.
    _sips._tcp.example.com.	600	IN	SRV	0 0 5061 sips.foo.com.

    ;; TXT Records
    example.com.	300	IN	TXT	"test"
    "
  `);
});

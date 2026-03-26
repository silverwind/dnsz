import {parseZone, stringifyZone} from "./index.ts";
import dedent from "dedent";

test("roundtrip", () => {
  const str = `${dedent`
    ;; SOA Records
    simplezone.com.	3600	IN	SOA	simplezone.com. root.simplezone.com. 2031242781 7200 3600 86400 3600

    ;; A Records
    simplezone.com.	60	IN	A	1.2.3.4	; a comment
    mx.simplezone.com.	60	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    simplezone.com.	120	IN	AAAA	2001:db8::1
    mx.simplezone.com.	120	IN	AAAA	2001:db8::1

    ;; CAA Records
    simplezone.com.	120	IN	CAA	0 issue "simplezone.com"

    ;; CNAME Records
    cname1.simplezone.com.	120	IN	CNAME	simplezone.com.
    cname2.simplezone.com.	120	IN	CNAME	simplezone.com.

    ;; MX Records
    simplezone.com.	120	IN	MX	10 mx.simplezone.com.
    simplezone.com.	120	IN	MX	10 mx3.simplezone.com.
    simplezone.com.	120	IN	MX	10 mx2.simplezone.com.

    ;; TXT Records
    simplezone.com.	120	IN	TXT	"first record"
    simplezone.com.	120	IN	TXT	"second record"
    simplezone.com.	120	IN	TXT	"third record"

  `}\n`;
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("basic", () => {
  const str = `${dedent`
    $ORIGIN originzone.com.

    ;; SOA Records
    @	3600	IN	SOA	originzone.com. root.originzone.com. 2031242781 7200 3600 86400 3600

    ;; A Records
    @	60	IN	A	1.2.3.4	; a comment
    mx	60	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    @	120	IN	AAAA	2001:db8::1
    mx	120	IN	AAAA	2001:db8::1

  `}\n`;
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
  const str = `${dedent`
    $ORIGIN ttlzone.com
    $TTL 60

    ;; SOA Records
    @	IN	SOA	ttlzone.com root.ttlzone.com 2031242781 7200 3600 86400 3600

    ;; A Records
    @	IN	A	1.2.3.4	; a comment
    mx	60	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    @	IN	AAAA	2001:db8::1
    mx	120	IN	AAAA	2001:db8::1

  `}\n`;
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
  const str = `${dedent`
    ;; This is a
    ;;
    ;; header message

    $ORIGIN headerzone.com.
    $TTL 60

    ;; SOA Records
    @	60	IN	SOA	headerzone.com root.headerzone.com 2031242781 7200 3600 86400 3600

    ;; A Records
    @	60	IN	A	1.2.3.4	; a comment
    mx	60	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    @	60	IN	AAAA	2001:db8::1
    mx	120	IN	AAAA	2001:db8::1

  `}\n`;
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("replaceOrigin", () => {
  const str = dedent`
    $ORIGIN originzone.com.

    ;; SOA Records
    @	3600	IN	SOA	originzone.com. root.originzone.com. 2031242781 7200 3600 86400 3600

    ;; A Records
    @	60	IN	A	1.2.3.4	; a comment
    mx	60	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    @	120	IN	AAAA	2001:db8::1
    mx	120	IN	AAAA	2001:db8::1

  `;
  const replaceOrigin = "another.com";
  const parseZoned = parseZone(str, {replaceOrigin});
  expect(parseZoned.origin).toEqual(replaceOrigin);
});

test("nosections", () => {
  const str = `${dedent`
    ;; This is a
    ;;
    ;; header message

    nosectionszone.com.	3600	IN	SOA	nosectionszone.com. root.nosectionszone.com. 2031242781 7200 3600 86400 3600
    nosectionszone.com.	120	IN	AAAA	2001:db8::1
    nosectionszone.com.	120	IN	CAA	0 issue "nosectionszone.com"
    nosectionszone.com.	120	IN	MX	10 mx.nosectionszone.com.
    nosectionszone.com.	120	IN	MX	10 mx2.nosectionszone.com.
    nosectionszone.com.	120	IN	MX	10 mx3.nosectionszone.com.
    nosectionszone.com.	120	IN	TXT	"first record"
    nosectionszone.com.	120	IN	TXT	"second record"
    nosectionszone.com.	120	IN	TXT	"third record"
    nosectionszone.com.	60	IN	A	1.2.3.4	; a comment
    cname1.nosectionszone.com.	120	IN	CNAME	nosectionszone.com.
    cname2.nosectionszone.com.	120	IN	CNAME	nosectionszone.com.
    mx.nosectionszone.com.	120	IN	AAAA	2001:db8::1
    mx.nosectionszone.com.	60	IN	A	1.2.3.4	; another comment

  `}\n`;
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned, {sections: false});
  expect(roundtripped).toEqual(str);
});

test("noname", () => {
  const str = `${dedent`
    ;; SOA Records
    nonamezone.com.	3600	IN	SOA	nonamezone.com. root.nonamezone.com. 2031242781 7200 3600 86400 3600

    ;; A Records
    	60	IN	A	1.2.3.4	; a comment
    	60	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    	120	IN	AAAA	2001:db8::1
    	120	IN	AAAA	2001:db8::1

  `}\n`;
  const parseZoned = parseZone(str);
  // RFC 1035 §5.1: blank owner inherits from previous record
  for (const record of parseZoned.records) {
    expect(record.name).toEqual("nonamezone.com");
  }
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(`${dedent`
    ;; SOA Records
    nonamezone.com.	3600	IN	SOA	nonamezone.com. root.nonamezone.com. 2031242781 7200 3600 86400 3600

    ;; A Records
    nonamezone.com.	60	IN	A	1.2.3.4	; a comment
    nonamezone.com.	60	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    nonamezone.com.	120	IN	AAAA	2001:db8::1
    nonamezone.com.	120	IN	AAAA	2001:db8::1

  `}\n`);
});

test("nottl", () => {
  const str = `${dedent`
    ;; SOA Records
    @	IN	SOA	nottlzone. root.notttlzone.com. 2031242781 7200 3600 86400 3600

    ;; A Records
    60	IN	A	1.2.3.4	; no name
    mx	IN	A	1.2.3.4	; no ttl
        IN	A	1.2.3.4	; no name and ttl

  `}\n`;
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
  const str = `${dedent`
    $ORIGIN ttlzone.com
    $TTL 1h

    ;; SOA Records
    @	IN	SOA	ttlzone.com root.ttlzone.com 2031242781 7200 3600 86400 3600

    ;; A Records
    @	2h	IN	A	1.2.3.4	; a comment
    mx	5M	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    @	1W	IN	AAAA	2001:db8::1
    mx	2s	IN	AAAA	2001:db8::1

  `}\n`;
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
  const str = `${dedent`
    ;; SOA Records
    semicontent.com.	3600	IN	SOA	semicontent.com. root.semicontent.com. 2031242781 7200 3600 86400 3600	; soa record

    ;; TXT Records
    @	3600	IN	TXT	"v=spf1 -all 2001::db8"	; txt record
    _dmarc	3600	IN	TXT	"v=DMARC1; p=reject; sp=reject; rua=mailto:admin@semicontent.com ruf=admin@semicontent.com"	; txt record

  `}\n`;
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("dash", () => {
  const str = `${dedent`
    ;; SOA Records
    dash-zone.net.	3600	IN	SOA	dash-zone.net. root.dash-zone.net. 2031242781 7200 3600 86400 3600

    ;; A Records
    dash-zone.net.	60	IN	A	1.2.3.4	; a comment
    mx.dash-zone.net.	60	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    dash-zone.net.	120	IN	AAAA	2001:db8::1
    mx.dash-zone.net.	120	IN	AAAA	2001:db8::1

    ;; CAA Records
    dash-zone.net.	120	IN	CAA	0 issue "dash-zone.net"

    ;; CNAME Records
    cname1.dash-zone.net.	120	IN	CNAME	dash-zone.net.
    cname2.dash-zone.net.	120	IN	CNAME	dash-zone.net.

    ;; MX Records
    dash-zone.net.	120	IN	MX	10 mx.dash-zone.net.
    dash-zone.net.	120	IN	MX	10 mx3.dash-zone.net.
    dash-zone.net.	120	IN	MX	10 mx2.dash-zone.net.

    ;; TXT Records
    dash-zone.net.	120	IN	TXT	"first record"
    dash-zone.net.	120	IN	TXT	"second record"
    dash-zone.net.	120	IN	TXT	"third record"

  `}\n`;
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("wildcard", () => {
  const str = `${dedent`
    ;; SOA Records
    wildcard-zone.net.	3600	IN	SOA	wildcard-zone.net. root.wildcard-zone.net. 2031242781 7200 3600 86400 3600

    ;; A Records
    *.wildcard-zone.net.	60	IN	A	1.2.3.4	; a comment
    mx.wildcard-zone.net.	60	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    *.wildcard-zone.net.	120	IN	AAAA	2001:db8::1
    mx.wildcard-zone.net.	120	IN	AAAA	2001:db8::1

    ;; CAA Records
    *.wildcard-zone.net.	120	IN	CAA	0 issue "wildcard-zone.net"

    ;; CNAME Records
    cname1.wildcard-zone.net.	120	IN	CNAME	wildcard-zone.net.
    cname2.wildcard-zone.net.	120	IN	CNAME	wildcard-zone.net.

    ;; MX Records
    wildcard-zone.net.	120	IN	MX	10 mx.wildcard-zone.net.
    wildcard-zone.net.	120	IN	MX	10 mx3.wildcard-zone.net.
    wildcard-zone.net.	120	IN	MX	10 mx2.wildcard-zone.net.

    ;; TXT Records
    wildcard-zone.net.	120	IN	TXT	"first record"
    wildcard-zone.net.	120	IN	TXT	"second record"
    wildcard-zone.net.	120	IN	TXT	"third record"

  `}\n`;
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("dots", () => {
  const dotsstr = `${dedent`
    ;; SOA Records
    dot-zone.net.	3600	IN	SOA	dot-zone.net. root.dot-zone.net. 2031242781 7200 3600 86400 3600

    ;; A Records
    a.dot-zone.net.	120	IN	A	1.2.3.4

    ;; CNAME Records
    cname1.dot-zone.net.	120	IN	CNAME	dot-zone.net.
    cname2.dot-zone.net.	120	IN	CNAME	dot-zone.net.

  `}\n`;
  const nodotsstr = `${dedent`
    ;; SOA Records
    dot-zone.net.	3600	IN	SOA	dot-zone.net root.dot-zone.net 2031242781 7200 3600 86400 3600

    ;; A Records
    a.dot-zone.net.	120	IN	A	1.2.3.4

    ;; CNAME Records
    cname1.dot-zone.net.	120	IN	CNAME	dot-zone.net
    cname2.dot-zone.net.	120	IN	CNAME	dot-zone.net

  `}\n`;
  expect(stringifyZone(parseZone(dotsstr, {dots: false}), {dots: false})).toEqual(dotsstr);
  expect(stringifyZone(parseZone(dotsstr, {dots: false}), {dots: true})).toEqual(dotsstr);
  expect(stringifyZone(parseZone(dotsstr, {dots: true}), {dots: true})).toEqual(dotsstr);
  expect(stringifyZone(parseZone(nodotsstr, {dots: false}), {dots: false})).toEqual(nodotsstr);
  expect(stringifyZone(parseZone(nodotsstr, {dots: false}), {dots: true})).toEqual(dotsstr);
  expect(stringifyZone(parseZone(nodotsstr, {dots: true}), {dots: true})).toEqual(dotsstr);
});

test("comments", () => {
  const str = `${dedent`
    ;; SOA Records
    commentzone.com.	3600	IN	SOA	commentzone.com. root.commentzone.com. 2031242781 7200 3600 86400 3600

    ;; A Records
    commentzone.com.	60	IN	A	1.2.3.4	; a comment ; with semicolon
    mx.commentzone.com.	60	IN	A	1.2.3.4	; another comment
    mx.commentzone.com.	60	IN	A	1.2.3.4	; another comment; more "stuff"; with "semi; colons"

  `}\n`;
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("soa parens", () => {
  const str = `${dedent`
    $ORIGIN originzone.com.

    ;; SOA Records
    @	3600	IN	SOA	originzone.com. root.originzone.com. (2031242781 7200 3600 86400 3600)

    ;; A Records
    @	60	IN	A	1.2.3.4	; a comment
    mx	60	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    @	120	IN	AAAA	2001:db8::1
    mx	120	IN	AAAA	2001:db8::1

  `}\n`;
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("multiline soa", () => {
  // Test parsing multi-line SOA record from fixture file
  const multilineSOA = `${dedent`
    $ORIGIN localhost.
    @  86400  IN  SOA   @  root (
                      1999010100 ; serial
                           10800 ; refresh (3 hours)
                             900 ; retry (15 minutes)
                          604800 ; expire (1 week)
                           86400 ; minimum (1 day)
                        )
    @  60  IN  A  127.0.0.1

  `}\n`;
  const parseZoned = parseZone(multilineSOA);

  // Verify the SOA record was parsed correctly
  expect(parseZoned.records.length).toEqual(2);
  expect(parseZoned.records[0].type).toEqual("SOA");
  expect(parseZoned.records[0].content).toEqual("@ root 1999010100 10800 900 604800 86400");
  expect(parseZoned.records[0].ttl).toEqual(86400);
  expect(parseZoned.records[1].type).toEqual("A");

  // The stringifier should output single-line format
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(`${dedent`
    $ORIGIN localhost.

    ;; SOA Records
    @	86400	IN	SOA	@ root 1999010100 10800 900 604800 86400

    ;; A Records
    @	60	IN	A	127.0.0.1

  `}\n`);
});

test("multiline soa with comment on first line", () => {
  // Test with comment after opening parenthesis
  const multilineSOA = dedent`
    $ORIGIN example.com.
    @  3600  IN  SOA   ns1.example.com. admin.example.com. ( ; SOA record
                      2024010100 ; serial
                           10800 ; refresh
                             900 ; retry
                          604800 ; expire
                           86400 ; minimum
                         )

  `;

  const parseZoned = parseZone(multilineSOA);

  // Verify the SOA record was parsed correctly
  expect(parseZoned.records.length).toEqual(1);
  expect(parseZoned.records[0].type).toEqual("SOA");
  expect(parseZoned.records[0].content).toEqual("ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400");
});

test("multiline soa with parentheses in comments", () => {
  // Test that parentheses in comments don't interfere
  const multilineSOA = dedent`
    $ORIGIN example.com.
    @  3600  IN  SOA   ns1.example.com. admin.example.com. (
                      2024010100 ; serial (version)
                           10800 ; refresh (3 hours)
                             900 ; retry (15 minutes)
                          604800 ; expire (1 week)
                           86400 ; minimum (1 day)
                         )

  `;

  const parseZoned = parseZone(multilineSOA);

  // Verify the SOA record was parsed correctly
  expect(parseZoned.records.length).toEqual(1);
  expect(parseZoned.records[0].type).toEqual("SOA");
  expect(parseZoned.records[0].content).toEqual("ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400");
});

test("mixed single-line and multiline records", () => {
  // Test a zone file with both formats
  const mixed = dedent`
    $ORIGIN example.com.
    @  3600  IN  SOA   ns1.example.com. admin.example.com. (
                      2024010100
                           10800
                             900
                          604800
                           86400
                         )
    @  60   IN  A     192.0.2.1
    @  60   IN  AAAA  2001:db8::1

  `;

  const parseZoned = parseZone(mixed);

  // Verify all records were parsed
  expect(parseZoned.records.length).toEqual(3);
  expect(parseZoned.records[0].type).toEqual("SOA");
  expect(parseZoned.records[0].content).toEqual("ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400");
  expect(parseZoned.records[1].type).toEqual("A");
  expect(parseZoned.records[1].content).toEqual("192.0.2.1");
  expect(parseZoned.records[2].type).toEqual("AAAA");
  expect(parseZoned.records[2].content).toEqual("2001:db8::1");
});

test("type65534", () => {
  const str = `${dedent`
    ;; A Records
    sub.typezone.com.	3600	IN	A	1.2.3.4

    ;; TYPE65534 Records
    typezone.com.	0	IN	TYPE65534	\# 5 0472C10000
    typezone.com.	0	IN	TYPE65534	\# 5 048A880001
    typezone.com.	0	IN	TYPE65534	\# 5 0493E10001

  `}\n`;
  const parseZoned = parseZone(str);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("inoptional", () => {
  const str = `${dedent`
    example.com.	300	A	1.2.3.4
    example.com.	600	MX	10 mail.example.com.
    example.com.	172800	NS	foo.com.
    example.com.	172800	NS	bar.com.
    example.com.	300	TXT	"test"
    _dmarc.example.com.	300	CNAME	foo.com.
    _sip._tcp.example.com.	600	SRV	0 0 5060 sip.foo.com.
    _sips._tcp.example.com.	600	SRV	0 0 5061 sips.foo.com.

  `}\n`;
  const parseZoned = parseZone(str);
  expect(parseZoned).toEqual({
    records: [
      {class: "IN", comment: null, content: "1.2.3.4", name: "example.com", ttl: 300, type: "A"},
      {class: "IN", comment: null, content: "10 mail.example.com.", name: "example.com", ttl: 600, type: "MX"},
      {class: "IN", comment: null, content: "foo.com.", name: "example.com", ttl: 172800, type: "NS"},
      {class: "IN", comment: null, content: "bar.com.", name: "example.com", ttl: 172800, type: "NS"},
      {class: "IN", comment: null, content: `"test"`, name: "example.com", ttl: 300, type: "TXT"},
      {class: "IN", comment: null, content: "foo.com.", name: "_dmarc.example.com", ttl: 300, type: "CNAME"},
      {class: "IN", comment: null, content: "0 0 5060 sip.foo.com.", name: "_sip._tcp.example.com", ttl: 600, type: "SRV"},
      {class: "IN", comment: null, content: "0 0 5061 sips.foo.com.", name: "_sips._tcp.example.com", ttl: 600, type: "SRV"},
    ],
  });
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(`${dedent`
    ;; A Records
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

  `}\n`);
});

test("name inheritance", () => {
  const str = dedent`
    $ORIGIN example.com.
    @  3600  IN  SOA  ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400
    @  60    IN  A    192.0.2.1
             60  IN  A    192.0.2.2
             60  IN  AAAA 2001:db8::1
  `;
  const parseZoned = parseZone(str);
  expect(parseZoned.records.length).toEqual(4);
  for (const record of parseZoned.records) {
    expect(record.name).toEqual("example.com");
  }
});

test("relative name resolution", () => {
  const str = dedent`
    $ORIGIN example.com.
    @    3600  IN  SOA  ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400
    www  60    IN  A    192.0.2.1
    mail 60    IN  A    192.0.2.2
    example.com. 60 IN A 192.0.2.3
  `;
  const parseZoned = parseZone(str);
  expect(parseZoned.records[1].name).toEqual("www.example.com");
  expect(parseZoned.records[2].name).toEqual("mail.example.com");
  expect(parseZoned.records[3].name).toEqual("example.com");
});

test("multiple origin", () => {
  const str = dedent`
    $ORIGIN example.com.
    www  60  IN  A  192.0.2.1
    $ORIGIN sub.example.com.
    www  60  IN  A  192.0.2.2
  `;
  const parseZoned = parseZone(str);
  expect(parseZoned.records[0].name).toEqual("www.example.com");
  expect(parseZoned.records[1].name).toEqual("www.sub.example.com");
  expect(parseZoned.origin).toEqual("sub.example.com");
});

test("multiple ttl", () => {
  const str = dedent`
    $ORIGIN example.com.
    $TTL 60
    @  IN  A  192.0.2.1
    $TTL 120
    @  IN  A  192.0.2.2
  `;
  const parseZoned = parseZone(str);
  expect(parseZoned.records[0].ttl).toEqual(60);
  expect(parseZoned.records[1].ttl).toEqual(120);
  expect(parseZoned.ttl).toEqual(120);
});

test("ttl clamping", () => {
  const str = dedent`
    example.com.  9999999999  IN  A  192.0.2.1
  `;
  const parseZoned = parseZone(str);
  expect(parseZoned.records[0].ttl).toEqual(2147483647);
});

test("class inheritance", () => {
  const str = dedent`
    $ORIGIN example.com.
    @  3600  IN  SOA  ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400
    @  60    IN  A    192.0.2.1
    @  60         A   192.0.2.2
  `;
  const parseZoned = parseZone(str);
  expect(parseZoned.records[2].class).toEqual("IN");
});

test("extended name characters", () => {
  const str = dedent`
    128/26.0.168.192.in-addr.arpa.  3600  IN  PTR  host.example.com.
    tag+test.example.com.  60  IN  A  192.0.2.1
  `;
  const parseZoned = parseZone(str);
  expect(parseZoned.records[0].name).toEqual("128/26.0.168.192.in-addr.arpa");
  expect(parseZoned.records[0].type).toEqual("PTR");
  expect(parseZoned.records[1].name).toEqual("tag+test.example.com");

  const backslashStr = "host\\032name.example.com.\t60\tIN\tA\t192.0.2.1";
  const parsed2 = parseZone(backslashStr);
  expect(parsed2.records[0].name).toEqual("host\\032name.example.com");
});

test("relative name with dots", () => {
  const str = dedent`
    $ORIGIN example.com.
    @       3600  IN  SOA  ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400
    sub.www  60   IN  A    192.0.2.1
  `;
  const parseZoned = parseZone(str);
  expect(parseZoned.records[1].name).toEqual("sub.www.example.com");
});

test("relative name resolution roundtrip", () => {
  const input = `${dedent`
    $ORIGIN example.com.

    ;; A Records
    www	60	IN	A	192.0.2.1
    mail	60	IN	A	192.0.2.2

  `}\n`;
  const parseZoned = parseZone(input);
  expect(parseZoned.records[0].name).toEqual("www.example.com");
  expect(parseZoned.records[1].name).toEqual("mail.example.com");
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(input);
});

test("name inheritance across directives", () => {
  const str = dedent`
    $ORIGIN example.com.
    www  60  IN  A  192.0.2.1
    $TTL 120
         60  IN  A  192.0.2.2
  `;
  const parseZoned = parseZone(str);
  expect(parseZoned.records[0].name).toEqual("www.example.com");
  expect(parseZoned.records[1].name).toEqual("www.example.com");
});

test("class inheritance chain", () => {
  const str = dedent`
    example.com.  3600  IN  SOA  ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400
    example.com.  60         A   192.0.2.1
    example.com.  60         A   192.0.2.2
    example.com.  60         AAAA 2001:db8::1
  `;
  const parseZoned = parseZone(str);
  for (const record of parseZoned.records) {
    expect(record.class).toEqual("IN");
  }
});

test("multiline non-soa record", () => {
  const str = dedent`
    example.com.  3600  IN  TXT  ("v=spf1"
                                  " include:example.com"
                                  " -all")
  `;
  const parseZoned = parseZone(str);
  expect(parseZoned.records[0].type).toEqual("TXT");
  expect(parseZoned.records[0].content).toEqual(`"v=spf1" " include:example.com" " -all"`);
});

test("ttl clamping boundaries", () => {
  expect(parseZone(dedent`example.com. 0 IN A 192.0.2.1`).records[0].ttl).toEqual(0);
  expect(parseZone(dedent`example.com. 2147483647 IN A 192.0.2.1`).records[0].ttl).toEqual(2147483647);
  expect(parseZone(dedent`example.com. 2147483648 IN A 192.0.2.1`).records[0].ttl).toEqual(2147483647);
});

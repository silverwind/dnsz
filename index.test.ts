import {parseZone, stringifyZone} from "./index.ts";
import dedent from "dedent";

const sectionedZone = (apex: string, host = apex) => `${dedent`
  ;; SOA Records
  ${apex}.	3600	IN	SOA	${apex}. root.${apex}. 2031242781 7200 3600 86400 3600

  ;; A Records
  ${host}.	60	IN	A	1.2.3.4	; a comment
  mx.${apex}.	60	IN	A	1.2.3.4	; another comment

  ;; AAAA Records
  ${host}.	120	IN	AAAA	2001:db8::1
  mx.${apex}.	120	IN	AAAA	2001:db8::1

  ;; CAA Records
  ${host}.	120	IN	CAA	0 issue "${apex}"

  ;; CNAME Records
  cname1.${apex}.	120	IN	CNAME	${apex}.
  cname2.${apex}.	120	IN	CNAME	${apex}.

  ;; MX Records
  ${apex}.	120	IN	MX	10 mx.${apex}.
  ${apex}.	120	IN	MX	10 mx3.${apex}.
  ${apex}.	120	IN	MX	10 mx2.${apex}.

  ;; TXT Records
  ${apex}.	120	IN	TXT	"first record"
  ${apex}.	120	IN	TXT	"second record"
  ${apex}.	120	IN	TXT	"third record"

`}\n`;

const originZone = `${dedent`
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

test.each(Object.entries({
  roundtrip: sectionedZone("simplezone.com"),
  dash: sectionedZone("dash-zone.net"),
  wildcard: sectionedZone("wildcard-zone.net", "*.wildcard-zone.net"),
  header: `${dedent`
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

  `}\n`,
  semicontent: `${dedent`
    ;; SOA Records
    semicontent.com.	3600	IN	SOA	semicontent.com. root.semicontent.com. 2031242781 7200 3600 86400 3600	; soa record

    ;; TXT Records
    @	3600	IN	TXT	"v=spf1 -all 2001::db8"	; txt record
    _dmarc	3600	IN	TXT	"v=DMARC1; p=reject; sp=reject; rua=mailto:admin@semicontent.com ruf=admin@semicontent.com"	; txt record

  `}\n`,
  type65534: `${dedent`
    ;; A Records
    sub.typezone.com.	3600	IN	A	1.2.3.4

    ;; TYPE65534 Records
    typezone.com.	0	IN	TYPE65534	\# 5 0472C10000
    typezone.com.	0	IN	TYPE65534	\# 5 048A880001
    typezone.com.	0	IN	TYPE65534	\# 5 0493E10001

  `}\n`,
}))("%s", (_name, zone) => {
  expect(stringifyZone(parseZone(zone))).toEqual(zone);
});

test("basic", () => {
  const parsed = parseZone(originZone);
  expect(stringifyZone(parsed)).toEqual(originZone);
  expect(parsed.records).toEqual([
    {name: "originzone.com", ttl: 3600, class: "IN", type: "SOA", content: "originzone.com. root.originzone.com. 2031242781 7200 3600 86400 3600", comment: null},
    {name: "originzone.com", ttl: 60, class: "IN", type: "A", content: "1.2.3.4", comment: "a comment"},
    {name: "mx.originzone.com", ttl: 60, class: "IN", type: "A", content: "1.2.3.4", comment: "another comment"},
    {name: "originzone.com", ttl: 120, class: "IN", type: "AAAA", content: "2001:db8::1", comment: null},
    {name: "mx.originzone.com", ttl: 120, class: "IN", type: "AAAA", content: "2001:db8::1", comment: null},
  ]);
  parsed.origin = "testzone.com";
  expect(stringifyZone(parsed)).toMatch(/^\$ORIGIN\s.+$/m);
});

test("replaceOrigin", () => {
  expect(parseZone(originZone, {replaceOrigin: "another.com"}).origin).toEqual("another.com");
});

test("origin", () => {
  expect(stringifyZone({origin: "originzone.com", records: [
    {name: "originzone.com.", ttl: 3600, class: "IN", type: "SOA", content: "originzone.com. root.originzone.com. 2031242781 7200 3600 86400 3600", comment: null},
    {name: "a.originzone.com.", ttl: 60, class: "IN", type: "A", content: "1.2.3.4", comment: "a comment"},
  ]}, {sections: true, dots: true})).toMatch(/^@/m);
});

test("ttl", () => {
  const parsed = parseZone(`${dedent`
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

  `}\n`);
  expect(parsed.records).toEqual([
    {name: "ttlzone.com", ttl: 60, class: "IN", type: "SOA", content: "ttlzone.com root.ttlzone.com 2031242781 7200 3600 86400 3600", comment: null},
    {name: "ttlzone.com", ttl: 60, class: "IN", type: "A", content: "1.2.3.4", comment: "a comment"},
    {name: "mx.ttlzone.com", ttl: 60, class: "IN", type: "A", content: "1.2.3.4", comment: "another comment"},
    {name: "ttlzone.com", ttl: 60, class: "IN", type: "AAAA", content: "2001:db8::1", comment: null},
    {name: "mx.ttlzone.com", ttl: 120, class: "IN", type: "AAAA", content: "2001:db8::1", comment: null},
  ]);
  expect(stringifyZone(parsed)).toMatch(/^\$TTL\s[0-9]+$/m);
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
  expect(stringifyZone(parseZone(str), {sections: false})).toEqual(str);
});

test("noname", () => {
  const parsed = parseZone(`${dedent`
    ;; SOA Records
    nonamezone.com.	3600	IN	SOA	nonamezone.com. root.nonamezone.com. 2031242781 7200 3600 86400 3600

    ;; A Records
    	60	IN	A	1.2.3.4	; a comment
    	60	IN	A	1.2.3.4	; another comment

    ;; AAAA Records
    	120	IN	AAAA	2001:db8::1
    	120	IN	AAAA	2001:db8::1

  `}\n`);
  expect(parsed.records.map(record => record.name)).toEqual(new Array(5).fill("nonamezone.com"));
  expect(stringifyZone(parsed)).toEqual(`${dedent`
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
  const {records} = parseZone(`${dedent`
    ;; SOA Records
    @	IN	SOA	nottlzone. root.notttlzone.com. 2031242781 7200 3600 86400 3600

    ;; A Records
    60	IN	A	1.2.3.4	; no name
    mx	IN	A	1.2.3.4	; no ttl
        IN	A	1.2.3.4	; no name and ttl

  `}\n`);
  for (const record of records) {
    expect([typeof record.name, typeof record.ttl, Boolean(record.class && record.type && record.content)]).toEqual(["string", "number", true]);
  }
});

test("ttlunits", () => {
  expect(parseZone(`${dedent`
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

  `}\n`).records).toEqual([
    {name: "ttlzone.com", ttl: 3600, class: "IN", type: "SOA", content: "ttlzone.com root.ttlzone.com 2031242781 7200 3600 86400 3600", comment: null},
    {name: "ttlzone.com", ttl: 7200, class: "IN", type: "A", content: "1.2.3.4", comment: "a comment"},
    {name: "mx.ttlzone.com", ttl: 300, class: "IN", type: "A", content: "1.2.3.4", comment: "another comment"},
    {name: "ttlzone.com", ttl: 604800, class: "IN", type: "AAAA", content: "2001:db8::1", comment: null},
    {name: "mx.ttlzone.com", ttl: 2, class: "IN", type: "AAAA", content: "2001:db8::1", comment: null},
  ]);
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

    ;; TXT Records
    commentzone.com.	60	IN	TXT	"C:\\"	; "quoted" comment

  `}\n`;
  const parseZoned = parseZone(str);
  expect(parseZoned.records[4].comment).toEqual(`"quoted" comment`);
  const roundtripped = stringifyZone(parseZoned);
  expect(roundtripped).toEqual(str);
});

test("single-line soa parens", () => {
  const parsed = parseZone(`${dedent`
    $ORIGIN originzone.com.

    ;; SOA Records
    @	3600	IN	SOA	originzone.com. root.originzone.com. (2031242781 7200 3600 86400 3600)

    ;; A Records
    @	60	IN	A	1.2.3.4	; a comment
  `}\n`);
  expect(parsed.records[0].content).toEqual("originzone.com. root.originzone.com. 2031242781 7200 3600 86400 3600");
  expect(stringifyZone(parsed)).toEqual(`${dedent`
    $ORIGIN originzone.com.

    ;; SOA Records
    @	3600	IN	SOA	originzone.com. root.originzone.com. 2031242781 7200 3600 86400 3600

    ;; A Records
    @	60	IN	A	1.2.3.4	; a comment

  `}\n`);
});

test("multiline soa", () => {
  const parsed = parseZone(`${dedent`
    $ORIGIN localhost.
    @  86400  IN  SOA   @  root (
                      1999010100 ; serial
                           10800 ; refresh (3 hours)
                             900 ; retry (15 minutes)
                          604800 ; expire (1 week)
                           86400 ; minimum (1 day)
                        )
    @  60  IN  A  127.0.0.1

  `}\n`);
  expect(parsed.records).toEqual([
    {name: "localhost", ttl: 86400, class: "IN", type: "SOA", content: "@ root 1999010100 10800 900 604800 86400", comment: null},
    {name: "localhost", ttl: 60, class: "IN", type: "A", content: "127.0.0.1", comment: null},
  ]);
  expect(stringifyZone(parsed)).toEqual(`${dedent`
    $ORIGIN localhost.

    ;; SOA Records
    @	86400	IN	SOA	@ root 1999010100 10800 900 604800 86400

    ;; A Records
    @	60	IN	A	127.0.0.1

  `}\n`);
});

test.each(Object.entries({
  "multiline soa with comment on first line": dedent`
    $ORIGIN example.com.
    @  3600  IN  SOA   ns1.example.com. admin.example.com. ( ; SOA record
                      2024010100 ; serial
                           10800 ; refresh
                             900 ; retry
                          604800 ; expire
                           86400 ; minimum
                         )

  `,
  "multiline soa with parentheses in comments": dedent`
    $ORIGIN example.com.
    @  3600  IN  SOA   ns1.example.com. admin.example.com. (
                      2024010100 ; serial (version)
                           10800 ; refresh (3 hours)
                             900 ; retry (15 minutes)
                          604800 ; expire (1 week)
                           86400 ; minimum (1 day)
                         )

  `,
}))("%s", (_name, zone) => {
  expect(parseZone(zone).records.map(({type, content}) => [type, content])).toEqual([["SOA", "ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400"]]);
});

test("mixed single-line and multiline records", () => {
  expect(parseZone(dedent`
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

  `).records).toEqual([
    {name: "example.com", ttl: 3600, class: "IN", type: "SOA", content: "ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400", comment: null},
    {name: "example.com", ttl: 60, class: "IN", type: "A", content: "192.0.2.1", comment: null},
    {name: "example.com", ttl: 60, class: "IN", type: "AAAA", content: "2001:db8::1", comment: null},
  ]);
});

test("inoptional", () => {
  const parseZoned = parseZone(`${dedent`
    example.com.	300	A	1.2.3.4
    example.com.	600	MX	10 mail.example.com.
    example.com.	172800	NS	foo.com.
    example.com.	172800	NS	bar.com.
    example.com.	300	TXT	"test"
    _dmarc.example.com.	300	CNAME	foo.com.
    _sip._tcp.example.com.	600	SRV	0 0 5060 sip.foo.com.
    _sips._tcp.example.com.	600	SRV	0 0 5061 sips.foo.com.

  `}\n`);
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
  expect(stringifyZone(parseZoned)).toEqual(`${dedent`
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
  expect(parseZone(dedent`
    $ORIGIN example.com.
    @  3600  IN  SOA  ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400
    @  60    IN  A    192.0.2.1
             60  IN  A    192.0.2.2
             60  IN  AAAA 2001:db8::1
  `).records.map(record => record.name)).toEqual(new Array(4).fill("example.com"));
});

test("relative name resolution", () => {
  expect(parseZone(dedent`
    $ORIGIN example.com.
    @    3600  IN  SOA  ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400
    www  60    IN  A    192.0.2.1
    mail 60    IN  A    192.0.2.2
    example.com. 60 IN A 192.0.2.3
  `).records.map(record => record.name)).toEqual(["example.com", "www.example.com", "mail.example.com", "example.com"]);
});

test("multiple origin", () => {
  const parsed = parseZone(dedent`
    $ORIGIN example.com.
    www  60  IN  A  192.0.2.1
    $ORIGIN sub.example.com.
    www  60  IN  A  192.0.2.2
  `);
  expect(parsed.records.map(record => record.name)).toEqual(["www.example.com", "www.sub.example.com"]);
  expect(parsed.origin).toEqual("sub.example.com");
});

test("multiple ttl", () => {
  const parsed = parseZone(dedent`
    $ORIGIN example.com.
    $TTL 60
    @  IN  A  192.0.2.1
    $TTL 120
    @  IN  A  192.0.2.2
  `);
  expect(parsed.records.map(record => record.ttl)).toEqual([60, 120]);
  expect(parsed.ttl).toEqual(120);
});

test("class inheritance", () => {
  expect(parseZone(dedent`
    $ORIGIN example.com.
    @  3600  IN  SOA  ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400
    @  60    IN  A    192.0.2.1
    @  60         A   192.0.2.2
  `).records.map(record => record.class)).toEqual(["IN", "IN", "IN"]);
});

test("extended name characters", () => {
  expect(parseZone(dedent`
    128/26.0.168.192.in-addr.arpa.  3600  IN  PTR  host.example.com.
    tag+test.example.com.  60  IN  A  192.0.2.1
  `).records).toEqual([
    {name: "128/26.0.168.192.in-addr.arpa", ttl: 3600, class: "IN", type: "PTR", content: "host.example.com.", comment: null},
    {name: "tag+test.example.com", ttl: 60, class: "IN", type: "A", content: "192.0.2.1", comment: null},
  ]);
  expect(parseZone("host\\032name.example.com.\t60\tIN\tA\t192.0.2.1").records[0].name).toEqual("host\\032name.example.com");
});

test("relative name with dots", () => {
  expect(parseZone(dedent`
    $ORIGIN example.com.
    @       3600  IN  SOA  ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400
    sub.www  60   IN  A    192.0.2.1
  `).records.map(record => record.name)).toEqual(["example.com", "sub.www.example.com"]);
});

test("relative name resolution roundtrip", () => {
  const input = `${dedent`
    $ORIGIN example.com.

    ;; A Records
    www	60	IN	A	192.0.2.1
    mail	60	IN	A	192.0.2.2

  `}\n`;
  const parsed = parseZone(input);
  expect(parsed.records.map(record => record.name)).toEqual(["www.example.com", "mail.example.com"]);
  expect(stringifyZone(parsed)).toEqual(input);
});

test("name inheritance across directives", () => {
  expect(parseZone(dedent`
    $ORIGIN example.com.
    www  60  IN  A  192.0.2.1
    $TTL 120
         60  IN  A  192.0.2.2
  `).records.map(record => record.name)).toEqual(["www.example.com", "www.example.com"]);
});

test("class inheritance chain", () => {
  expect(parseZone(dedent`
    example.com.  3600  IN  SOA  ns1.example.com. admin.example.com. 2024010100 10800 900 604800 86400
    example.com.  60         A   192.0.2.1
    example.com.  60         A   192.0.2.2
    example.com.  60         AAAA 2001:db8::1
  `).records.map(record => record.class)).toEqual(new Array(4).fill("IN"));
});

test("multiline non-soa record", () => {
  expect(parseZone(dedent`
    example.com.  3600  IN  TXT  ("v=spf1"
                                  " include:example.com"
                                  " -all")
  `).records).toEqual([
    {name: "example.com", ttl: 3600, class: "IN", type: "TXT", content: `"v=spf1" " include:example.com" " -all"`, comment: null},
  ]);
});

test("unclosed quotes, unclosed parens and long tokens parse in linear time", () => {
  const content = `\\\\"`.repeat(20000);
  const start = performance.now();
  expect(parseZone(`a 60 IN TXT ${content}`).records[0].content).toEqual(content);
  expect(parseZone(`a 60 IN TXT (${"\nx".repeat(30000)}`).records[0].content).toEqual("x ".repeat(30000).trim());
  expect(parseZone(`a ${"1".repeat(32)}\n${"a".repeat(100000)}`).records).toEqual([]);
  expect(performance.now() - start).toBeLessThan(1000);
});

test("ttl clamping", () => {
  expect([0, 2147483647, 2147483648, 9999999999].map(ttl => parseZone(`example.com. ${ttl} IN A 192.0.2.1`).records[0].ttl))
    .toEqual([0, 2147483647, 2147483647, 2147483647]);
});

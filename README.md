# dnsz
[![](https://img.shields.io/npm/v/dnsz.svg?style=flat)](https://www.npmjs.org/package/dnsz) [![](https://img.shields.io/npm/dm/dnsz.svg)](https://www.npmjs.org/package/dnsz) [![](https://api.travis-ci.org/silverwind/dnsz.svg?style=flat)](https://travis-ci.org/silverwind/dnsz)

> Generic DNS zone file parser and stringifier

This module supports encoding arbitrary record types. It makes no effort to parse a record's content so is compatible with all current and future record types.

The zone file output will be sorted by record type with a comment above each type section. Note that currently many features of zone files are unsupported (See the [TODOs](index.js)).

## Installation

```
$ npm i dnsz
```

## Example

```js
const dnsz = require("dnsz");

const data = dnsz.parse("example.com 60 IN A 1.2.3.4");
// => {records: [{name: "example.com", ttl: 60, class: "IN", type: "A", content: "1.2.3.4"}]}

dnsz.stringify(data);
// => ";; A Records\nexample.com.\t60\tIN\tA\t1.2.3.4\n"

```

## API
### dnsz.parse

Parse a string of a DNS zone file to a object in the format `{records: []}`.

### dnsz.stringify

Create a string of a DNS zone file from a object in the format `{records: []}`.

### `record`

A single record is represented as `{name, ttl, class, type, content}` where:

- `name`: The lowercase DNS name without a trailing dot, e.g. `"example.com"`.
- `ttl`: The TTL in seconds, e.g. `60`.
- `class`: The DNS class, e.g. `"IN"`.
- `type`: The record type, e.g. `"A"`.
- `content`: The record content, e.g. `"2001:db8::1"` or `"example.com."`.
- `comment`: A comment for this record, e.g. `"a comment"`.

## License

© [silverwind](https://github.com/silverwind), distributed under BSD licence

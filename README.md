# dnsz
[![](https://img.shields.io/npm/v/dnsz.svg?style=flat)](https://www.npmjs.org/package/dnsz) [![](https://img.shields.io/npm/dm/dnsz.svg)](https://www.npmjs.org/package/dnsz) [![](https://api.travis-ci.org/silverwind/dnsz.svg?style=flat)](https://travis-ci.org/silverwind/dnsz)

> Generic DNS zone file parser and stringifier

This module supports encoding arbitrary record types. It makes no effort to parse a record's content so is compatible with all current and future record types.

Note that currently some advanced features of zone files are not unsupported (See the [TODOs](index.js)).

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
### dnsz.parse(str, [opts])

Parse a string of a DNS zone file and returns a `data` object.

- `opts.replaceOrigin`: When specified, replaces any `@` in `name` or `content` with it. Default: `false`.
- `opts.crlf`: When true, emit `\r\n` instead of `\n` in `header`. Default: `false`.

### dnsz.stringify(data, [opts])

Parse a `data` object and return a string with the zone file contents.

- `opts.sections`: Whether to group records into sections. Default: `true`.
- `opts.crlf`: When `true`, emit `\r\n` instead of `\n` for the resulting zone file. Default: `false`.

If `data.origin` is specified, the following things happen:

- A `$ORIGIN` variable is added to the output.
- All occurences of `data.origin` within `content` are replaced with `@`.
- If `data.origin` matches the `name` of a `record`, `name` is replaced with `@`.
- If `data.origin` is at the end of `name` of a record, will change to the substring excluding `data.origin` and without the trailing dot (indicating a subdomain).

### `data` object

- `records`: Array of `record` with these props:
  - `name`: The lowercase DNS name without a trailing dot, e.g. `"example.com"`.
  - `ttl`: The TTL in seconds, e.g. `60`.
  - `class`: The DNS class, e.g. `"IN"`.
  - `type`: The record type, e.g. `"A"`.
  - `content`: The record content, e.g. `"2001:db8::1"` or `"example.com."`.
  - `comment`: A comment, e.g. `"a comment"`, `null` if absent.
- `origin`: The value of `$ORIGIN` in the zone file.
- `ttl`: The value of `$TTL` in the zone file.
- `header`: A optional header at the start of the file. Can be multiline. Does not include comment markers.

## License

© [silverwind](https://github.com/silverwind), distributed under BSD licence

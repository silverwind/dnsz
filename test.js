"use strict";

const m = require(".");
const assert = require("assert").strict;
const fs = require("fs").promises;

const exit = err => {
  if (err) console.error(err);
  process.exit(err ? 1 : 0);
};

const main = async () => {
  const str = await fs.readFile("./testzone.com.txt", "utf8");
  const parsed = m.parse(str);
  const roundtripped = m.stringify(parsed);
  assert.deepEqual(str, roundtripped);
};

main().then(exit).catch(exit);

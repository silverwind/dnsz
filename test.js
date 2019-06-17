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
  assert.deepEqual(str, m.stringify(m.parse(str)));
};

main().then(exit).catch(exit);

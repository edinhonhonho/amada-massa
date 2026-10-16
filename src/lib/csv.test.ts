import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./csv.ts";

test("csv escapa e protege contra fórmula", () => {
  const out = toCsv(["a", "b"], [["x;y", '"q"'], ["=1+1", -5]]);
  assert.equal(out, '﻿a;b\r\n"x;y";"""q"""\r\n\'=1+1;-5');
});

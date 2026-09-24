import test from "node:test";
import assert from "node:assert/strict";
import { makeBook, position, makePriceAt } from "../scripts/analyze.mjs";

test("FIFO: a send consumes the oldest lot first and realizes against its cost", () => {
  const b = makeBook();
  b.receive("a", 100, 1, 1.0);
  b.receive("a", 100, 2, 3.0);
  const r = b.send("a", 150, 2.0);
  assert.equal(r.qty, 150);
  assert.equal(r.cost, 100 * 1.0 + 50 * 3.0);
  assert.equal(r.value, 300);
  const p = position(b.get("a"));
  assert.equal(p.qty, 50);
  assert.equal(p.avg, 3.0);           // what remains is the expensive lot → underwater at 2.0
});

test("FIFO: a wallet can't send more than it holds", () => {
  const b = makeBook();
  b.receive("a", 10, 1, 1);
  const r = b.send("a", 25, 1);
  assert.equal(r.qty, 10);
  assert.equal(b.get("a").bal, 0);
});

test("price lookup forward-fills gaps and clamps before the first day", () => {
  const p = makePriceAt([["2024-01-01", 1], ["2024-01-03", 3]]);
  assert.equal(p(Date.parse("2024-01-02T10:00:00Z")), 1);
  assert.equal(p(Date.parse("2024-01-03T10:00:00Z")), 3);
  assert.equal(p(Date.parse("2023-12-01T00:00:00Z")), 1);
});

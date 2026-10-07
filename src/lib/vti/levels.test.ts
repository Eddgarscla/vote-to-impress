import assert from "node:assert/strict";
import { test } from "node:test";
import { levelFor } from "./levels.ts";

test("levels climb by impress points and stop at legend", () => {
  assert.equal(levelFor(0).key, "new_face");
  assert.equal(levelFor(99).label, "New Face");
  assert.equal(levelFor(100).key, "rising_star");
  assert.equal(levelFor(350).label, "Fashion Icon");
  assert.equal(levelFor(800).key, "style_royalty");
  assert.equal(levelFor(1600).key, "superstar");
  assert.equal(levelFor(3000).key, "legend");
  assert.equal(levelFor(9000).nextLabel, null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { runQuery } from "./db.ts";
import { checkColumns, DEFAULT_WIDGETS, resolveActions } from "./widgets.ts";

test("database rejects anything but reads", () => {
  assert.throws(() => runQuery("DELETE FROM orders"), /Only SELECT/);
  assert.throws(() => runQuery("ATTACH DATABASE 'x.db' AS x"), /Only SELECT/);
  // Passes the prefix check, must be stopped by the read-only connection.
  assert.throws(() => runQuery("WITH t AS (SELECT 1) DELETE FROM orders"), /readonly/);
  assert.equal(runQuery("SELECT * FROM order_items").length, 1000); // row cap
});

test("default widgets run and map to real columns", () => {
  for (const w of DEFAULT_WIDGETS) checkColumns(w, runQuery(w.sql));
});

test("resolveActions validates and merges", () => {
  const [added] = resolveActions([{ type: "add", widget: { title: "T", chart: "bar", sql: "SELECT 1 AS a", x: "a", y: "a" } }], []);
  assert.ok(added.type === "set" && added.widget.id && added.widget.span === 1);
  assert.deepEqual(added.type === "set" && added.widget.y, ["a"]);

  const [updated, removed] = resolveActions(
    [{ type: "update", id: "monthly", widget: { chart: "line", id: "hijack" } }, { type: "remove", id: "orders" }],
    DEFAULT_WIDGETS,
  );
  assert.ok(updated.type === "set" && updated.widget.chart === "line" && updated.widget.id === "monthly");
  assert.equal(updated.type === "set" && updated.widget.sql, DEFAULT_WIDGETS[3].sql);
  assert.deepEqual(removed, { type: "remove", id: "orders" });

  assert.throws(() => resolveActions([{ type: "remove", id: "nope" }], DEFAULT_WIDGETS), /no widget/);
  assert.throws(() => resolveActions([{ type: "add", widget: { title: "T", chart: "radar", sql: "SELECT 1" } }], []), /chart/);
  assert.throws(() => resolveActions({}, []), /array/);
});

test("checkColumns reports missing columns", () => {
  const w = { ...DEFAULT_WIDGETS[3], y: ["nope"] };
  assert.throws(() => checkColumns(w, runQuery(w.sql)), /nope not in the query result/);
});

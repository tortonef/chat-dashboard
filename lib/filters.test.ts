import test from "node:test";
import assert from "node:assert/strict";
import { getTables, runQuery } from "./db.ts";

const count = (sql: string, filters?: unknown) => Number(runQuery(sql, filters)[0].n);
const italy = [{ table: "customers", column: "country", values: ["Italy"] }];

test("schema exposes filterable columns", () => {
  const col = (t: string, c: string) => getTables().find((x) => x.name === t)!.columns.find((x) => x.name === c)!;
  assert.ok(col("customers", "country").values!.includes("Italy"));
  assert.deepEqual(col("orders", "order_date").range, ["2025-01-01", "2026-10-31"]);
  assert.equal(col("customers", "name").values ?? col("customers", "name").range, undefined);
});

test("filters flow down foreign keys, not up", () => {
  const joined = "FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.country = 'Italy'";
  const orders = count(`SELECT COUNT(*) AS n ${joined}`);
  assert.ok(orders > 0 && orders < count("SELECT COUNT(*) AS n FROM orders"));
  assert.equal(count("SELECT COUNT(*) AS n FROM orders", italy), orders); // one level, no join in the query
  assert.equal(
    count("SELECT COUNT(*) AS n FROM order_items", italy), // two levels
    count(`SELECT COUNT(*) AS n FROM order_items WHERE order_id IN (SELECT o.id ${joined})`),
  );
  assert.equal(count("SELECT COUNT(*) AS n FROM products", italy), 30); // unrelated table untouched

  const dates = [{ table: "orders", column: "order_date", from: "2026-01-01", to: "2026-01-31" }];
  assert.equal(count("SELECT COUNT(*) AS n FROM orders", dates), count("SELECT COUNT(*) AS n FROM orders WHERE order_date BETWEEN '2026-01-01' AND '2026-01-31'"));
  assert.equal(count("SELECT COUNT(*) AS n FROM customers", dates), 300); // parents are not narrowed by children
});

test("filters combine and work with queries that have their own CTEs", () => {
  const both = [...italy, { table: "orders", column: "status", values: ["refunded", "cancelled"] }];
  const n = count("WITH recent AS (SELECT * FROM orders WHERE order_date >= '2026-01-01') SELECT COUNT(*) AS n FROM recent", both);
  assert.equal(
    n,
    count("SELECT COUNT(*) AS n FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.country = 'Italy' AND o.status <> 'completed' AND o.order_date >= '2026-01-01'"),
  );
  assert.ok(n > 0);
});

test("unknown tables, columns, values and malformed input are ignored", () => {
  const all = count("SELECT COUNT(*) AS n FROM orders");
  for (const bad of [
    [{ table: "customers", column: "country", values: ["x' OR 1=1 --"] }],
    [{ table: "orders", column: "order_date", from: "2026-01-01'; DROP TABLE orders; --" }],
    [{ table: "nope", column: "country", values: ["Italy"] }],
    [{ table: "customers", column: 'country" OR 1=1 --', values: ["Italy"] }],
    [null, 42, "customers"],
    "customers",
    { table: "customers" },
  ])
    assert.equal(count("SELECT COUNT(*) AS n FROM orders", bad), all);
  assert.throws(() => runQuery("DELETE FROM orders", italy), /Only SELECT/); // statement check runs on the original SQL
});

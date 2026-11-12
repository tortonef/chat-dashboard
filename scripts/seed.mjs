// Generates data/demo.db: a small deterministic e-commerce dataset.
// Skips if the file exists; pass --force to rebuild.
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, rmSync } from "node:fs";

const file = "data/demo.db";
if (existsSync(file) && !process.argv.includes("--force")) process.exit(0);
mkdirSync("data", { recursive: true });
rmSync(file, { force: true });

// mulberry32: seeded PRNG so every clone gets the same data
let seed = 42;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));

const FIRST = ["Alice", "Marco", "Sofia", "Liam", "Emma", "Noah", "Giulia", "Lucas", "Mia", "Hugo", "Elena", "Jonas", "Chloe", "Mateo", "Nora", "Felix", "Ines", "Oscar", "Lena", "Tom"];
const LAST = ["Rossi", "Smith", "Müller", "Dubois", "García", "Bianchi", "Jensen", "Novak", "Silva", "Brown", "Martin", "Costa", "Weber", "Moreau", "Taylor", "Ricci", "Lopez", "Fischer", "Evans", "Conti"];
const COUNTRIES = ["Italy", "Italy", "Germany", "Germany", "France", "France", "Spain", "United Kingdom", "United States", "United States", "Netherlands", "Sweden"];
const SEGMENTS = ["Consumer", "Consumer", "Consumer", "Small Business", "Small Business", "Enterprise"];
const CATALOG = {
  Electronics: [["Wireless Headphones", 129], ["Smart Speaker", 89], ["4K Monitor", 349], ["Mechanical Keyboard", 109], ["Webcam Pro", 79], ["USB-C Hub", 45]],
  Home: [["Espresso Machine", 249], ["Air Purifier", 179], ["Desk Lamp", 39], ["Robot Vacuum", 299], ["Cookware Set", 119], ["Throw Blanket", 35]],
  Sports: [["Yoga Mat", 29], ["Running Shoes", 119], ["Dumbbell Set", 89], ["Cycling Helmet", 65], ["Fitness Tracker", 99], ["Water Bottle", 19]],
  Books: [["Data Science Handbook", 42], ["Modern Cooking", 28], ["Sci-Fi Trilogy", 36], ["Travel Atlas", 31], ["Design Basics", 39], ["History of Art", 55]],
  Beauty: [["Skincare Kit", 59], ["Hair Dryer", 75], ["Perfume 50ml", 68], ["Electric Shaver", 95], ["Makeup Palette", 44], ["Body Lotion", 17]],
};

const db = new DatabaseSync(file);
db.exec(`
  CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT NOT NULL, segment TEXT NOT NULL, signup_date TEXT NOT NULL);
  CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL);
  CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), order_date TEXT NOT NULL, status TEXT NOT NULL);
  CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, unit_price REAL NOT NULL);
  BEGIN;
`);

const START = Date.UTC(2025, 0, 1);
const DAYS = 669; // 2025-01-01 .. 2026-10-31
const day = (n) => new Date(START + n * 86400000).toISOString().slice(0, 10);

const addCustomer = db.prepare("INSERT INTO customers (name, country, segment, signup_date) VALUES (?, ?, ?, ?)");
const signup = [];
for (let i = 0; i < 300; i++) {
  const d = i < 100 ? 0 : int(0, DAYS - 30); // first 100 are existing customers on day one
  signup.push(d);
  addCustomer.run(`${pick(FIRST)} ${pick(LAST)}`, pick(COUNTRIES), pick(SEGMENTS), day(d));
}

const addProduct = db.prepare("INSERT INTO products (name, category, price) VALUES (?, ?, ?)");
const prices = [];
for (const [category, items] of Object.entries(CATALOG))
  for (const [name, price] of items) {
    addProduct.run(name, category, price);
    prices.push(price);
  }

const addOrder = db.prepare("INSERT INTO orders (customer_id, order_date, status) VALUES (?, ?, ?)");
const addItem = db.prepare("INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)");
for (let d = 0; d < DAYS; d++) {
  const month = new Date(START + d * 86400000).getUTCMonth();
  const season = month >= 10 ? 1.6 : month === 6 || month === 7 ? 0.8 : 1; // holiday peak, summer dip
  const n = Math.round((5 + (d / DAYS) * 6) * season * (0.6 + rand() * 0.8)); // growth + noise
  for (let o = 0; o < n; o++) {
    let customer = int(0, signup.length - 1);
    if (signup[customer] > d) customer = int(0, 99); // no orders before signup
    const r = rand();
    const status = r < 0.9 ? "completed" : r < 0.96 ? "cancelled" : "refunded";
    const { lastInsertRowid } = addOrder.run(customer + 1, day(d), status);
    for (let i = int(1, 4); i > 0; i--) {
      const product = int(0, prices.length - 1);
      const discount = rand() < 0.2 ? 0.9 : 1;
      addItem.run(lastInsertRowid, product + 1, int(1, 3), Math.round(prices[product] * discount * 100) / 100);
    }
  }
}
db.exec("COMMIT");
db.close();
console.log(`Seeded ${file}`);

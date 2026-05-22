import sqlite3 from "sqlite3";
import path from "path";
import bcrypt from "bcryptjs";

const dbPath = path.join(process.cwd(), "database.sqlite");
const db = new sqlite3.Database(dbPath);

// Helper to wrap SQLite query executing with promises
export function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export function queryGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

export function queryRun(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export async function initDatabase() {
  console.log("Initializing SQLite Database at", dbPath);

  // 1. Users table
  await queryRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT,
      email TEXT UNIQUE,
      password TEXT,
      phone TEXT,
      company TEXT,
      role TEXT CHECK(role IN ('user', 'admin')),
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Parcels table
  await queryRun(`
    CREATE TABLE IF NOT EXISTS parcels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_number TEXT UNIQUE,
      user_id INTEGER,
      sender_name TEXT,
      receiver_name TEXT,
      receiver_address TEXT,
      receiver_phone TEXT,
      weight DECIMAL,
      dimensions TEXT,
      status TEXT CHECK(status IN ('pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception')),
      current_location TEXT,
      estimated_delivery DATE,
      shipping_cost DECIMAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // 3. Tracking history table
  await queryRun(`
    CREATE TABLE IF NOT EXISTS tracking_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_number TEXT,
      status TEXT,
      location TEXT,
      description TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Chats table
  await queryRun(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      admin_id INTEGER,
      message TEXT,
      sender_type TEXT CHECK(sender_type IN ('user', 'admin')),
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // 5. Chat sessions table
  await queryRun(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      admin_id INTEGER,
      status TEXT CHECK(status IN ('active', 'closed')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Seed default admin and sample users if not already exists
  const existingAdmin = await queryGet("SELECT * FROM users WHERE email = ?", ["admin@fedex.com"]);
  if (!existingAdmin) {
    const adminHash = await bcrypt.hash("admin123", 10);
    await queryRun(
      "INSERT INTO users (fullname, email, password, phone, company, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["FedEx Admin", "admin@fedex.com", adminHash, "+1-800-463-3339", "FedEx Express", "admin", "approved"]
    );
    console.log("Seeded Admin: admin@fedex.com / admin123");
  }

  const existingJohn = await queryGet("SELECT * FROM users WHERE email = ?", ["john@example.com"]);
  if (!existingJohn) {
    const johnHash = await bcrypt.hash("password123", 10);
    const johnResult = await queryRun(
      "INSERT INTO users (fullname, email, password, phone, company, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["John Doe", "john@example.com", johnHash, "+65 9876 5432", "Delight Foods SG", "user", "approved"]
    );

    // Seed John's completed and ongoing parcels
    // Parcel FDX987654321 - Delivered
    await queryRun(
      `INSERT INTO parcels (tracking_number, user_id, sender_name, receiver_name, receiver_address, receiver_phone, weight, dimensions, status, current_location, estimated_delivery, shipping_cost, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))`,
      ["FDX987654321", johnResult.lastID, "Global Imports", "John Doe", "78 orchard Blvd, SG", "+65 9876 5432", 1.0, "20x10x10 cm", "delivered", "Destination Facility", "2026-05-21", 15.00]
    );

    // Add tracing history for delivered parcel
    await queryRun(
      `INSERT INTO tracking_history (tracking_number, status, location, description, timestamp) VALUES (?, ?, ?, ?, datetime('now', '-2 days'))`,
      ["FDX987654321", "pending", "Changi Warehouse", "Shipment information received", ]
    );
    await queryRun(
      `INSERT INTO tracking_history (tracking_number, status, location, description, timestamp) VALUES (?, ?, ?, ?, datetime('now', '-1 days'))`,
      ["FDX987654321", "in_transit", "Singapore Hub", "Parcel departed warehouse in transit", ]
    );
    await queryRun(
      `INSERT INTO tracking_history (tracking_number, status, location, description, timestamp) VALUES (?, ?, ?, ?, datetime('now'))`,
      ["FDX987654321", "delivered", "Destination Facility", "Parcel has been successfully delivered", ]
    );

    // Parcel FDX123456789 - In transit, Singapore Hub
    await queryRun(
      `INSERT INTO parcels (tracking_number, user_id, sender_name, receiver_name, receiver_address, receiver_phone, weight, dimensions, status, current_location, estimated_delivery, shipping_cost, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 days'))`,
      ["FDX123456789", johnResult.lastID, "FedEx Corp", "Singapore Hub Owner", "123 Changi Road, SG", "+65 9123 4567", 2.5, "30x20x15 cm", "in_transit", "Singapore Hub", "2026-05-25", 22.50]
    );

    await queryRun(
      `INSERT INTO tracking_history (tracking_number, status, location, description, timestamp) VALUES (?, ?, ?, ?, datetime('now', '-1 days'))`,
      ["FDX123456789", "pending", "Changi Warehouse", "Shipment label created"]
    );
    await queryRun(
      `INSERT INTO tracking_history (tracking_number, status, location, description, timestamp) VALUES (?, ?, ?, ?, datetime('now'))`,
      ["FDX123456789", "in_transit", "Singapore Hub", "Arrived at Singapore Sorting Facility"]
    );

    console.log("Seeded approved user John Doe with parcels");
  }

  const existingMary = await queryGet("SELECT * FROM users WHERE email = ?", ["mary@example.com"]);
  if (!existingMary) {
    const maryHash = await bcrypt.hash("password123", 10);
    const maryResult = await queryRun(
      "INSERT INTO users (fullname, email, password, phone, company, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["Mary Stuart", "mary@example.com", maryHash, "+65 9012 3456", "E-shop Co Ltd", "user", "pending"]
    );

    // Mary parcel FDX456789123 - Pending pickup
    await queryRun(
      `INSERT INTO parcels (tracking_number, user_id, sender_name, receiver_name, receiver_address, receiver_phone, weight, dimensions, status, current_location, estimated_delivery, shipping_cost, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ["FDX456789123", maryResult.lastID, "E-shop Co", "Mary Stuart", "456 Jurong East Dr, SG", "+65 9012 3456", 5.0, "40x30x20 cm", "pending", "Changi Warehouse", "2026-05-27", 35.00]
    );

    // Tracking history
    await queryRun(
      `INSERT INTO tracking_history (tracking_number, status, location, description, timestamp) VALUES (?, ?, ?, ?, datetime('now'))`,
      ["FDX456789123", "pending", "Changi Warehouse", "Shipment scheduled for pickup"]
    );

    console.log("Seeded pending user Mary Stuart with parcel");
  }
}

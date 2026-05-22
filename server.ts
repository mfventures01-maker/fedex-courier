import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Server, Socket } from "socket.io";
import { createServer as createViteServer } from "vite";
import {
  initDatabase,
  queryAll,
  queryGet,
  queryRun
} from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "fedex_super_secret_key_1337";
const PORT = 3000;

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: "user" | "admin";
    fullname: string;
  };
}

async function startServer() {
  // Initialize SQLite schema and seed records
  await initDatabase();

  const app = express();
  app.use(express.json());

  // Create standard HTTP server so Socket.io and Express run on the same port
  const server = http.createServer(app);

  // Initialize Socket.io
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Keep track of connected sockets to send notifications
  const userRooms = new Map<number, string>(); // userId -> socketId

  io.on("connection", (socket: Socket) => {
    console.log("Socket connected:", socket.id);

    // Join active user or admin session
    socket.on("join", (data: { userId: number; role: string }) => {
      if (data.userId) {
        // Simple room channel matching user id
        socket.join(`user_${data.userId}`);
        userRooms.set(data.userId, socket.id);
        console.log(`User ${data.userId} (${data.role}) joined socket room "user_${data.userId}"`);
      }
    });

    // Chat room setup
    socket.on("join-chat", (data: { userId: number }) => {
      if (data.userId) {
        socket.join(`chat_${data.userId}`);
        console.log(`Socket joined chat channel: chat_${data.userId}`);
      }
    });

    // Send chats activity
    socket.on("send-message", (data: {
      userId: number;
      message: string;
      senderType: "user" | "admin";
    }) => {
      // Broadcast to specific chat room channel
      io.to(`chat_${data.userId}`).emit("new-chat-message", {
        userId: data.userId,
        message: data.message,
        senderType: data.senderType,
        createdAt: new Date()
      });
      // Also notify Admin Dashboard for message alert notification list
      if (data.senderType === "user") {
        io.emit("admin-notification", {
          type: "chat",
          userId: data.userId,
          message: `New support message from user CLI`
        });
      }
    });

    // Handle user typing notifications
    socket.on("typing", (data: { userId: number; isTyping: boolean; senderType: "user" | "admin" }) => {
      io.to(`chat_${data.userId}`).emit("typing", data);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  // --- AUTHENTICATION MIDDLEWARES ---
  function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({ error: "Access token required" });
      return;
    }

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        res.status(403).json({ error: "Invalid or expired token" });
        return;
      }
      req.user = decoded as AuthRequest["user"];
      next();
    });
  }

  function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  }

  // --- API ROUTE ENDPOINTS ---

  // 1. Auth Endpoint: User Registration
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const { fullname, email, password, phone, company } = req.body;

      if (!fullname || !email || !password || !phone) {
        res.status(400).json({ error: "Fullname, email, password, and phone are required fields." });
        return;
      }

      // Check if user already exists
      const existing = await queryGet("SELECT id FROM users WHERE email = ?", [email]);
      if (existing) {
        res.status(400).json({ error: "This email address is already registered." });
        return;
      }

      const hash = await bcrypt.hash(password, 10);
      const result = await queryRun(
        `INSERT INTO users (fullname, email, password, phone, company, role, status)
         VALUES (?, ?, ?, ?, ?, 'user', 'pending')`,
        [fullname, email, hash, phone, company || ""]
      );

      // Simulated email verification
      console.log(`\n=============================================================`);
      console.log(`[SIMULATED EMAIL SYSTEM]`);
      console.log(`To: ${email}`);
      console.log(`Subject: Verify Your FedEx Account`);
      console.log(`Verify OTP: ${Math.floor(100000 + Math.random() * 900000)}`);
      console.log(`Link: http://localhost:3000/verify-email?id=${result.lastID}`);
      console.log(`=============================================================\n`);

      res.status(201).json({
        message: "Registration successful! Account is pending admin approval.",
        userId: result.lastID
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Client Login / Auth Endpoint
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const user = await queryGet("SELECT * FROM users WHERE email = ?", [email]);
      if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      if (user.role === "admin") {
        // Let admin login via standard path smoothly, but assign correct role
        const token = jwt.sign({ id: user.id, email: user.email, role: "admin", fullname: user.fullname }, JWT_SECRET, { expiresIn: "24h" });
        res.json({ token, role: "admin", user: { id: user.id, fullname: user.fullname, email: user.email, status: user.status } });
        return;
      }

      // Check status of normal user
      if (user.status === "pending") {
        res.status(403).json({ error: "Your registration is currently pending admin approval." });
        return;
      } else if (user.status === "rejected") {
        res.status(403).json({ error: "Your registration has been rejected. Please contact support." });
        return;
      }

      const token = jwt.sign({ id: user.id, email: user.email, role: "user", fullname: user.fullname }, JWT_SECRET, { expiresIn: "24h" });
      res.json({
        token,
        role: "user",
        user: { id: user.id, fullname: user.fullname, email: user.email, status: user.status }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Specific Direct Login
  app.post("/api/admin/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const user = await queryGet("SELECT * FROM users WHERE email = ? AND role = 'admin'", [email]);
      if (!user) {
        res.status(401).json({ error: "Admin account not found" });
        return;
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        res.status(401).json({ error: "Invalid administration credentials" });
        return;
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: "admin", fullname: user.fullname },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({
        token,
        role: "admin",
        user: { id: user.id, fullname: user.fullname, email: user.email }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Client Dashboard/Member APIs

  // 1. Profile information
  app.get("/api/user/profile", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await queryGet("SELECT id, fullname, email, phone, company, role, status, created_at FROM users WHERE id = ?", [req.user!.id]);
      if (!profile) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Client Parcels
  app.get("/api/user/parcels", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const parcels = await queryAll("SELECT * FROM parcels WHERE user_id = ? ORDER BY created_at DESC", [req.user!.id]);
      res.json(parcels);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Client ships a package
  app.post("/api/user/ship", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { receiver_name, receiver_address, receiver_phone, weight, dimensions } = req.body;

      if (!receiver_name || !receiver_address || !receiver_phone || !weight || !dimensions) {
        res.status(400).json({ error: "Missing required shipping values" });
        return;
      }

      // Generate UNIQUE Tracking number matching FedEx format ('FDX' + 12 alphanumeric digits)
      const generateTracking = () => {
        const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let result = "FDX";
        for (let i = 0; i < 12; i++) {
          result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }
        return result;
      };

      let isUnique = false;
      let trackingNumber = "";
      while (!isUnique) {
        trackingNumber = generateTracking();
        const dup = await queryGet("SELECT id FROM parcels WHERE tracking_number = ?", [trackingNumber]);
        if (!dup) isUnique = true;
      }

      // Compute weight cost: $5 per kg + $10 base
      const shipping_cost = Number(weight) * 5 + 10;
      // Est delivery: 3 days from now
      const d = new Date();
      d.setDate(d.getDate() + 3);
      const estimated_delivery = d.toISOString().split("T")[0];

      await queryRun(
        `INSERT INTO parcels (tracking_number, user_id, sender_name, receiver_name, receiver_address, receiver_phone, weight, dimensions, status, current_location, estimated_delivery, shipping_cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'Singapore Hub', ?, ?, datetime('now'))`,
        [trackingNumber, req.user!.id, req.user!.fullname, receiver_name, receiver_address, receiver_phone, weight, dimensions, estimated_delivery, shipping_cost]
      );

      // Create primary tracking history
      await queryRun(
        `INSERT INTO tracking_history (tracking_number, status, location, description, timestamp)
         VALUES (?, 'pending', 'Singapore Hub', 'Shipment label generated successfully. Pending package pickup.', datetime('now'))`,
        [trackingNumber]
      );

      res.status(201).json({
        message: "Shipment registered successfully!",
        trackingNumber,
        shippingCost: shipping_cost
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Public Tracking Endpoint
  app.get("/api/track/:trackingNumber", async (req: Request, res: Response) => {
    try {
      const trackingNo = req.params.trackingNumber.toUpperCase().trim();
      const parcel = await queryGet("SELECT * FROM parcels WHERE tracking_number = ?", [trackingNo]);

      if (!parcel) {
        res.status(404).json({ error: "Tracking identification code not found" });
        return;
      }

      const timeline = await queryAll(
        "SELECT * FROM tracking_history WHERE tracking_number = ? ORDER BY timestamp DESC",
        [trackingNo]
      );

      res.json({ parcel, timeline });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- ADMIN FUNCTIONALITY ROUTES ---

  // 1. Admin users list
  app.get("/api/admin/users", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const users = await queryAll("SELECT id, fullname, email, phone, company, role, status, created_at FROM users ORDER BY created_at DESC");
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Admin approves a client
  app.put("/api/admin/users/:id/approve", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      await queryRun("UPDATE users SET status = 'approved' WHERE id = ?", [userId]);
      res.json({ message: "User account has been successfully approved. They are ready to log in." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Admin rejects a client
  app.put("/api/admin/users/:id/reject", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      await queryRun("UPDATE users SET status = 'rejected' WHERE id = ?", [userId]);
      res.json({ message: "User registration status has been set to rejected." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3b. Admin edits a client info
  app.put("/api/admin/users/:id/edit", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { fullname, phone, company } = req.body;
      if (!fullname || !phone) {
        res.status(400).json({ error: "Full name and phone fields are required" });
        return;
      }
      await queryRun(
        "UPDATE users SET fullname = ?, phone = ?, company = ? WHERE id = ?",
        [fullname, phone, company || "", userId]
      );
      res.json({ message: "Client profile updated successfully." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Admin deletes a client
  app.delete("/api/admin/users/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      // Suppress or handle integrity or cascade if needed
      await queryRun("DELETE FROM parcels WHERE user_id = ?", [userId]);
      await queryRun("DELETE FROM users WHERE id = ?", [userId]);
      res.json({ message: "User account and all corresponding parcels have been deleted." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Admin List all parcels
  app.get("/api/admin/parcels", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const parcels = await queryAll("SELECT * FROM parcels ORDER BY created_at DESC");
      res.json(parcels);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper mapping package status from updated location automatically
  function getStatusForLocation(location: string): "pending" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "exception" {
    switch (location) {
      case "Changi Warehouse":
        return "picked_up";
      case "Singapore Hub":
      case "Customs":
        return "in_transit";
      case "Out for Delivery":
        return "out_for_delivery";
      case "Destination Facility":
        return "delivered";
      default:
        return "in_transit";
    }
  }

  // 6. Admin updates location (implicitly updates status as well based on map)
  app.put("/api/admin/parcels/:id/location", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const parcelId = parseInt(req.params.id);
      const { location, description } = req.body;

      if (!location) {
        res.status(400).json({ error: "Location parameter is required." });
        return;
      }

      const parcel = await queryGet("SELECT * FROM parcels WHERE id = ?", [parcelId]);
      if (!parcel) {
        res.status(404).json({ error: "Parcel not found" });
        return;
      }

      const calculatedStatus = getStatusForLocation(location);

      // Perform updates
      await queryRun(
        "UPDATE parcels SET current_location = ?, status = ? WHERE id = ?",
        [location, calculatedStatus, parcelId]
      );

      // Create tracing timeline history entry
      await queryRun(
        `INSERT INTO tracking_history (tracking_number, status, location, description, timestamp)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [parcel.tracking_number, calculatedStatus, location, description || `Parcel scanned at ${location}. Status: ${calculatedStatus}`]
      );

      // SOCKET REAL-TIME EMITS: Notify the user in real-time
      io.to(`user_${parcel.user_id}`).emit("notification", {
        type: "parcel-update",
        trackingNumber: parcel.tracking_number,
        status: calculatedStatus,
        location,
        message: `Your FedEx parcel ${parcel.tracking_number} is updated: ${location}`
      });

      io.emit("status-update", {
        trackingNumber: parcel.tracking_number,
        status: calculatedStatus,
        location
      });

      io.emit("location-update", {
        trackingNumber: parcel.tracking_number,
        location
      });

      res.json({
        message: "Parcel current location and status updated successfully",
        status: calculatedStatus,
        location
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Admin updates status directly
  app.put("/api/admin/parcels/:id/status", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const parcelId = parseInt(req.params.id);
      const { status, description } = req.body;

      if (!status) {
        res.status(400).json({ error: "Status parameter is required." });
        return;
      }

      const parcel = await queryGet("SELECT * FROM parcels WHERE id = ?", [parcelId]);
      if (!parcel) {
        res.status(404).json({ error: "Parcel not found" });
        return;
      }

      await queryRun("UPDATE parcels SET status = ? WHERE id = ?", [status, parcelId]);

      // Add timeline
      await queryRun(
        `INSERT INTO tracking_history (tracking_number, status, location, description, timestamp)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [parcel.tracking_number, status, parcel.current_location, description || `Parcel status update: ${status}`]
      );

      // Notify user via socket room
      io.to(`user_${parcel.user_id}`).emit("notification", {
        type: "parcel-update",
        trackingNumber: parcel.tracking_number,
        status,
        location: parcel.current_location,
        message: `Your FedEx parcel ${parcel.tracking_number} status changed to: ${status}`
      });

      io.emit("status-update", {
        trackingNumber: parcel.tracking_number,
        status,
        location: parcel.current_location
      });

      res.json({ message: "Parcel status updated successfully", status });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Admin Statistics Dashboard
  app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const usersCount = await queryGet("SELECT COUNT(*) as count FROM users WHERE role = 'user'");
      const parcelsCount = await queryGet("SELECT COUNT(*) as count FROM parcels");
      const deliveredCount = await queryGet("SELECT COUNT(*) as count FROM parcels WHERE status = 'delivered'");
      const transitCount = await queryGet("SELECT COUNT(*) as count FROM parcels WHERE status IN ('in_transit', 'picked_up', 'out_for_delivery')");

      // Daily stats mapping for chart dashboard
      const dailyParcels = await queryAll(`
        SELECT date(created_at) as day, count(*) as count
        FROM parcels
        GROUP BY day
        ORDER BY day DESC
        LIMIT 7
      `);

      res.json({
        totalUsers: usersCount?.count || 0,
        totalParcels: parcelsCount?.count || 0,
        delivered: deliveredCount?.count || 0,
        inTransit: transitCount?.count || 0,
        dailyParcels
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Generate Reports (Exports CSV stream)
  app.get("/api/admin/reports", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const parcels = await queryAll(`
        SELECT p.tracking_number, u.email as sender_email, p.sender_name, p.receiver_name,
               p.receiver_address, p.weight, p.dimensions, p.status, p.current_location,
               p.shipping_cost, p.created_at
        FROM parcels p
        LEFT JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
      `);

      let csv = "Tracking Number,Sender Email,Sender Name,Receiver Name,Receiver Address,Weight (kg),Dimensions,Status,Current Location,Shipping Cost ($),Created At\n";
      for (const p of parcels) {
        csv += `"${p.tracking_number}","${p.sender_email || ''}","${p.sender_name || ''}","${p.receiver_name || ''}","${(p.receiver_address || '').replace(/"/g, '""')}",${p.weight},"${p.dimensions}","${p.status}","${p.current_location}",${p.shipping_cost},"${p.created_at}"\n`;
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=fedex_parcels_report.csv");
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- SUPPORT LIVE CHAT SYSTEM CHANNELS ---

  // 1. Get Chat history for designated user
  app.get("/api/chats/:userId", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const activeUserId = parseInt(req.params.userId);

      // Access checks: User can only read their own chat; Admin can read anyone's chat
      if (req.user!.role !== "admin" && req.user!.id !== activeUserId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const messages = await queryAll(
        "SELECT * FROM chats WHERE user_id = ? ORDER BY created_at ASC",
        [activeUserId]
      );
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Client or admin sends message
  app.post("/api/chats/send", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { userId, message } = req.body;
      const parsedUserId = parseInt(userId);

      if (!parsedUserId || !message?.trim()) {
        res.status(400).json({ error: "User ID and message body are required" });
        return;
      }

      const senderType = req.user!.role; // "user" or "admin"

      // Access check: User must be themselves
      if (senderType === "user" && req.user!.id !== parsedUserId) {
        res.status(403).json({ error: "Unauthorized chat access" });
        return;
      }

      const adminId = senderType === "admin" ? req.user!.id : null;

      // Ensure a chat session is initialized or remains active
      const session = await queryGet("SELECT id FROM chat_sessions WHERE user_id = ? AND status = 'active'", [parsedUserId]);
      if (!session) {
        await queryRun(
          "INSERT INTO chat_sessions (user_id, admin_id, status) VALUES (?, ?, 'active')",
          [parsedUserId, adminId]
        );
      } else if (senderType === "admin") {
        await queryRun("UPDATE chat_sessions SET admin_id = ? WHERE id = ?", [adminId, session.id]);
      }

      // Record message
      const result = await queryRun(
        `INSERT INTO chats (user_id, admin_id, message, sender_type, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [parsedUserId, adminId, message.trim(), senderType, 0]
      );

      // Send via socket.io inside room `chat_${userId}`
      io.to(`chat_${parsedUserId}`).emit("new-chat-message", {
        id: result.lastID,
        userId: parsedUserId,
        idAdmin: adminId,
        message: message.trim(),
        senderType,
        isRead: 0,
        createdAt: new Date().toISOString()
      });

      // Also trigger a user notification if Admin is replying!
      if (senderType === "admin") {
        io.to(`user_${parsedUserId}`).emit("notification", {
          type: "chat-reply",
          userId: parsedUserId,
          message: "New message from FedEx support agent"
        });
      } else {
        // Trigger admin notifications count increase
        io.emit("admin-notification", {
          type: "chat",
          userId: parsedUserId,
          message: "New message from a user"
        });
      }

      res.status(201).json({ success: true, messageId: result.lastID });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Admin gets index of all chats and user metadata
  app.get("/api/admin/chats", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      // Return a unique user record aggregated list that has recent messages
      const sessions = await queryAll(`
        SELECT DISTINCT u.id as userId, u.fullname, u.email,
          (SELECT COUNT(*) FROM chats c WHERE c.user_id = u.id AND c.sender_type = 'user' AND c.is_read = 0) as unreadCount,
          (SELECT message FROM chats c WHERE c.user_id = u.id ORDER BY created_at DESC LIMIT 1) as lastMessage,
          (SELECT created_at FROM chats c WHERE c.user_id = u.id ORDER BY created_at DESC LIMIT 1) as lastMessageTime
        FROM users u
        INNER JOIN chats c ON u.id = c.user_id
        ORDER BY lastMessageTime DESC
      `);
      res.json(sessions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Mark specific conversation as read
  app.put("/api/chats/:userId/read", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const activeUserId = parseInt(req.params.userId);

      // Normal user reading means marking Admin's replies as read
      // Admin reading means marking User's messages as read
      const roleInverted = req.user!.role === "admin" ? "user" : "admin";

      await queryRun(
        "UPDATE chats SET is_read = 1 WHERE user_id = ? AND sender_type = ?",
        [activeUserId, roleInverted]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // --- VITE MIDDLEWARE INTERPOLATION FOR DEV VS PROD RENDER ----
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);

    // Fallback route to serve and transform index.html for non-API requests
    app.get("*", async (req: Request, res: Response, next: NextFunction) => {
      if (req.originalUrl.startsWith("/api")) {
        return next();
      }
      try {
        const templatePath = path.resolve(process.cwd(), "index.html");
        let template = fs.readFileSync(templatePath, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (err) {
        next(err);
      }
    });

    console.log("Vite development server connected inside Express with dynamic html transformer");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Mounted client-side compiled dist directory under static compression");
  }

  // PORT bindings on port 3000
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`================================================================`);
    console.log(`FedEx Clone application live running on port: ${PORT}`);
    console.log(`URL Access Link: http://localhost:${PORT}`);
    console.log(`================================================================`);
  });
}

startServer().catch((err) => {
  console.error("FATAL ERROR BOOTING SERVER PROCESS: ", err);
});

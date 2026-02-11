import { Router } from "express";
import jwt from "jsonwebtoken";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../controller/notifications/notification-service.js";
import { addClient, removeClient } from "../controller/notifications/sse-manager.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

const notificationsRouter = Router();

// ─── SSE Stream ─────────────────────────────────────────────
// Exported separately because EventSource API can't send Authorization headers.
// Mounted in index.js before authMiddleware-protected routes.
// Accepts token via ?token=xxx query parameter.

export function sseStreamHandler(req, res) {
  // Verify JWT from query param
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ message: "Token шаардлагатай" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Token буруу" });
  }

  const userId = decoded.userId;

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send initial connection confirmation
  res.write(`event: connected\ndata: ${JSON.stringify({ userId, timestamp: new Date().toISOString() })}\n\n`);

  // Register this connection
  addClient(userId, res);

  // Send current unread count immediately on connect
  getUnreadCount(userId)
    .then((count) => {
      res.write(`event: unread-count\ndata: ${JSON.stringify({ unread_count: count })}\n\n`);
    })
    .catch(() => {});

  // Clean up on connection close
  req.on("close", () => {
    removeClient(userId, res);
  });
}

// ─── REST Endpoints ─────────────────────────────────────────
// These are protected by authMiddleware at the app.use level in index.js.

/**
 * GET /notifications
 * List all notifications for the authenticated user (paginated).
 */
notificationsRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const result = await getNotifications(req.user.userId, { page, limit });

    return res.json({
      notifications: result.notifications,
      pagination: result.pagination,
    });
  } catch (err) {
    console.error("Get notifications error:", err);
    return res.status(500).json({
      message: "Мэдэгдлүүд авахад алдаа гарлаа",
      error: String(err.message ?? err),
    });
  }
});

/**
 * GET /notifications/unread-count
 */
notificationsRouter.get("/unread-count", async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.userId);
    return res.json({ unread_count: count });
  } catch (err) {
    console.error("Unread count error:", err);
    return res.status(500).json({
      message: "Мэдэгдлийн тоо авахад алдаа гарлаа",
      error: String(err.message ?? err),
    });
  }
});

/**
 * PUT /notifications/read-all
 * Must be defined before /:id/read to avoid route conflict.
 */
notificationsRouter.put("/read-all", async (req, res) => {
  try {
    const count = await markAllAsRead(req.user.userId);
    return res.json({
      message: "Бүх мэдэгдэл уншсан гэж тэмдэглэгдлээ",
      marked_count: count,
    });
  } catch (err) {
    console.error("Mark all read error:", err);
    return res.status(500).json({
      message: "Мэдэгдэл тэмдэглэхэд алдаа гарлаа",
      error: String(err.message ?? err),
    });
  }
});

/**
 * PUT /notifications/:id/read
 */
notificationsRouter.put("/:id/read", async (req, res) => {
  const notificationId = Number(req.params.id);
  if (!notificationId) {
    return res.status(400).json({ message: "Invalid notification id" });
  }

  try {
    const updated = await markAsRead(notificationId, req.user.userId);
    if (!updated) {
      return res.status(404).json({ message: "Мэдэгдэл олдсонгүй эсвэл аль хэдийн уншсан" });
    }

    return res.json({
      message: "Мэдэгдэл уншсан гэж тэмдэглэгдлээ",
      notification_id: notificationId,
    });
  } catch (err) {
    console.error("Mark read error:", err);
    return res.status(500).json({
      message: "Мэдэгдэл тэмдэглэхэд алдаа гарлаа",
      error: String(err.message ?? err),
    });
  }
});

export default notificationsRouter;

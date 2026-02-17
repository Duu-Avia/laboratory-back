import jwt from "jsonwebtoken";
import { getUnreadCount } from "./notification-service.js";
import { addClient, removeClient } from "./sse-manager.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// SSE Stream - reads token from httpOnly cookie
export function sseStreamHandler(req, res) {
  const token = req.cookies?.token;
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

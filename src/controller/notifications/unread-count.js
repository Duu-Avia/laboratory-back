import { getUnreadCount } from "./notification-service.js";

// GET /notifications/unread-count
export async function unreadCount(req, res) {
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
}

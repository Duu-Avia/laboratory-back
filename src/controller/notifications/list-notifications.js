import { getNotifications } from "./notification-service.js";

// GET /notifications
export async function listNotifications(req, res) {
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
}

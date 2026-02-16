import { markAllAsRead } from "./notification-service.js";

// PUT /notifications/read-all
export async function readAll(req, res) {
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
}

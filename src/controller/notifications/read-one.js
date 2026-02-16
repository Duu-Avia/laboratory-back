import { markAsRead } from "./notification-service.js";

// PUT /notifications/:id/read
export async function readOne(req, res) {
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
}

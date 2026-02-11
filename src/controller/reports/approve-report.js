import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";
import { createNotification } from "../notifications/notification-service.js";
import { NOTIFICATION_TYPE } from "../../constants/index.js";

/**
 * PUT /reports/approve/:id
 * Body: { password }
 * Requires: authMiddleware + checkPermission("report:approve")
 */
export async function approveReport(req, res) {
  const reportId = Number(req.params.id);
  const { password } = req.body;

  if (!reportId) {
    return res.status(400).json({ message: "Invalid report id" });
  }
  if (!password) {
    return res.status(400).json({ message: "Нууц үг шаардлагатай" });
  }

  try {
    const pool = await getConnection();

    // 1) Verify password against the logged-in user
    const userResult = await pool.request()
      .input("userId", sql.Int, req.user.userId)
      .query(`
        SELECT id, full_name, password_hash
        FROM users
        WHERE id = @userId AND is_active = 1
      `);

    const user = userResult.recordset[0];
    if (!user) {
      return res.status(401).json({ message: "Хэрэглэгч олдсонгүй" });
    }

    // Plain text comparison (same as login - TODO: bcrypt in production)
    const isValid = user.password_hash === password;
    if (!isValid) {
      return res.status(401).json({ message: "Нууц үг буруу" });
    }

    // 2) Check report exists and is in 'tested' status
    const reportResult = await pool.request()
      .input("reportId", sql.Int, reportId)
      .query(`SELECT id, status, assigned_to, created_by FROM reports WHERE id = @reportId`);

    const report = reportResult.recordset[0];
    if (!report) {
      return res.status(404).json({ message: "Тайлан олдсонгүй" });
    }
    if (report.status !== "signed") {
      return res.status(400).json({
        message: "Зөвхөн инженер гарын үсэг зурсан тайланг батлах боломжтой",
        current_status: report.status,
      });
    }

    // 2b) Only the assigned senior (or superadmin) can approve
    if (req.user.roleName !== "superadmin" && report.assigned_to !== req.user.userId) {
      return res.status(403).json({
        message: "Зөвхөн хариуцсан ахлах инженер тайланг батлах боломжтой",
      });
    }

    // 3) Approve the report
    await pool.request()
      .input("reportId", sql.Int, reportId)
      .input("approvedBy", sql.NVarChar(100), user.full_name)
      .query(`
        UPDATE reports
        SET status = 'approved',
            approved_by = @approvedBy,
            approved_at = GETDATE(),
            updated_at = GETDATE()
        WHERE id = @reportId
      `);

    // 4) Notify the engineer who created the report
    if (report.created_by) {
      await createNotification({
        recipientId: report.created_by,
        senderId: req.user.userId,
        type: NOTIFICATION_TYPE.REPORT_APPROVED,
        message: `таны ${reportId} дугаартай сорьцын тайлан батлагдсан байна`,
        reportId: reportId,
      });
    }

    return res.json({
      message: "Тайлан амжилттай батлагдлаа",
      report_id: reportId,
      approved_by: user.full_name,
    });
  } catch (err) {
    console.error("Approve error:", err);
    return res.status(500).json({
      message: "Тайлан батлахад алдаа гарлаа",
      error: String(err.message ?? err),
    });
  }
}

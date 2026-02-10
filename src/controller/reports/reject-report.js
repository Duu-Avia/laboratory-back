import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

/**
 * PUT /reports/reject/:id
 * Body: { password, comment }
 * Senior engineer rejects a signed report with a comment.
 */
export async function rejectReport(req, res) {
  const reportId = Number(req.params.id);
  const { password, comment } = req.body;

  if (!reportId) {
    return res.status(400).json({ message: "Invalid report id" });
  }
  if (!password) {
    return res.status(400).json({ message: "Нууц үг шаардлагатай" });
  }
  if (!comment || !comment.trim()) {
    return res.status(400).json({ message: "Буцаах шалтгаан бичнэ үү" });
  }

  try {
    const pool = await getConnection();

    // 1) Verify password
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

    const isValid = user.password_hash === password;
    if (!isValid) {
      return res.status(401).json({ message: "Нууц үг буруу" });
    }

    // 2) Check report exists and is in 'signed' status
    const reportResult = await pool.request()
      .input("reportId", sql.Int, reportId)
      .query(`SELECT id, status, assigned_to FROM reports WHERE id = @reportId`);

    const report = reportResult.recordset[0];
    if (!report) {
      return res.status(404).json({ message: "Тайлан олдсонгүй" });
    }
    if (report.status !== "signed") {
      return res.status(400).json({
        message: "Зөвхөн гарын үсэг зурсан тайланг буцаах боломжтой",
        current_status: report.status,
      });
    }

    // 3) Only the assigned senior (or superadmin) can reject
    if (req.user.roleName !== "superadmin" && report.assigned_to !== req.user.userId) {
      return res.status(403).json({
        message: "Зөвхөн хариуцсан ахлах инженер тайланг буцаах боломжтой",
      });
    }

    // 4) Update status to rejected
    await pool.request()
      .input("reportId", sql.Int, reportId)
      .query(`
        UPDATE reports
        SET status = 'rejected',
            updated_at = GETDATE()
        WHERE id = @reportId
      `);

    // 5) Insert rejection comment
    await pool.request()
      .input("reportId", sql.Int, reportId)
      .input("userId", sql.Int, req.user.userId)
      .input("comment", sql.NVarChar(sql.MAX), comment.trim())
      .input("actionType", sql.VarChar(20), "rejected")
      .query(`
        INSERT INTO report_comments (report_id, user_id, comment, action_type)
        VALUES (@reportId, @userId, @comment, @actionType)
      `);

    return res.json({
      message: "Тайлан амжилттай буцаагдлаа",
      report_id: reportId,
      rejected_by: user.full_name,
    });
  } catch (err) {
    console.error("Reject error:", err);
    return res.status(500).json({
      message: "Тайлан буцаахад алдаа гарлаа",
      error: String(err.message ?? err),
    });
  }
}

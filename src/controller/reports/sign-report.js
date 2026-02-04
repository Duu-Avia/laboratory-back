import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

/**
 * PUT /reports/sign/:id
 * Body: { password }
 * Engineer signs the report after entering all test results.
 */
export async function signReport(req, res) {
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
      .query(`SELECT id, status, created_by FROM reports WHERE id = @reportId`);

    const report = reportResult.recordset[0];
    if (!report) {
      return res.status(404).json({ message: "Тайлан олдсонгүй" });
    }
    if (report.status !== "tested") {
      return res.status(400).json({
        message: "Зөвхөн шинжилгээ дууссан тайланд гарын үсэг зурах боломжтой",
        current_status: report.status,
      });
    }

    // Only the report creator can sign
    if (report.created_by !== req.user.userId) {
      return res.status(403).json({
        message: "Зөвхөн тайлан үүсгэсэн инженер гарын үсэг зурах боломжтой",
      });
    }

    // 3) Sign the report
    await pool.request()
      .input("reportId", sql.Int, reportId)
      .input("signedBy", sql.NVarChar(100), user.full_name)
      .query(`
        UPDATE reports
        SET status = 'signed',
            signed_by = @signedBy,
            signed_at = GETDATE(),
            updated_at = GETDATE()
        WHERE id = @reportId
      `);

    return res.json({
      message: "Тайланд амжилттай гарын үсэг зурлаа",
      report_id: reportId,
      signed_by: user.full_name,
    });
  } catch (err) {
    console.error("Sign error:", err);
    return res.status(500).json({
      message: "Гарын үсэг зурахад алдаа гарлаа",
      error: String(err.message ?? err),
    });
  }
}

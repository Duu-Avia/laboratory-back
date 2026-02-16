import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

export async function softDeleteReport(req, res) {
  const reportId = req.params.id;
  if (!reportId) return res.status(400).json({ message: "reportId for deletion invalid" });

  try {
    const pool = await getConnection();

    const checkStatus = await pool.request()
      .input("reportId", sql.Int, reportId)
      .query(`SELECT status, created_by FROM reports WHERE id = @reportId`);

    if (!checkStatus.recordset || checkStatus.recordset.length === 0) {
      return res.status(400).json({ message: "Report not found" });
    }

    // Only the report creator, admin, or superadmin can delete
    const reportCreatedBy = checkStatus.recordset[0].created_by;
    const { userId, roleName } = req.user;
    if (roleName !== "superadmin" && roleName !== "admin" && reportCreatedBy !== userId) {
      return res.status(403).json({ message: "Зөвхөн тайлан үүсгэсэн инженер эсвэл админ устгах боломжтой" });
    }

    await pool.request()
      .input("reportId", sql.Int, reportId)
      .query(`
        UPDATE reports
        SET status = 'deleted'
        WHERE id = @reportId
      `);

    return res.json({ message: "report deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({
      message: "Failed to delete report",
      error: String(err.message ?? err),
    });
  }
}
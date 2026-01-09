import { getConnection } from "../config/connection-db.js";

export async function getReports(req, res) {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT 
        r.id,
        r.report_title,
        r.analyst,
        r.approved_by,
        r.status,
        r.created_at,
        COUNT(rs.sample_id) as sample_count
      FROM reports r
      LEFT JOIN samples rs ON r.id = rs.report_id
      GROUP BY r.id, r.report_title, r.analyst, r.approved_by, r.status, r.created_at
      ORDER BY r.created_at DESC
    `);

    res.json(result.recordset);

  } catch (error) {
    console.log("Error getting reports:", error);
    res.status(500).json({ error: "Failed to get reports" });
  }
}
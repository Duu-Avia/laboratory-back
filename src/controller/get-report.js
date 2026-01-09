import { getConnection } from "../config/connection-db.js";

export async function getReport(req, res) {
  try {
    const { reportId } = req.params;
    const pool = await getConnection();

    const result = await pool.request()
      .input('reportId', reportId)
      .query(`
        SELECT 
          r.id,
          r.status,
          r.created_at,
          s.id as sample_id,
          s.sample_name,
          s.sample_date,
          s.sample_amount,
          s.sampled_by,
          i.indicator_name,
          i.unit,
          i.test_method,
          i.limit_value,
          tr.result_value,
          tr.is_detected
        FROM reports r
        JOIN samples s ON s.report_id = r.id
        JOIN sample_indicators si ON si.sample_id = s.id
        JOIN indicators i ON si.indicator_id = i.id
        LEFT JOIN test_results tr ON tr.sample_indicator_id = si.id
        WHERE r.id = @reportId
    
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json(result.recordset);
  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({ error: "Failed to get report" });
  }

}

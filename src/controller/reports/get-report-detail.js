import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

// GET /reports/:id
export async function getReportDetail(req, res) {
  const reportId = Number(req.params.id);
  if (!reportId) return res.status(400).json({ message: "Invalid report id" });

  try {
    const pool = await getConnection();
    const r = await pool.request()
      .input("reportId", sql.Int, reportId)
      .query(`
        SELECT
          r.id AS report_id,
          r.test_start_date,
          r.test_end_date,
          r.status AS report_status,
          r.created_by,
          r.assigned_to,
          u_assigned.full_name AS assigned_to_name,

          s.id AS sample_id,
          s.lab_type_id,
          s.sample_name,
          s.sample_amount,
          s.location,
          s.sample_date,
          s.sampled_by,
          s.status AS sample_status,

          si.id AS sample_indicator_id,
          si.status AS sample_indicator_status,

          i.id AS indicator_id,
          i.indicator_name,
          i.unit,
          i.test_method,
          i.limit_value,
          i.input_type,

          tr.id AS test_result_id,
          tr.result_value,
          tr.is_detected,
          tr.is_within_limit,
          tr.equipment_id,
          tr.notes,
          tr.measured_at
        FROM reports r
        LEFT JOIN users u_assigned ON u_assigned.id = r.assigned_to
        JOIN samples s ON s.report_id = r.id AND s.status != 'deleted'
        JOIN sample_indicators si ON si.sample_id = s.id AND si.status != 'deleted'
        JOIN indicators i ON i.id = si.indicator_id
        LEFT JOIN test_results tr ON tr.sample_indicator_id = si.id
        WHERE r.id = @reportId
        ORDER BY s.id, i.id
      `);

    const rows = r.recordset;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Report
    const first = rows[0];
    const report = {
      id: first.report_id,
      test_start_date: first.test_start_date,
      test_end_date: first.test_end_date,
      status: first.report_status,
      created_by: first.created_by,
      assigned_to: first.assigned_to,
      assigned_to_name: first.assigned_to_name,
    };

    // Group into samples -> indicators
    const sampleMap = new Map();

    for (const row of rows) {
      if (!sampleMap.has(row.sample_id)) {
        sampleMap.set(row.sample_id, {
          sample_id: row.sample_id,
          lab_type_id: row.lab_type_id,
          sample_name: row.sample_name,
          sample_amount: row.sample_amount,
          location: row.location,
          sample_date: row.sample_date,
          sampled_by: row.sampled_by,
          status: row.sample_status,
          indicators: [],
        });
      }

      const sample = sampleMap.get(row.sample_id);

      sample.indicators.push({
        sample_indicator_id: row.sample_indicator_id,
        sample_indicator_status: row.sample_indicator_status,
        indicator_id: row.indicator_id,
        indicator_name: row.indicator_name,
        unit: row.unit,
        input_type: row.input_type,
        test_method: row.test_method,
        limit_value: row.limit_value,
        result: row.test_result_id
          ? {
              test_result_id: row.test_result_id,
              result_value: row.result_value,
              is_detected: row.is_detected,
              is_within_limit: row.is_within_limit,
              equipment_id: row.equipment_id,
              notes: row.notes,
              measured_at: row.measured_at,
            }
          : null,
      });
    }

    // Fetch report comments (rejections, resubmissions)
    const commentsResult = await pool.request()
      .input("reportId2", sql.Int, reportId)
      .query(`
        SELECT
          rc.id,
          rc.comment,
          rc.action_type,
          rc.created_at,
          u.full_name AS user_name
        FROM report_comments rc
        JOIN users u ON u.id = rc.user_id
        WHERE rc.report_id = @reportId2
        ORDER BY rc.created_at DESC
      `);

    return res.json({
      report,
      samples: Array.from(sampleMap.values()),
      comments: commentsResult.recordset,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to get report detail",
      error: String(err.message ?? err),
    });
  }
}
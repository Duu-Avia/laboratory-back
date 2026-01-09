
import { getConnection } from '../config/connection-db.js';

export async function getResult(req, res) {
  try {
    const { sampleId } = req.params;
    const pool = await getConnection();

    // Get report info
    const reportResult = await pool.request()
      .input('reportId', sampleId)
      .query(`
        SELECT 
          r.id as report_id,
          r.status,
          r.created_at
        FROM reports r
        WHERE r.id = @reportId
      `);

    if (reportResult.recordset.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const report = reportResult.recordset[0];

    // Get samples for this report
    const samplesResult = await pool.request()
      .input('reportId', sampleId)
      .query(`
        SELECT 
          s.id as sample_id,
          s.sample_name,
          s.sample_date,
          s.sample_amount,
          s.sampled_by
        FROM samples s
        WHERE s.report_id = @reportId
        ORDER BY s.id
      `);

    const samples = samplesResult.recordset;

    // Get DISTINCT indicators
    const indicatorsResult = await pool.request()
      .input('reportId', sampleId)
      .query(`
        SELECT DISTINCT
          i.id as indicator_id,
          i.indicator_name,
          i.unit,
          i.test_method,
          i.limit_value
        FROM samples s
        JOIN sample_indicators si ON s.id = si.sample_id
        JOIN indicators i ON si.indicator_id = i.id
        WHERE s.report_id = @reportId
        ORDER BY i.id
      `);

    res.json({
      success: true,
      report: report,
      samples: samples,
      indicators: indicatorsResult.recordset
    });

  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({ error: "Failed to get report" });
  }
}
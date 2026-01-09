import { getConnection } from '../config/connection-db.js';

export async function getSampleIndicators(req, res) {
  try {
    const sampleId = parseInt(req.params.sampleId);
    const pool = await getConnection();
    const result = await pool.request()
      .input('sampleId', sampleId)
      .query(`
        SELECT 
          si.id as sample_indicator_id,
          si.sample_id,
          si.indicator_id,
          si.analyst,
          si.test_date,
          si.status,
          i.indicator_name,
          i.unit,
          i.test_method,
          i.limit_value,
          tr.id as result_id,
          tr.result_value,
          tr.is_detected,
          tr.is_within_limit
        FROM sample_indicators si
        JOIN indicators i ON si.indicator_id = i.id
        LEFT JOIN test_results tr ON tr.sample_indicator_id = si.id
        WHERE si.sample_id = @sampleId
      `);
    res.json(result.recordset);
  } catch (error) {
    console.log('Error getting sample indicators', error);
    res.status(500).json({ error: 'Failed to get sample indicators' });
  }
}
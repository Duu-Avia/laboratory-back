import { getConnection } from "../config/connection-db.js";

export async function getSamples(req, res) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT
      r.id as report_id,
      r.status as report_status,
      r.created_at as report_created_at,
      s.id,
      s.sample_name,
      s.sample_amount,
      s.sample_date,
      s.sampled_by,
      s.status,
      st.type_name
      FROM reports r
      JOIN samples s ON s.report_id = r.id
      JOIN sample_types st ON s.sample_type_id = st.id
      ORDER BY r.created_at DESC, s.id ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.log('Error getting samples', error);
    res.status(500).json({ error: 'Failed to get samples' });
  }
}
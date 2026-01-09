import { getConnection } from '../config/connection-db.js';

export async function getIndicatorsBySampleType(req, res) {
  try {
    const sampleTypeId = parseInt(req.params.sampleTypeId);
    const pool = await getConnection();
    const result = await pool.request()
      .input('sampleTypeId', sampleTypeId)
      .query('SELECT * FROM indicators WHERE sample_type_id = @sampleTypeId');
    res.json(result.recordset);
  } catch (error) {
    console.log('Error getting indicators', error);
    res.status(500).json({ error: 'Failed to get indicators' });
  }
}
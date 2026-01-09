import { getConnection } from '../config/connection-db.js';

export async function getSampleTypes(req, res) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM sample_types');
    res.json(result.recordset);
  } catch (error) {
    console.log('Error getting sample types', error);
    res.status(500).json({ error: 'Failed to get sample types' });
  }
}
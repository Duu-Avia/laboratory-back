import { getConnection } from '../config/connection-db.js';

export async function saveResults(req, res) {
  try {
    const { results } = req.body;
    const pool = await getConnection();
    console.log(req.body)
    let sampleId = null;

    for (const result of results) {
      // Update sample_indicator
      await pool.request()
        .input('sample_indicator_id', result.sample_indicator_id)
        .input('analyst', result.analyst)
        .query(`
          UPDATE sample_indicators 
          SET analyst = @analyst, 
              status = 'completed',
              test_date = GETDATE(),
              updated_at = GETDATE()
          WHERE id = @sample_indicator_id
        `);

      // Get sample_id from sample_indicator
      const sampleResult = await pool.request()
        .input('sample_indicator_id', result.sample_indicator_id)
        .query(`
          SELECT sample_id FROM sample_indicators WHERE id = @sample_indicator_id
        `);
      
      if (sampleResult.recordset.length > 0) {
        sampleId = sampleResult.recordset[0].sample_id;
      }

      // Insert or update test_result
      const existingResult = await pool.request()
        .input('sample_indicator_id', result.sample_indicator_id)
        .query(`
          SELECT id FROM test_results WHERE sample_indicator_id = @sample_indicator_id
        `);

      if (existingResult.recordset.length > 0) {
        // Update existing
        await pool.request()
          .input('sample_indicator_id', result.sample_indicator_id)
          .input('result_value', result.result_value)
          .input('is_detected', result.is_detected ? 1 : 0)
          .query(`
            UPDATE test_results 
            SET result_value = @result_value,
                is_detected = @is_detected,
                updated_at = GETDATE()
            WHERE sample_indicator_id = @sample_indicator_id
          `);
      } else {
        // Insert new
        await pool.request()
          .input('sample_indicator_id', result.sample_indicator_id)
          .input('result_value', result.result_value)
          .input('is_detected', result.is_detected ? 1 : 0)
          .query(`
            INSERT INTO test_results (sample_indicator_id, result_value, is_detected, measured_at)
            VALUES (@sample_indicator_id, @result_value, @is_detected, GETDATE())
          `);
      }
    }

    // Update sample status to 'completed'
    if (sampleId) {
      await pool.request()
        .input('sample_id', sampleId)
        .query(`
          UPDATE samples 
          SET status = 'completed', updated_at = GETDATE()
          WHERE id = @sample_id
        `);
      console.log("✅ Sample status updated to completed:", sampleId);
    }

    res.json({ success: true });
  } catch (error) {
    console.log('Error saving results', error);
    res.status(500).json({ success: false, error: 'Failed to save results' });
  }
}
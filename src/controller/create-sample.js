import { getConnection } from "../config/connection-db.js";

export async function createSample(req, res) {
  try {
    const { 
      sample_type_id, 
      sample_names,      // Олон сорьцын нэрс ["645 ус", "646 ус", "647 ус"]
      sample_amount, 
      sample_date, 
      sampled_by, 
      indicator_ids
    } = req.body;
    console.log(req.body);
    const pool = await getConnection();

    // 1. Report үүсгэх
    const reportResult = await pool.request()
      .input('status', 'draft')
      .query(`
        INSERT INTO reports (status)
        OUTPUT INSERTED.id
        VALUES (@status)
      `);

    const reportId = reportResult.recordset[0].id;

    // 2. Sample бүрийг үүсгэх
    for (let i = 0; i < sample_names.length; i++) {
      const sampleResult = await pool.request()
        .input('sample_type_id', sample_type_id)
        .input('sample_name', sample_names[i])
        .input('sample_amount', sample_amount)
        .input('sample_date', sample_date)
        .input('sampled_by', sampled_by || null)
        .input('report_id', reportId)
        .input('status', 'pending')
        .query(`
          INSERT INTO samples (sample_type_id, sample_name, sample_amount, sample_date, sampled_by, report_id, status)
          OUTPUT INSERTED.id
          VALUES (@sample_type_id, @sample_name, @sample_amount, @sample_date, @sampled_by, @report_id, @status)
        `);

      const sampleId = sampleResult.recordset[0].id;

      // 3. Sample indicators үүсгэх
      for (let j = 0; j < indicator_ids.length; j++) {
        await pool.request()
          .input('sample_id', sampleId)
          .input('indicator_id', indicator_ids[j])
          .input('status', 'pending')
          .query(`
            INSERT INTO sample_indicators (sample_id, indicator_id, status)
            VALUES (@sample_id, @indicator_id, @status)
          `);
      }
    }

    res.json({ success: true, reportId, sampleCount: sample_names.length });

  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({ error: "Failed to create samples" });
  }
}
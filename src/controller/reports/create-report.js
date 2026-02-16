import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

export async function createReportWithSamples(req, res) {
  const { test_start_date, samples } = req.body;

  if (!Array.isArray(samples) || samples.length === 0) {
    return res.status(400).json({ message: "samples is required and must be a non-empty array" });
  }

  let pool;
  const tx = new sql.Transaction();

  try {
    pool = await getConnection();
    tx.connection = pool;
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    //  create report
    const reportReq = new sql.Request(tx);
    const reportInsert = await reportReq
      .input("test_start_date", sql.Date, test_start_date ?? null)
      .input("created_by", sql.Int, req.user.userId)
      .query(`
        INSERT INTO reports (test_start_date, created_by, status)
        OUTPUT INSERTED.id
        VALUES (@test_start_date, @created_by, 'draft')
      `);

    const reportId = reportInsert.recordset[0].id;

    //  insert samples + indicators
    const createdSamples = [];

    for (const s of samples) {
      if (!s.lab_type_id || !s.sample_name) {
        throw new Error("Each sample must include lab_type_id and sample_name");
      }
      if (!Array.isArray(s.indicators) || s.indicators.length === 0) {
        throw new Error(`Sample "${s.sample_name}" must include indicators array`);
      }

      // Insert sample
      const sampleReq = new sql.Request(tx);
      const sampleInsert = await sampleReq
        .input("report_id", sql.Int, reportId)
        .input("lab_type_id", sql.Int, s.lab_type_id)
        .input("sample_name", sql.NVarChar(300), s.sample_name)
        .input("sample_amount", sql.VarChar(50), s.sample_amount ?? null)
        .input("location", sql.NVarChar(200), s.location ?? null)
        .input("sample_date", sql.Date, s.sample_date ?? null)
        .input("sampled_by", sql.NVarChar(100), s.sampled_by ?? null)
        .query(`
          INSERT INTO samples (report_id, lab_type_id, sample_name, sample_amount, location, sample_date, sampled_by)
          OUTPUT INSERTED.id
          VALUES (@report_id, @lab_type_id, @sample_name, @sample_amount, @location, @sample_date, @sampled_by)
        `);

      const sampleId = sampleInsert.recordset[0].id;

      // Insert sample_indicators
      for (const indicatorId of s.indicators) {
        const siReq = new sql.Request(tx);
        await siReq
          .input("sample_id", sql.Int, sampleId)
          .input("indicator_id", sql.Int, indicatorId)
          .query(`
            INSERT INTO sample_indicators (sample_id, indicator_id)
            VALUES (@sample_id, @indicator_id)
          `);
      }

      createdSamples.push({ sample_id: sampleId, sample_name: s.sample_name });
    }

    // Update report status ONCE
    await new sql.Request(tx)
      .input("reportId", sql.Int, reportId)
      .query(`
        UPDATE reports
        SET status = 'pending_samples',
            updated_at = GETDATE()
        WHERE id = @reportId
      `);

    await tx.commit();

    return res.status(201).json({
      message: "Report created",
      report_id: reportId,
      samples: createdSamples,
    });
  } catch (err) {
    try { await tx.rollback(); } catch {}
    return res.status(500).json({ message: "Failed to create report", error: String(err.message ?? err) });
  }
}

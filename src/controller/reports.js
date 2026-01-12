import sql from "mssql";
import { getConnection } from "../config/connection-db.js"; // adjust path if needed


export async function createReportWithSamples(req, res) {
  const { report_title, test_start_date, test_end_date, approved_by, analyst, samples } = req.body;

  if (!Array.isArray(samples) || samples.length === 0) {
    return res.status(400).json({ message: "samples is required and must be a non-empty array" });
  }

  let pool;
  const tx = new sql.Transaction();

  try {
    pool = await getConnection();
    tx.connection = pool;
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    // 1) create report
    const reportReq = new sql.Request(tx);
    const reportInsert = await reportReq
      .input("report_title", sql.NVarChar(200), report_title ?? null)
      .input("test_start_date", sql.Date, test_start_date ?? null)
      .input("test_end_date", sql.Date, test_end_date ?? null)
      .input("approved_by", sql.NVarChar(100), approved_by ?? null)
      .input("analyst", sql.NVarChar(100), analyst ?? null)
      .query(`
        INSERT INTO reports (report_title, test_start_date, test_end_date, approved_by, analyst, status)
        OUTPUT INSERTED.id
        VALUES (@report_title, @test_start_date, @test_end_date, @approved_by, @analyst, 'draft')
      `);

    const reportId = reportInsert.recordset[0].id;

    // 2) insert samples + indicators
    const createdSamples = [];

    for (const s of samples) {
      if (!s.sample_type_id || !s.sample_name) {
        throw new Error("Each sample must include sample_type_id and sample_name");
      }
      if (!Array.isArray(s.indicators) || s.indicators.length === 0) {
        throw new Error(`Sample "${s.sample_name}" must include indicators array`);
      }

      // Insert sample
      const sampleReq = new sql.Request(tx);
      const sampleInsert = await sampleReq
        .input("report_id", sql.Int, reportId)
        .input("sample_type_id", sql.Int, s.sample_type_id)
        .input("sample_name", sql.NVarChar(300), s.sample_name)
        .input("sample_amount", sql.VarChar(50), s.sample_amount ?? null)
        .input("location", sql.NVarChar(200), s.location ?? null)
        .input("sample_date", sql.Date, s.sample_date ?? null)
        .input("sampled_by", sql.NVarChar(100), s.sampled_by ?? null)
        .query(`
          INSERT INTO samples (report_id, sample_type_id, sample_name, sample_amount, location, sample_date, sampled_by, status)
          OUTPUT INSERTED.id
          VALUES (@report_id, @sample_type_id, @sample_name, @sample_amount, @location, @sample_date, @sampled_by, 'pending')
        `);

      const sampleId = sampleInsert.recordset[0].id;

      // Insert sample_indicators
      for (const indicatorId of s.indicators) {
        const siReq = new sql.Request(tx);
        await siReq
          .input("sample_id", sql.Int, sampleId)
          .input("indicator_id", sql.Int, indicatorId)
          .input("analyst", sql.NVarChar(100), analyst ?? null)
          .query(`
            INSERT INTO sample_indicators (sample_id, indicator_id, analyst, status)
            VALUES (@sample_id, @indicator_id, @analyst, 'pending')
          `);
      }

      createdSamples.push({ sample_id: sampleId, sample_name: s.sample_name });
    }

    // ✅ Update report status ONCE (no @reportId bug)
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


// GET /reports?from=YYYY-MM-DD&to=YYYY-MM-DD&status=draft
export async function listReports(req, res) {
  const { from, to, status } = req.query;

  try {
    const pool = await getConnection();
    const r = await pool.request()
      .input("from", sql.Date, from ?? null)
      .input("to", sql.Date, to ?? null)
      .input("status", sql.VarChar(50), status ?? null)
      .query(`
        SELECT
          r.id,
          r.report_title,
          r.test_start_date,
          r.test_end_date,
          r.analyst,
          r.status,
          r.created_at,
          COUNT(DISTINCT s.id) AS sample_count,
          STUFF((
            SELECT ', ' + s2.sample_name
            FROM samples s2
            WHERE s2.report_id = r.id
            FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS sample_names
        FROM reports r
        LEFT JOIN samples s ON s.report_id = r.id
        WHERE
          (@status IS NULL OR r.status = @status)
          AND (@from IS NULL OR r.test_start_date >= @from)
          AND (@to IS NULL OR r.test_end_date <= @to)
        GROUP BY r.id, r.report_title, r.test_start_date, r.test_end_date, r.analyst, r.status, r.created_at
        ORDER BY r.created_at ASC
      `);

    res.json(r.recordset);
  } catch (err) {
    res.status(500).json({ message: "Failed to list reports", error: String(err.message ?? err) });
  }
}

// GET /reports/:id  (flat rows; frontend groups by sample)
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
          r.report_title,
          r.test_start_date,
          r.test_end_date,
          r.approved_by,
          r.analyst,
          r.status,

          s.id AS sample_id,
          s.sample_type_id,
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

          tr.id AS test_result_id,
          tr.result_value,
          tr.is_detected,
          tr.is_within_limit,
          tr.equipment_id,
          tr.notes,
          tr.measured_at
        FROM reports r
        JOIN samples s ON s.report_id = r.id
        JOIN sample_indicators si ON si.sample_id = s.id
        JOIN indicators i ON i.id = si.indicator_id
        LEFT JOIN test_results tr ON tr.sample_indicator_id = si.id
        WHERE r.id = @reportId
        ORDER BY s.id, i.id
      `);

    res.json({ report_id: reportId, rows: r.recordset });
  } catch (err) {
    res.status(500).json({ message: "Failed to get report detail", error: String(err.message ?? err) });
  }
}

// PUT /reports/:id/results
// Body example:
// {
//   "results": [
//     { "sample_indicator_id": 10, "result_value": "7.1", "is_detected": true, "is_within_limit": true, "notes": "", "measured_at": "2026-01-10T12:00:00" },
//     { "sample_indicator_id": 11, "result_value": "0.02", "is_detected": true, "is_within_limit": false }
//   ]
// }
export async function saveReportResultsBulk(req, res) {
  const reportId = Number(req.params.id);
  const { results } = req.body;

  if (!reportId) return res.status(400).json({ message: "Invalid report id" });
  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ message: "results must be a non-empty array" });
  }

  let pool;
  const tx = new sql.Transaction();

  try {
    pool = await getConnection();
    tx.connection = pool;
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    // Validate ids
    const ids = results.map((r) => Number(r.sample_indicator_id)).filter(Boolean);
    if (ids.length !== results.length) throw new Error("Invalid sample_indicator_id in results");

    for (const item of results) {
      const reqTx = new sql.Request(tx);

      await reqTx
        .input("reportId", sql.Int, reportId)
        .input("sample_indicator_id", sql.Int, Number(item.sample_indicator_id))
        .input("result_value", sql.VarChar(100), item.result_value ?? null)
        .input("is_detected", sql.Bit, item.is_detected ?? null)
        .input("is_within_limit", sql.Bit, item.is_within_limit ?? null)
        .input("equipment_id", sql.NVarChar(100), item.equipment_id ?? null)
        .input("notes", sql.NVarChar(sql.MAX), item.notes ?? null)
        .input("measured_at", sql.DateTime, item.measured_at ? new Date(item.measured_at) : null)
        .query(`
          -- Verify belongs to report
          IF NOT EXISTS (
            SELECT 1
            FROM sample_indicators si
            JOIN samples s ON s.id = si.sample_id
            WHERE si.id = @sample_indicator_id AND s.report_id = @reportId
          )
          BEGIN
            RAISERROR('sample_indicator_id does not belong to this report', 16, 1);
            RETURN;
          END

          -- Upsert result
          IF EXISTS (SELECT 1 FROM test_results WHERE sample_indicator_id = @sample_indicator_id)
          BEGIN
            UPDATE test_results
              SET result_value = @result_value,
                  is_detected = @is_detected,
                  is_within_limit = @is_within_limit,
                  equipment_id = @equipment_id,
                  notes = @notes,
                  measured_at = @measured_at,
                  updated_at = GETDATE()
            WHERE sample_indicator_id = @sample_indicator_id;
          END
          ELSE
          BEGIN
            INSERT INTO test_results
              (sample_indicator_id, result_value, is_detected, is_within_limit, equipment_id, notes, measured_at, created_at, updated_at)
            VALUES
              (@sample_indicator_id, @result_value, @is_detected, @is_within_limit, @equipment_id, @notes, @measured_at, GETDATE(), GETDATE());
          END
        `);
    }
    // AFTER saving all test_results, update report status (better rule)
  await new sql.Request(tx)
  .input("reportId", sql.Int, reportId)
  .query(`
    -- If any indicator under this report has NO result yet → still pending
    IF EXISTS (
      SELECT 1
      FROM sample_indicators si
      JOIN samples s ON s.id = si.sample_id
      LEFT JOIN test_results tr ON tr.sample_indicator_id = si.id
      WHERE s.report_id = @reportId
        AND tr.id IS NULL
    )
    BEGIN
      UPDATE reports
        SET status = 'pending_samples',
            updated_at = GETDATE()
      WHERE id = @reportId;
    END
    ELSE
    BEGIN
      UPDATE reports
        SET status = 'tested',
            updated_at = GETDATE()
      WHERE id = @reportId;
    END
  `);


    await tx.commit();
    return res.json({ code: 201, message: "success" });
  } catch (err) {
    try {
      if (tx._aborted !== true) await tx.rollback(); // safe-ish; or just try/catch rollback
    } catch {}

    return res.status(500).json({
      message: "Failed to save results",
      error: String(err?.message ?? err),
    });
  }
}


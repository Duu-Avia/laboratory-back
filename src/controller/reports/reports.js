import sql from "mssql";
import { getConnection } from "../../config/connection-db.js"; 


export async function createReportWithSamples(req, res) {
  const {  test_start_date, test_end_date, approved_by, analyst, samples, status } = req.body;

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
      .input("approved_by", sql.NVarChar(100), approved_by ?? null)
      .input("analyst", sql.NVarChar(100), analyst ?? null)
      .input("created_by", sql.Int, req.user.userId)
      .query(`
        INSERT INTO reports ( test_start_date, approved_by, analyst, created_by, status)
        OUTPUT INSERTED.id
        VALUES (@test_start_date, @approved_by, @analyst, @created_by, 'draft')
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
          .input("analyst", sql.NVarChar(100), analyst ?? null)
          .query(`
            INSERT INTO sample_indicators (sample_id, indicator_id, analyst)
            VALUES (@sample_id, @indicator_id, @analyst)
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


// GET /reports
export async function listReports(req, res) {
  const { from, to, status } = req.query;
  const { userId, roleName } = req.user;

  try {
    const pool = await getConnection();
    const r = await pool.request()
      .input("from", sql.Date, from ?? null)
      .input("to", sql.Date, to ?? null)
      .input("status", sql.VarChar(50), status ?? null)
      .input("userId", sql.Int, userId)
      .input("roleName", sql.VarChar(50), roleName)
      .query(`
        SELECT
          r.id,
          r.test_start_date,
          r.test_end_date,
          r.analyst,
          r.status,
          r.created_at,
          r.created_by,
          u_creator.full_name AS created_by_name,
          r.assigned_to,
          u_assigned.full_name AS assigned_to_name,
          lt.type_name AS lab_type,

          -- sample names aggregation
          STUFF((
            SELECT DISTINCT ', ' + s2.sample_name
            FROM samples s2
            WHERE s2.report_id = r.id
              AND s2.status != 'deleted'
              AND s2.sample_name IS NOT NULL
            FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS sample_names,

          -- indicator names aggregation
          STUFF((
            SELECT DISTINCT ', ' + i2.indicator_name
            FROM samples s3
            JOIN sample_indicators si2 ON si2.sample_id = s3.id
            JOIN indicators i2 ON i2.id = si2.indicator_id
            WHERE s3.report_id = r.id
              AND s3.status != 'deleted'
              AND si2.status != 'deleted'
              AND i2.indicator_name IS NOT NULL
            FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS indicator_names,

          -- sample count
          (
            SELECT COUNT(*)
            FROM (
              SELECT DISTINCT s4.sample_name
              FROM samples s4
              WHERE s4.report_id = r.id
                AND s4.status != 'deleted'
                AND s4.sample_name IS NOT NULL
            ) x
          ) AS sample_count

        FROM reports r
        LEFT JOIN samples s
          ON s.report_id = r.id
          AND s.status != 'deleted'
        LEFT JOIN lab_types lt
          ON lt.id = s.lab_type_id
        LEFT JOIN users u_assigned
          ON u_assigned.id = r.assigned_to
        LEFT JOIN users u_creator
          ON u_creator.id = r.created_by

        WHERE
          r.status NOT IN('deleted', 'approved')
          AND (@status IS NULL OR r.status = @status)
          AND (@from IS NULL OR r.test_start_date >= @from)
          AND (@to IS NULL OR r.test_end_date <= @to)

          -- Lab-type access control
          AND (
            @roleName = 'superadmin'
            OR (
              @roleName = 'admin' AND (
                r.assigned_to = @userId
                OR EXISTS (
                  SELECT 1 FROM samples sc
                  JOIN user_lab_types ult ON ult.lab_type_id = sc.lab_type_id
                  WHERE sc.report_id = r.id AND sc.status != 'deleted' AND ult.user_id = @userId
                )
              )
            )
            OR (
              @roleName NOT IN ('superadmin', 'admin') AND EXISTS (
                SELECT 1 FROM samples sc
                JOIN user_lab_types ult ON ult.lab_type_id = sc.lab_type_id
                WHERE sc.report_id = r.id AND sc.status != 'deleted' AND ult.user_id = @userId
              )
            )
          )

        GROUP BY
          r.id,  r.test_start_date, r.test_end_date,
          r.analyst, r.status, r.created_at, r.created_by, u_creator.full_name,
          r.assigned_to, u_assigned.full_name, lt.type_name

        ORDER BY r.created_at DESC;
      `);

    res.json(r.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list reports", error: String(err?.message ?? err) });
  }
}


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
          r.approved_by,
          r.analyst,
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
      approved_by: first.approved_by,
      analyst: first.analyst,
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
        input_type:row.input_type,
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
            test_end_date = CAST(GETDATE() AS date),
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
// delete heseg shvv
export async function sofDeleteReport(req, res) {
  const reportId = req.params.id
  if(!reportId) return res.status(400).json({message:"reportId for deletion invalid"});
  try{
    const pool = await getConnection();

    const checkStatus = await pool.request()
    .input("reportId", sql.Int, reportId)
    .query(`SELECT status, created_by FROM reports WHERE id = @reportId`)

    if (!checkStatus.recordset || checkStatus.recordset.length === 0){
      return res.status(400).json({message:'Report not found'})
    }

    // Only the report creator, admin, or superadmin can delete
    const reportCreatedBy = checkStatus.recordset[0].created_by;
    const { userId, roleName } = req.user;
    if (roleName !== "superadmin" && roleName !== "admin" && reportCreatedBy !== userId) {
      return res.status(403).json({ message: "Зөвхөн тайлан үүсгэсэн инженер эсвэл админ устгах боломжтой" });
    }

    await pool.request()
    .input("reportId", sql.Int, reportId)
    .query(`
      UPDATE reports
      SET status = 'deleted'
      WHERE id = @reportId`);

    return res.json({message:'report deleted successfully'})

  }catch (err) {
    console.error("Delete error:", err); // ADD THIS LINE
    return res.status(500).json({ 
      message: "Failed to delete report", 
      error: String(err.message ?? err) // ADD ERROR DETAILS
    });
  }
}

export async function updateReport(req, res) {
  const reportId = Number(req.params.id);
  const { samples } = req.body;

  console.log("=== UPDATE REPORT ===");
  console.log("reportId:", reportId);
  console.log("samples received:", samples.map(s => ({ sample_id: s.sample_id, sample_name: s.sample_name, indicators: s.indicators?.length })));

  if (!reportId) return res.status(400).json({ message: "Invalid reportId" });
  if (!Array.isArray(samples)) return res.status(400).json({ message: "samples must be array" });

  const pool = await getConnection();
  const tx = new sql.Transaction(pool);

  try {
    // Check report exists and not approved
    const check = await pool.request()
      .input("reportId", sql.Int, reportId)
      .query(`SELECT status, created_by FROM reports WHERE id = @reportId`);

    const currentStatus = check.recordset?.[0]?.status;
    const createdBy = check.recordset?.[0]?.created_by;
    if (!currentStatus) return res.status(404).json({ message: "Report not found" });
    if (currentStatus === "approved") return res.status(400).json({ message: "Cannot edit approved report" });

    // Only the report creator, admin, or superadmin can edit
    if (req.user.roleName !== "superadmin" && req.user.roleName !== "admin" && createdBy !== req.user.userId) {
      return res.status(403).json({ message: "Зөвхөн тайлан үүсгэсэн инженер эсвэл админ засварлах боломжтой" });
    }

    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    // 2) Soft-delete samples that were removed from the list
    const existingSamples = await new sql.Request(tx)
      .input("reportId", sql.Int, reportId)
      .query(`SELECT id FROM samples WHERE report_id = @reportId AND status != 'deleted'`);

    const existingIds = existingSamples.recordset.map((r) => Number(r.id));
    const incomingIds = samples.map((s) => s.sample_id).filter((id) => id != null).map(id => Number(id));
    
    console.log("existingIds in DB:", existingIds);
    console.log("incomingIds from frontend:", incomingIds);
    
    const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));
    
    console.log("sample idsToDelete:", idsToDelete);

    for (const id of idsToDelete) {
      console.log("Soft-deleting sample id:", id);
      await new sql.Request(tx)
        .input("sampleId", sql.Int, id)
        .query(`UPDATE samples SET status = 'deleted' WHERE id = @sampleId`);
    }

    // 3) Process each sample (update existing or insert new)
    for (const s of samples) {
      if (!s.lab_type_id || !s.sample_name) {
        throw new Error("Each sample must have lab_type_id and sample_name");
      }

      let sampleId = s.sample_id;

      // INSERT new sample if no sample_id
      if (!sampleId) {
        const inserted = await new sql.Request(tx)
          .input("reportId", sql.Int, reportId)
          .input("lab_type_id", sql.Int, s.lab_type_id)
          .input("sample_name", sql.NVarChar(200), s.sample_name)
          .input("sample_date", sql.Date, s.sample_date || null)
          .input("location", sql.NVarChar(200), s.location ?? "")
          .input("sampled_by", sql.NVarChar(100), s.sampled_by ?? "")
          .query(`
            INSERT INTO samples(report_id, lab_type_id, sample_name, sample_date, location, sampled_by, status)
            OUTPUT INSERTED.id
            VALUES (@reportId, @lab_type_id, @sample_name, @sample_date, @location, @sampled_by, 'pending')
          `);
        sampleId = inserted.recordset[0].id;
        console.log("Inserted new sample with id:", sampleId);
      } else {
        // UPDATE existing sample
        console.log("Updating sample id:", sampleId);
        await new sql.Request(tx)
          .input("reportId", sql.Int, reportId)
          .input("sampleId", sql.Int, sampleId)
          .input("lab_type_id", sql.Int, s.lab_type_id)
          .input("sample_name", sql.NVarChar(200), s.sample_name)
          .input("sample_date", sql.Date, s.sample_date || null)
          .input("sample_amount", sql.NVarChar(100), s.sample_amount)
          .input("location", sql.NVarChar(200), s.location ?? "")
          .input("sampled_by", sql.NVarChar(100), s.sampled_by ?? "")
          .query(`
            UPDATE samples
            SET lab_type_id = @lab_type_id,
                sample_name = @sample_name,
                sample_amount = @sample_amount,
                sample_date = @sample_date,
                location = @location,
                sampled_by = @sampled_by,
                status = 'edited_and_pending'
            WHERE id = @sampleId AND report_id = @reportId
          `);
      }

      // 4) Soft-delete indicators that were removed
      const incomingIndicatorIds = (s.indicators ?? [])
        .map(ind => typeof ind === "number" ? ind : ind?.indicator_id)
        .filter(id => id != null)
        .map(id => Number(id));

      const existingIndicators = await new sql.Request(tx)
        .input("sampleId", sql.Int, sampleId)
        .query(`
          SELECT id, indicator_id 
          FROM sample_indicators 
          WHERE sample_id = @sampleId AND status != 'deleted'
        `);

      const existingIndicatorIds = existingIndicators.recordset.map(r => Number(r.indicator_id));
      const indicatorIdsToDelete = existingIndicatorIds.filter(id => !incomingIndicatorIds.includes(id));

      console.log(`Sample ${sampleId} - existing indicators:`, existingIndicatorIds);
      console.log(`Sample ${sampleId} - incoming indicators:`, incomingIndicatorIds);
      console.log(`Sample ${sampleId} - indicators to delete:`, indicatorIdsToDelete);

      for (const indicatorId of indicatorIdsToDelete) {
        await new sql.Request(tx)
          .input("sampleId", sql.Int, sampleId)
          .input("indicatorId", sql.Int, indicatorId)
          .query(`
            UPDATE sample_indicators 
            SET status = 'deleted' 
            WHERE sample_id = @sampleId AND indicator_id = @indicatorId
          `);
        console.log(`Soft-deleted indicator ${indicatorId} for sample ${sampleId}`);
      }

      // 5) Process indicators for this sample (add new ones)
      if (!Array.isArray(s.indicators)) continue;

      for (const ind of s.indicators) {
        const indicatorId = typeof ind === "number" ? ind : ind?.indicator_id;
        if (!indicatorId) continue;

        let sampleIndicatorId = ind?.sample_indicator_id ?? null;

        if (!sampleIndicatorId) {
          const existing = await new sql.Request(tx)
            .input("sampleId", sql.Int, sampleId)
            .input("indicatorId", sql.Int, indicatorId)
            .query(`
              SELECT TOP 1 id, status FROM sample_indicators
              WHERE sample_id = @sampleId AND indicator_id = @indicatorId
            `);
          
          if (existing.recordset?.[0]) {
            sampleIndicatorId = existing.recordset[0].id;
            // If it was deleted, restore it
            if (existing.recordset[0].status === 'deleted') {
              await new sql.Request(tx)
                .input("id", sql.Int, sampleIndicatorId)
                .query(`UPDATE sample_indicators SET status = 'pending' WHERE id = @id`);
              console.log(`Restored indicator ${indicatorId} for sample ${sampleId}`);
            }
          }
        }

        if (!sampleIndicatorId) {
          const inserted = await new sql.Request(tx)
            .input("sampleId", sql.Int, sampleId)
            .input("indicatorId", sql.Int, indicatorId)
            .query(`
              INSERT INTO sample_indicators(sample_id, indicator_id, status)
              OUTPUT INSERTED.id
              VALUES (@sampleId, @indicatorId, 'pending')
            `);
          sampleIndicatorId = inserted.recordset[0].id;
          console.log(`Inserted new indicator ${indicatorId} for sample ${sampleId}`);
        }

        // 6) Process test result if provided
        const r = ind.result;
        if (!r) continue;

        if (r.test_result_id) {
          await new sql.Request(tx)
            .input("testResultId", sql.Int, r.test_result_id)
            .input("sampleIndicatorId", sql.Int, sampleIndicatorId)
            .input("result_value", sql.NVarChar(200), r.result_value ?? null)
            .input("is_detected", sql.Bit, r.is_detected ?? null)
            .input("is_within_limit", sql.Bit, r.is_within_limit ?? null)
            .input("equipment_id", sql.Int, r.equipment_id ?? null)
            .input("notes", sql.NVarChar(sql.MAX), r.notes ?? null)
            .query(`
              UPDATE test_results
              SET result_value = @result_value,
                  is_detected = @is_detected,
                  is_within_limit = @is_within_limit,
                  equipment_id = @equipment_id,
                  notes = @notes,
                  measured_at = COALESCE(measured_at, GETDATE())
              WHERE id = @testResultId AND sample_indicator_id = @sampleIndicatorId
            `);
        } else {
          const existsRes = await new sql.Request(tx)
            .input("sampleIndicatorId", sql.Int, sampleIndicatorId)
            .query(`SELECT TOP 1 id FROM test_results WHERE sample_indicator_id = @sampleIndicatorId`);

          if (!existsRes.recordset?.[0]?.id) {
            await new sql.Request(tx)
              .input("sampleIndicatorId", sql.Int, sampleIndicatorId)
              .input("result_value", sql.NVarChar(200), r.result_value ?? null)
              .input("is_detected", sql.Bit, r.is_detected ?? null)
              .input("is_within_limit", sql.Bit, r.is_within_limit ?? null)
              .input("equipment_id", sql.Int, r.equipment_id ?? null)
              .input("notes", sql.NVarChar(sql.MAX), r.notes ?? null)
              .query(`
                INSERT INTO test_results(sample_indicator_id, result_value, is_detected, is_within_limit, equipment_id, notes, measured_at)
                VALUES (@sampleIndicatorId, @result_value, @is_detected, @is_within_limit, @equipment_id, @notes, GETDATE())
              `);
          }
        }
      }
    }

    await tx.commit();
    console.log("=== UPDATE COMPLETE ===");
    return res.json({ message: "Report updated successfully" });
  } catch (err) {
    console.error("Update error:", err);
    try { await tx.rollback(); } catch {}
    return res.status(500).json({ message: "Failed to update report", error: String(err.message ?? err) });
  }
}



export async function archiveReport(req, res) {
  const { mode } = req.query;

  try {
    const pool = await getConnection();
    const userId = req.user.userId;
    const roleName = req.user.roleName;

    const response = await pool.request()
      .input("mode", sql.VarChar(20), mode ?? null)
      .input("userId", sql.Int, userId)
      .input("roleName", sql.VarChar(50), roleName)
      .query(`
        SELECT
          r.id,
          r.approved_by,
          r.analyst,
          r.status,
          r.created_at,
          r.updated_at,
          r.test_start_date,
          r.test_end_date,
          lt.type_name AS lab_type,

          -- sample names aggregation
          STUFF((
            SELECT DISTINCT ', ' + s2.sample_name
            FROM samples s2
            WHERE s2.report_id = r.id
              AND s2.sample_name IS NOT NULL
            FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS sample_names,

          -- indicator names aggregation
          STUFF((
            SELECT DISTINCT ', ' + i2.indicator_name
            FROM samples s3
            JOIN sample_indicators si2 ON si2.sample_id = s3.id
            JOIN indicators i2 ON i2.id = si2.indicator_id
            WHERE s3.report_id = r.id
              AND i2.indicator_name IS NOT NULL
            FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS indicator_names,

          -- sample count
          (
            SELECT COUNT(*)
            FROM (
              SELECT DISTINCT s4.sample_name
              FROM samples s4
              WHERE s4.report_id = r.id
                AND s4.sample_name IS NOT NULL
            ) x
          ) AS sample_count

        FROM reports r
        LEFT JOIN samples s
          ON s.report_id = r.id
        LEFT JOIN lab_types lt
          ON lt.id = s.lab_type_id

        WHERE
          (
            (@mode IS NULL AND r.status = 'approved')
            OR r.status = @mode
          )
          AND (
            -- Archive (approved) → everyone can see
            (@mode IS NULL OR @mode = 'approved')
            OR
            -- Approve requests (signed) → only assigned senior or superadmin
            (
              @roleName = 'superadmin'
              OR r.assigned_to = @userId
            )
          )

        GROUP BY
          r.id, r.approved_by, r.analyst, r.status,
          r.created_at, r.updated_at, r.test_start_date, r.test_end_date,
          lt.type_name

        ORDER BY r.created_at DESC;
      `);

    res.json(response.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to load archive reports",
      error: String(err?.message ?? err)
    });
  }
}






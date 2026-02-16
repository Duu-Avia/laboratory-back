import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

export async function updateReport(req, res) {
  const reportId = Number(req.params.id);
  const { samples } = req.body;

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

    const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));

    for (const id of idsToDelete) {
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
      } else {
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

      for (const indicatorId of indicatorIdsToDelete) {
        await new sql.Request(tx)
          .input("sampleId", sql.Int, sampleId)
          .input("indicatorId", sql.Int, indicatorId)
          .query(`
            UPDATE sample_indicators
            SET status = 'deleted'
            WHERE sample_id = @sampleId AND indicator_id = @indicatorId
          `);
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

    // If report was "tested", check if all results still exist
    if (currentStatus === "tested") {
      const missingResults = await new sql.Request(tx)
        .input("reportId", sql.Int, reportId)
        .query(`
          SELECT COUNT(*) AS missing
          FROM sample_indicators si
          JOIN samples s ON s.id = si.sample_id
          LEFT JOIN test_results tr ON tr.sample_indicator_id = si.id
          WHERE s.report_id = @reportId
            AND s.status != 'deleted'
            AND si.status != 'deleted'
            AND (tr.id IS NULL OR (tr.result_value IS NULL AND tr.is_detected IS NULL))
        `);

      if (missingResults.recordset[0].missing > 0) {
        await new sql.Request(tx)
          .input("reportId", sql.Int, reportId)
          .query(`
            UPDATE reports
            SET status = 'incomplete', updated_at = GETDATE()
            WHERE id = @reportId
          `);
      }
    }

    await tx.commit();
    return res.json({ message: "Report updated successfully" });
  } catch (err) {
    console.error("Update error:", err);
    try { await tx.rollback(); } catch {}
    return res.status(500).json({ message: "Failed to update report", error: String(err.message ?? err) });
  }
}
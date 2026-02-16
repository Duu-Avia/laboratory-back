import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

export async function saveReportResultsBulk(req, res) {
  const reportId = Number(req.params.id);
  const { results, is_complete } = req.body;
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
    // Update report status only when frontend explicitly sends is_complete
    if (is_complete !== undefined) {
      const newStatus = is_complete ? 'tested' : 'incomplete';
      const statusReq = new sql.Request(tx);
      statusReq.input("reportId", sql.Int, reportId);
      statusReq.input("newStatus", sql.VarChar(50), newStatus);

      if (is_complete) {
        await statusReq.query(`
          UPDATE reports
            SET status = @newStatus,
                test_end_date = CAST(GETDATE() AS date),
                updated_at = GETDATE()
          WHERE id = @reportId
        `);
      } else {
        await statusReq.query(`
          UPDATE reports
            SET status = @newStatus,
                updated_at = GETDATE()
          WHERE id = @reportId
        `);
      }
    }

    await tx.commit();
    return res.json({ code: 201, message: "success" });
  } catch (err) {
    try {
      if (tx._aborted !== true) await tx.rollback();
    } catch {}

    return res.status(500).json({
      message: "Failed to save results",
      error: String(err?.message ?? err),
    });
  }
}
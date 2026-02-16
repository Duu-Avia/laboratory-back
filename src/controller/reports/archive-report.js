import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

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
          r.status,
          r.created_at,
          r.updated_at,
          r.test_start_date,
          r.test_end_date,
          r.signed_by,
          r.approved_by,
          r.approved_at,
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
            -- Archive (approved) -> everyone can see
            (@mode IS NULL OR @mode = 'approved' OR @mode = 'deleted')
            OR
            -- Approve requests (signed) -> only assigned senior or superadmin
            (
              @roleName = 'superadmin'
              OR r.assigned_to = @userId
            )
          )

        GROUP BY
          r.id, r.status,
          r.created_at, r.updated_at, r.test_start_date, r.test_end_date,
          r.signed_by, r.approved_by, r.approved_at, lt.type_name

        ORDER BY r.created_at DESC;
      `);

    res.json(response.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to load archive reports",
      error: String(err?.message ?? err),
    });
  }
}
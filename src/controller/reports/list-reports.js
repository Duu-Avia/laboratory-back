import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";

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
          r.status, r.created_at, r.created_by, u_creator.full_name,
          r.assigned_to, u_assigned.full_name, lt.type_name

        ORDER BY r.created_at DESC;
      `);

    res.json(r.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list reports", error: String(err?.message ?? err) });
  }
}
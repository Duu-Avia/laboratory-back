import { getConnection } from "../../config/connection-db.js";
import sql from "mssql";

// GET /activity-logs?user_id=&action=&target_type=&from=&to=&page=&limit=
export async function getActivityLogs(req, res) {
  try {
    const pool = await getConnection();
    const { user_id, action, target_type, from, to } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    let where = "WHERE 1=1";
    const request = pool.request();

    if (user_id) {
      where += " AND al.user_id = @user_id";
      request.input("user_id", sql.Int, Number(user_id));
    }
    if (action) {
      where += " AND al.action = @action";
      request.input("action", sql.VarChar(50), action);
    }
    if (target_type) {
      where += " AND al.target_type = @target_type";
      request.input("target_type", sql.VarChar(50), target_type);
    }
    if (from) {
      where += " AND al.created_at >= @from";
      request.input("from", sql.DateTime, new Date(from));
    }
    if (to) {
      where += " AND al.created_at <= @to";
      request.input("to", sql.DateTime, new Date(to));
    }

    request.input("limit", sql.Int, limit);
    request.input("offset", sql.Int, offset);

    const result = await request.query(`
      SELECT * FROM (
        SELECT
          ROW_NUMBER() OVER (ORDER BY al.created_at DESC) AS row_num,
          al.id,
          al.user_id,
          u.full_name,
          u.email,
          al.action,
          al.target_type,
          al.target_id,
          al.method,
          al.path,
          al.status_code,
          al.created_at
        FROM activity_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ${where}
      ) AS t
      WHERE t.row_num > @offset AND t.row_num <= @offset + @limit
    `);

    // Total count for pagination
    const countReq = pool.request();
    if (user_id) countReq.input("user_id", sql.Int, Number(user_id));
    if (action) countReq.input("action", sql.VarChar(50), action);
    if (target_type) countReq.input("target_type", sql.VarChar(50), target_type);
    if (from) countReq.input("from", sql.DateTime, new Date(from));
    if (to) countReq.input("to", sql.DateTime, new Date(to));

    const countResult = await countReq.query(
      `SELECT COUNT(*) as total FROM activity_logs al ${where}`
    );

    const total = countResult.recordset[0].total;

    return res.json({
      data: result.recordset,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Activity logs error:", err);
    return res.status(500).json({
      message: "Failed to get activity logs",
      error: String(err.message ?? err),
    });
  }
}

import sql from "mssql";
import { getConnection } from "../../config/connection-db.js";
import { sendToUser } from "./sse-manager.js";

/**
 * Create a notification, store it in DB, and push via SSE if user is online.
 * Never throws — notification failure should not break the main operation.
 */
export async function createNotification({ recipientId, senderId, type, message, reportId = null }) {
  try {
    const pool = await getConnection();

    const result = await pool.request()
      .input("recipientId", sql.Int, recipientId)
      .input("senderId", sql.Int, senderId)
      .input("type", sql.VarChar(50), type)
      .input("message", sql.NVarChar(500), message)
      .input("reportId", sql.Int, reportId)
      .query(`
        INSERT INTO notifications (recipient_id, sender_id, type, message, report_id)
        OUTPUT INSERTED.id, INSERTED.recipient_id, INSERTED.sender_id,
               INSERTED.type, INSERTED.message, INSERTED.report_id,
               INSERTED.is_read, INSERTED.created_at
        VALUES (@recipientId, @senderId, @type, @message, @reportId)
      `);

    const notification = result.recordset[0];

    // Push the new notification via SSE
    sendToUser(recipientId, "notification", notification);

    // Push updated unread count
    const countResult = await pool.request()
      .input("recipientId", sql.Int, recipientId)
      .query(`
        SELECT COUNT(*) AS unread_count
        FROM notifications
        WHERE recipient_id = @recipientId AND is_read = 0
      `);

    sendToUser(recipientId, "unread-count", {
      unread_count: countResult.recordset[0].unread_count,
    });

    return notification;
  } catch (err) {
    console.error("Failed to create notification:", err);
    return null;
  }
}

/**
 * Get paginated notifications for a user.
 */
export async function getNotifications(userId, { page = 1, limit = 10 } = {}) {
  const pool = await getConnection();

  // Sanitize to safe integers
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
  const safeOffset = Math.max(0, (Number(page) - 1) * safeLimit);

  const countResult = await pool.request()
    .input("userId", sql.Int, userId)
    .query(`
      SELECT COUNT(*) AS total
      FROM notifications
      WHERE recipient_id = @userId
    `);

  const total = countResult.recordset[0].total;

  const rowStart = safeOffset + 1;
  const rowEnd = safeOffset + safeLimit;

  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .input("rowStart", sql.Int, rowStart)
    .input("rowEnd", sql.Int, rowEnd)
    .query(`
      SELECT * FROM (
        SELECT
          n.id,
          n.recipient_id,
          n.sender_id,
          u.full_name AS sender_name,
          n.type,
          n.message,
          n.report_id,
          n.is_read,
          n.created_at,
          ROW_NUMBER() OVER (ORDER BY n.created_at DESC) AS rn
        FROM notifications n
        LEFT JOIN users u ON u.id = n.sender_id
        WHERE n.recipient_id = @userId
      ) t
      WHERE t.rn BETWEEN @rowStart AND @rowEnd
    `);

  return {
    notifications: result.recordset,
    pagination: {
      page,
      limit: safeLimit,
      totalItems: total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId) {
  const pool = await getConnection();

  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .query(`
      SELECT COUNT(*) AS unread_count
      FROM notifications
      WHERE recipient_id = @userId AND is_read = 0
    `);

  return result.recordset[0].unread_count;
}

/**
 * Mark a single notification as read (with ownership check).
 */
export async function markAsRead(notificationId, userId) {
  const pool = await getConnection();

  const result = await pool.request()
    .input("id", sql.Int, notificationId)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = @id AND recipient_id = @userId AND is_read = 0
    `);

  return result.rowsAffected[0] > 0;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId) {
  const pool = await getConnection();

  const result = await pool.request()
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE notifications
      SET is_read = 1
      WHERE recipient_id = @userId AND is_read = 0
    `);

  return result.rowsAffected[0];
}

/**
 * Delete notifications older than 1 month.
 */
export async function cleanOldNotifications() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      DELETE FROM notifications
      WHERE created_at < DATEADD(MONTH, -1, GETDATE())
    `);
    const count = result.rowsAffected[0];
    if (count > 0) {
      console.log(`Cleaned ${count} old notifications`);
    }
  } catch (err) {
    console.error("Failed to clean old notifications:", err);
  }
}

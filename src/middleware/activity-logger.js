import { getConnection } from "../config/connection-db.js";
import sql from "mssql";

// Route → action + target_type mapping
const ROUTE_MAP = [
  // // Auth
  // { method: "POST", pattern: /^\/auth\/login$/, action: "login", target_type: "auth" },

  // Reports
  { method: "POST", pattern: /^\/reports\/create$/, action: "create", target_type: "report" },
  { method: "PUT", pattern: /^\/reports\/edit\/(\d+)$/, action: "update", target_type: "report" },
  { method: "PUT", pattern: /^\/reports\/(\d+)\/delete$/, action: "delete", target_type: "report" },
  { method: "PUT", pattern: /^\/reports\/sign\/(\d+)$/, action: "sign", target_type: "report" },
  { method: "PUT", pattern: /^\/reports\/approve\/(\d+)$/, action: "approve", target_type: "report" },
  { method: "PUT", pattern: /^\/reports\/reject\/(\d+)$/, action: "reject", target_type: "report" },
  { method: "GET", pattern: /^\/reports\/(\d+)\/pdf$/, action: "view", target_type: "report" },
  { method: "GET", pattern: /^\/reports\/excel$/, action: "export", target_type: "report" },

  // Users
  { method: "POST", pattern: /^\/users$/, action: "create", target_type: "user" },
  { method: "PUT", pattern: /^\/users\/(\d+)$/, action: "update", target_type: "user" },
  { method: "PUT", pattern: /^\/users\/(\d+)\/deactive$/, action: "delete", target_type: "user" },
  { method: "PUT", pattern: /^\/users\/(\d+)\/password$/, action: "update", target_type: "user" },
  { method: "PUT", pattern: /^\/users\/(\d+)\/role$/, action: "update", target_type: "user" },
  // { method: "GET", pattern: /^\/users$/, action: "view", target_type: "user" },
  // { method: "GET", pattern: /^\/users\/(\d+)$/, action: "view", target_type: "user" },

  // Lab types
  { method: "POST", pattern: /^\/lab-types$/, action: "create", target_type: "lab_type" },
  { method: "PUT", pattern: /^\/lab-types\/(\d+)\/deactivate$/, action: "delete", target_type: "lab_type" },
  { method: "PUT", pattern: /^\/lab-types\/(\d+)\/reactivate$/, action: "update", target_type: "lab_type" },
  // { method: "GET", pattern: /^\/lab-types$/, action: "view", target_type: "lab_type" },

  // Indicators
  { method: "POST", pattern: /^\/indicators\/create-indicator$/, action: "create", target_type: "indicator" },
  // { method: "GET", pattern: /^\/indicators/, action: "view", target_type: "indicator" },

  // Locations
  { method: "POST", pattern: /^\/locations$/, action: "create", target_type: "location" },
  { method: "PUT", pattern: /^\/locations\/(\d+)\/delete$/, action: "delete", target_type: "location" },
  { method: "POST", pattern: /^\/locations\/samples\/(\d+)\/edit$/, action: "create", target_type: "location" },
  { method: "PUT", pattern: /^\/locations\/samples\/(\d+)\/delete$/, action: "delete", target_type: "location" },
  // { method: "GET", pattern: /^\/locations/, action: "view", target_type: "location" },
];

// Skip these paths
const SKIP_PATHS = ["/health", "/ready", "/", "/notifications", "/activity-logs"];

function matchRoute(method, path) {
  for (const route of ROUTE_MAP) {
    if (route.method !== method) continue;
    const match = path.match(route.pattern);
    if (match) {
      return {
        action: route.action,
        target_type: route.target_type,
        target_id: match[1] ? Number(match[1]) : null,
      };
    }
  }
  return null;
}

export function activityLogger(req, res, next) {
  const fullPath = req.baseUrl + req.path;

  if (SKIP_PATHS.some((p) => fullPath === p || fullPath.startsWith(p + "/"))) {
    return next();
  }

  // Log after response is sent (non-blocking)
  res.on("finish", () => {
    const matched = matchRoute(req.method, fullPath);
    if (!matched) return;

    const userId = req.user?.userId || null;

    // Fire and forget
    saveLog(userId, matched, req.method, fullPath, res.statusCode)
      .catch(() => {});
  });

  next();
}

async function saveLog(userId, matched, method, path, statusCode) {
  const pool = await getConnection();
  await pool.request()
    .input("user_id", sql.Int, userId)
    .input("action", sql.VarChar(50), matched.action)
    .input("target_type", sql.VarChar(50), matched.target_type)
    .input("target_id", sql.Int, matched.target_id)
    .input("method", sql.VarChar(10), method)
    .input("path", sql.VarChar(255), path)
    .input("status_code", sql.Int, statusCode)
    .query(`
      INSERT INTO activity_logs
        (user_id, action, target_type, target_id, method, path, status_code)
      VALUES
        (@user_id, @action, @target_type, @target_id, @method, @path, @status_code)
    `);
}

import jwt from "jsonwebtoken";
import sql from "mssql";
import { getConnection } from "../config/connection-db.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// JWT Token шалгах middleware
export function authMiddleware(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Token шаардлагатай" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, email, roleId, roleName }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token хугацаа дууссан" });
    }
    return res.status(401).json({ message: "Token буруу" });
  }
}

// Permission шалгах middleware
export function checkPermission(requiredPermission) {
  return async (req, res, next) => {
    try {
      const pool = await getConnection();

      // User-ийн permissions авах
      const result = await pool.request()
        .input("roleId", sql.Int, req.user.roleId)
        .query(`
          SELECT p.permission_key
          FROM role_permissions rp
          JOIN permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = @roleId
        `);

      const permissions = result.recordset.map(p => p.permission_key);

      // SuperAdmin бол бүгдийг зөвшөөрнө
      if (req.user.roleName === "superadmin") {
        return next();
      }

      // Permission шалгах
      if (!permissions.includes(requiredPermission)) {
        return res.status(403).json({ 
          message: "Энэ үйлдлийг хийх эрхгүй байна",
          required: requiredPermission 
        });
      }
      next();
    } catch (err) {
      console.error("Permission check error:", err);
      res.status(500).json({ message: "Эрх шалгахад алдаа гарлаа" });
    }
  };
}

// Олон permission-ийн аль нэгийг шалгах (OR)
export function checkAnyPermission(permissions) {
  return async (req, res, next) => {
    try {
      const pool = await getConnection();

      const result = await pool.request()
        .input("roleId", sql.Int, req.user.roleId)
        .query(`
          SELECT p.permission_key
          FROM role_permissions rp
          JOIN permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = @roleId
        `);

      const userPermissions = result.recordset.map(p => p.permission_key);

      // SuperAdmin бол бүгдийг зөвшөөрнө
      if (req.user.roleName === "superadmin") {
        return next();
      }

      // Аль нэг permission байвал зөвшөөрнө
      const hasPermission = permissions.some(p => userPermissions.includes(p));

      if (!hasPermission) {
        return res.status(403).json({ 
          message: "Энэ үйлдлийг хийх эрхгүй байна",
          required: permissions 
        });
      }

      next();
    } catch (err) {
      console.error("Permission check error:", err);
      res.status(500).json({ message: "Эрх шалгахад алдаа гарлаа" });
    }
  };
}
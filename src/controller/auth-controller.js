import sql from "mssql";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getConnection } from "../config/connection-db.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "8h";

// POST /auth/login
export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email болон password шаардлагатай" });
  }

  try {
    const pool = await getConnection();

    // User олох
    const result = await pool.request()
      .input("email", sql.VarChar(100), email)
      .query(`
        SELECT u.id, u.email, u.password_hash, u.full_name, u.role_id, u.is_active,
               r.role_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.email = @email
      `);

    const user = result.recordset[0];

    if (!user) {
      return res.status(401).json({ message: "Email эсвэл password буруу" });
    }

    if (!user.is_active) {
      return res.status(401).json({ message: "Хэрэглэгч идэвхгүй байна" });
    }

    // Password шалгах (Одоо: plain text, Дараа: bcrypt)
    // TODO: Production-д bcrypt.compare() ашиглах
    const isValidPassword = user.password_hash === password;
    // const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Email эсвэл password буруу" });
    }

    // Permissions авах
    const permResult = await pool.request()
      .input("roleId", sql.Int, user.role_id)
      .query(`
        SELECT p.permission_key
        FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = @roleId
      `);

    const permissions = permResult.recordset.map(p => p.permission_key);

    // JWT token үүсгэх
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        roleId: user.role_id,
        roleName: user.role_name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: "Амжилттай нэвтэрлээ",
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role_name,
        permissions,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Нэвтрэхэд алдаа гарлаа", error: String(err.message) });
  }
}

// GET /auth/me - Одоогийн хэрэглэгчийн мэдээлэл + permissions
export async function getMe(req, res) {
  try {
    const pool = await getConnection();

    // User мэдээлэл
    const userResult = await pool.request()
      .input("userId", sql.Int, req.user.userId)
      .query(`
        SELECT u.id, u.email, u.full_name, u.role_id, r.role_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = @userId
      `);

    const user = userResult.recordset[0];

    if (!user) {
      return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
    }

    // Permissions авах
    const permResult = await pool.request()
      .input("roleId", sql.Int, user.role_id)
      .query(`
        SELECT p.permission_key
        FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = @roleId
      `);

    const permissions = permResult.recordset.map(p => p.permission_key);

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role_name,
      permissions,
    });
  } catch (err) {
    console.error("GetMe error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message) });
  }
}

// GET /auth/permissions - Бүх permissions жагсаалт (Admin UI-д)
export async function getAllPermissions(req, res) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT id, permission_key, permission_name, module
      FROM permissions
      ORDER BY module, permission_key
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("GetAllPermissions error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message) });
  }
}
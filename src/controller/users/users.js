import sql from "mssql";
import bcrypt from "bcryptjs";
import { getConnection } from "../../config/connection-db.js";

const PRIVILEGED_ROLES = ["superadmin", "admin"];

/**
 * Checks if caller can operate on target user.
 * Non-superadmin cannot operate on admin/superadmin users.
 */
async function checkTargetUserAccess(pool, callerRoleName, targetUserId) {
  const result = await pool
    .request()
    .input("targetUserId", sql.Int, targetUserId)
    .query(
      `SELECT u.id, u.full_name, u.email, u.role_id, u.is_active, r.role_name
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = @targetUserId`
    );

  const targetUser = result.recordset[0];
  if (!targetUser) return { error: "not_found" };

  if (
    callerRoleName !== "superadmin" &&
    PRIVILEGED_ROLES.includes(targetUser.role_name)
  ) {
    return { error: "forbidden", targetUser };
  }

  return { targetUser };
}

// GET /users/profile
export async function getProfile(req, res) {
  try {
    const pool = await getConnection();

    const userResult = await pool
      .request()
      .input("userId", sql.Int, req.user.userId)
      .query(
        `SELECT u.id, u.email, u.full_name, u.role_id, u.is_active, u.created_at,
                r.role_name, position_name
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.id = @userId`
      );

    const user = userResult.recordset[0];
    if (!user) return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });

    const permResult = await pool
      .request()
      .input("roleId", sql.Int, user.role_id)
      .query(
        `SELECT p.permission_key
         FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = @roleId`
      );

    const labResult = await pool
      .request()
      .input("userId2", sql.Int, user.id)
      .query(
        `SELECT lt.id, lt.type_name
         FROM user_lab_types ult JOIN lab_types lt ON lt.id = ult.lab_type_id
         WHERE ult.user_id = @userId2`
      );

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      position_name: user.position_name,
      role: user.role_name,
      is_active: user.is_active,
      created_at: user.created_at,
      permissions: permResult.recordset.map((p) => p.permission_key),
      lab_types: labResult.recordset,
    });
  } catch (err) {
    console.error("getProfile error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// PUT /users/profile
export async function updateProfile(req, res) {
  const { full_name, email } = req.body;
  const userId = req.user.userId;

  if (!full_name && !email) {
    return res.status(400).json({ message: "Өөрчлөх мэдээлэл оруулна уу" });
  }

  try {
    const pool = await getConnection();

    if (email) {
      const dup = await pool
        .request()
        .input("email", sql.VarChar(100), email)
        .input("userId", sql.Int, userId)
        .query(`SELECT id FROM users WHERE email = @email AND id != @userId`);

      if (dup.recordset.length > 0) {
        return res.status(409).json({ message: "Энэ email бүртгэлтэй байна" });
      }
    }

    const sets = [];
    const request = pool.request().input("userId", sql.Int, userId);

    if (full_name) {
      sets.push("full_name = @fullName");
      request.input("fullName", sql.NVarChar(100), full_name);
    }
    if (email) {
      sets.push("email = @email");
      request.input("email", sql.VarChar(100), email);
    }
    sets.push("updated_at = GETDATE()");

    await request.query(`UPDATE users SET ${sets.join(", ")} WHERE id = @userId`);

    res.json({ message: "Профайл амжилттай шинэчлэгдлээ" });
  } catch (err) {
    console.error("updateProfile error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// PUT /users/profile/password
export async function changeOwnPassword(req, res) {
  const { current_password, new_password } = req.body;
  const userId = req.user.userId;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: "Одоогийн болон шинэ нууц үг шаардлагатай" });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ message: "Шинэ нууц үг 6-с дээш тэмдэгт байх ёстой" });
  }

  try {
    const pool = await getConnection();

    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`SELECT password_hash FROM users WHERE id = @userId`);

    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });

    // Bcrypt or plain text check
    let isValid;
    if (user.password_hash.startsWith("$2")) {
      isValid = await bcrypt.compare(current_password, user.password_hash);
    } else {
      isValid = user.password_hash === current_password;
    }

    if (!isValid) {
      return res.status(401).json({ message: "Одоогийн нууц үг буруу" });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool
      .request()
      .input("hash", sql.VarChar(255), hash)
      .input("userId2", sql.Int, userId)
      .query(`UPDATE users SET password_hash = @hash, updated_at = GETDATE() WHERE id = @userId2`);

    res.json({ message: "Нууц үг амжилттай солигдлоо" });
  } catch (err) {
    console.error("changeOwnPassword error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// GET /users
export async function getAllUsers(req, res) {
  const { search, role, is_active } = req.query;

  try {
    const pool = await getConnection();
    const request = pool.request();

    let where = "WHERE 1=1";

    if (search) {
      where += " AND (u.full_name LIKE @search OR u.email LIKE @search)";
      request.input("search", sql.NVarChar(200), `%${search}%`);
    }
    if (role) {
      where += " AND r.role_name = @role";
      request.input("role", sql.VarChar(50), role);
    }
    if (is_active !== undefined) {
      where += " AND u.is_active = @isActive";
      request.input("isActive", sql.Bit, is_active === "true" ? 1 : 0);
    }

    const result = await request.query(`
      SELECT u.id, u.email, u.full_name, u.role_id, r.role_name,
             u.is_active, u.created_at, u.position_name, u.updated_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      ${where}
      ORDER BY u.created_at DESC
    `);

    // Fetch lab types for all users in one query
    const labResult = await pool.request().query(`
      SELECT ult.user_id, lt.id, lt.type_name
      FROM user_lab_types ult
      JOIN lab_types lt ON lt.id = ult.lab_type_id
    `);

    const labMap = {};
    for (const row of labResult.recordset) {
      if (!labMap[row.user_id]) labMap[row.user_id] = [];
      labMap[row.user_id].push({ id: row.id, type_name: row.type_name });
    }

    const users = result.recordset.map((u) => ({
      ...u,
      lab_types: labMap[u.id] || [],
    }));

    res.json(users);
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// GET /users/:id
export async function getUserById(req, res) {
  const targetId = Number(req.params.id);
  if (!targetId) return res.status(400).json({ message: "ID буруу" });

  try {
    const pool = await getConnection();

    const userResult = await pool
      .request()
      .input("id", sql.Int, targetId)
      .query(
        `SELECT u.id, u.email, u.full_name, u.role_id, r.role_name,
                u.is_active, u.position_name, u.created_at, u.updated_at
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.id = @id`
      );

    const user = userResult.recordset[0];
    if (!user) return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });

    const labResult = await pool
      .request()
      .input("userId", sql.Int, targetId)
      .query(
        `SELECT lt.id, lt.type_name
         FROM user_lab_types ult JOIN lab_types lt ON lt.id = ult.lab_type_id
         WHERE ult.user_id = @userId`
      );

    res.json({ ...user, lab_types: labResult.recordset });
  } catch (err) {
    console.error("getUserById error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// POST /users
export async function createUser(req, res) {
  const { email, password, full_name, role_id, lab_type_ids, position_name } = req.body;

  if (!email || !password || !full_name || !role_id) {
    return res.status(400).json({ message: "email, password, full_name, role_id шаардлагатай" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Нууц үг 6-с дээш тэмдэгт байх ёстой" });
  }

  try {
    const pool = await getConnection();

    // Check target role
    const roleResult = await pool
      .request()
      .input("roleId", sql.Int, role_id)
      .query(`SELECT role_name FROM roles WHERE id = @roleId`);

    const targetRole = roleResult.recordset[0];
    if (!targetRole) return res.status(400).json({ message: "Role олдсонгүй" });

    if (
      req.user.roleName !== "superadmin" &&
      PRIVILEGED_ROLES.includes(targetRole.role_name)
    ) {
      return res.status(403).json({ message: "Админ эрх олгох боломжгүй" });
    }

    // Check email uniqueness
    const dup = await pool
      .request()
      .input("email", sql.VarChar(100), email)
      .query(`SELECT id FROM users WHERE email = @email`);

    if (dup.recordset.length > 0) {
      return res.status(409).json({ message: "Энэ email бүртгэлтэй байна" });
    }

    const hash = await bcrypt.hash(password, 10);

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const insertResult = await new sql.Request(tx)
        .input("email", sql.VarChar(100), email)
        .input("hash", sql.VarChar(255), hash)
        .input("fullName", sql.NVarChar(100), full_name)
        .input("roleId", sql.Int, role_id)
        .input("position_name", sql.NVarChar(100), position_name)
        .query(
          `INSERT INTO users (email, password_hash, full_name, position_name, role_id)
           VALUES (@email, @hash, @fullName, @position_name, @roleId);
           SELECT SCOPE_IDENTITY() AS id;`
        );

      const newUserId = insertResult.recordset[0].id;

      if (Array.isArray(lab_type_ids) && lab_type_ids.length > 0) {
        for (const ltId of lab_type_ids) {
          await new sql.Request(tx)
            .input("userId", sql.Int, newUserId)
            .input("labTypeId", sql.Int, ltId)
            .query(`INSERT INTO user_lab_types (user_id, lab_type_id) VALUES (@userId, @labTypeId)`);
        }
      }

      await tx.commit();

      res.status(201).json({
        message: "Хэрэглэгч амжилттай үүсгэгдлээ",
        user: { id: newUserId, email, full_name, role: targetRole.role_name },
      });
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error("createUser error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// PUT /users/:id
export async function updateUser(req, res) {
  const targetId = Number(req.params.id);
  if (!targetId) return res.status(400).json({ message: "ID буруу" });

  const { full_name, email, lab_type_ids } = req.body;

  try {
    const pool = await getConnection();

    const access = await checkTargetUserAccess(pool, req.user.roleName, targetId);
    if (access.error === "not_found") return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
    if (access.error === "forbidden") return res.status(403).json({ message: "Энэ хэрэглэгчийг засах эрхгүй" });

    if (email) {
      const dup = await pool
        .request()
        .input("email", sql.VarChar(100), email)
        .input("targetId", sql.Int, targetId)
        .query(`SELECT id FROM users WHERE email = @email AND id != @targetId`);

      if (dup.recordset.length > 0) {
        return res.status(409).json({ message: "Энэ email бүртгэлтэй байна" });
      }
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const sets = [];
      const updateReq = new sql.Request(tx).input("targetId", sql.Int, targetId);

      if (full_name) {
        sets.push("full_name = @fullName");
        updateReq.input("fullName", sql.NVarChar(100), full_name);
      }
      if (email) {
        sets.push("email = @email");
        updateReq.input("email", sql.VarChar(100), email);
      }

      if (sets.length > 0) {
        sets.push("updated_at = GETDATE()");
        await updateReq.query(`UPDATE users SET ${sets.join(", ")} WHERE id = @targetId`);
      }

      if (Array.isArray(lab_type_ids)) {
        await new sql.Request(tx)
          .input("userId", sql.Int, targetId)
          .query(`DELETE FROM user_lab_types WHERE user_id = @userId`);

        for (const ltId of lab_type_ids) {
          await new sql.Request(tx)
            .input("userId", sql.Int, targetId)
            .input("labTypeId", sql.Int, ltId)
            .query(`INSERT INTO user_lab_types (user_id, lab_type_id) VALUES (@userId, @labTypeId)`);
        }
      }

      await tx.commit();
      res.json({ message: "Хэрэглэгч амжилттай шинэчлэгдлээ" });
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error("updateUser error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// PUT /users/:id/password
export async function resetUserPassword(req, res) {
  const targetId = Number(req.params.id);
  if (!targetId) return res.status(400).json({ message: "ID буруу" });

  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ message: "Шинэ нууц үг 6-с дээш тэмдэгт байх ёстой" });
  }

  try {
    const pool = await getConnection();

    const access = await checkTargetUserAccess(pool, req.user.roleName, targetId);
    if (access.error === "not_found") return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
    if (access.error === "forbidden") return res.status(403).json({ message: "Энэ хэрэглэгчийн нууц үг солих эрхгүй" });

    const hash = await bcrypt.hash(new_password, 10);
    await pool
      .request()
      .input("hash", sql.VarChar(255), hash)
      .input("targetId", sql.Int, targetId)
      .query(`UPDATE users SET password_hash = @hash, updated_at = GETDATE() WHERE id = @targetId`);

    res.json({ message: "Нууц үг амжилттай солигдлоо" });
  } catch (err) {
    console.error("resetUserPassword error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// DELETE /users/:id (soft delete)
export async function deactivateUser(req, res) {
  const targetId = Number(req.params.id);
  if (!targetId) return res.status(400).json({ message: "ID буруу" });

  if (targetId === req.user.userId) {
    return res.status(400).json({ message: "Өөрийгөө идэвхгүйжүүлэх боломжгүй" });
  }

  try {
    const pool = await getConnection();

    const access = await checkTargetUserAccess(pool, req.user.roleName, targetId);
    if (access.error === "not_found") return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
    if (access.error === "forbidden") return res.status(403).json({ message: "Энэ хэрэглэгчийг устгах эрхгүй" });

    await pool
      .request()
      .input("targetId", sql.Int, targetId)
      .query(`UPDATE users SET is_active = 0, updated_at = GETDATE() WHERE id = @targetId`);

    res.json({ message: "Хэрэглэгч амжилттай идэвхгүйжүүлэгдлээ" });
  } catch (err) {
    console.error("deactivateUser error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// PUT /users/:id/role
export async function changeUserRole(req, res) {
  const targetId = Number(req.params.id);
  if (!targetId) return res.status(400).json({ message: "ID буруу" });

  const { role_id } = req.body;
  if (!role_id) return res.status(400).json({ message: "role_id шаардлагатай" });

  if (targetId === req.user.userId) {
    return res.status(400).json({ message: "Өөрийн эрхийг өөрчлөх боломжгүй" });
  }

  try {
    const pool = await getConnection();

    // Verify role exists
    const roleResult = await pool
      .request()
      .input("roleId", sql.Int, role_id)
      .query(`SELECT role_name FROM roles WHERE id = @roleId`);

    if (roleResult.recordset.length === 0) {
      return res.status(400).json({ message: "Role олдсонгүй" });
    }

    // Defense-in-depth: only superadmin should reach here (permission check handles it)
    if (req.user.roleName !== "superadmin") {
      return res.status(403).json({ message: "Зөвхөн супер админ эрх өөрчлөх боломжтой" });
    }

    await pool
      .request()
      .input("roleId", sql.Int, role_id)
      .input("targetId", sql.Int, targetId)
      .query(`UPDATE users SET role_id = @roleId, updated_at = GETDATE() WHERE id = @targetId`);

    res.json({ message: "Хэрэглэгчийн эрх амжилттай өөрчлөгдлөө" });
  } catch (err) {
    console.error("changeUserRole error:", err);
    res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

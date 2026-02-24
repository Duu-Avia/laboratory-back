import sql from "mssql";
import sharp from "sharp";
import { getConnection } from "../../config/connection-db.js";

/**
 * Process uploaded signature image:
 * 1. Convert JPG/PNG to raw pixels
 * 2. Remove white/near-white background → transparent
 * 3. Trim empty space around signature
 * 4. Resize to fit PDF signature area (max 200px wide)
 * 5. Output as transparent PNG
 */
async function processSignature(buffer) {
  // Convert to raw RGBA pixels
  const image = sharp(buffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  // Make white/near-white pixels transparent
  // Threshold: if R > 200 && G > 200 && B > 200, set alpha to 0
  const THRESHOLD = 200;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > THRESHOLD && g > THRESHOLD && b > THRESHOLD) {
      data[i + 3] = 0; // transparent
    }
  }

  // Rebuild image from processed pixels, trim whitespace, resize
  const processed = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim()  // remove transparent borders
    .resize({ width: 200, height: 80, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  return processed;
}

// POST /users/profile/signature
export async function uploadSignatureImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Гарын үсгийн зураг оруулна уу" });
  }

  try {
    const pngBuffer = await processSignature(req.file.buffer);

    const pool = await getConnection();

    await pool
      .request()
      .input("userId", sql.Int, req.user.userId)
      .input("signatureImage", sql.VarBinary(sql.MAX), pngBuffer)
      .query(`
        UPDATE users
        SET signature_image = @signatureImage,
            signature_uploaded_at = GETDATE(),
            updated_at = GETDATE()
        WHERE id = @userId
      `);

    return res.json({ message: "Гарын үсэг амжилттай хадгалагдлаа" });
  } catch (err) {
    console.error("uploadSignature error:", err);
    return res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// GET /users/profile/signature
export async function getSignatureImage(req, res) {
  try {
    const pool = await getConnection();

    const result = await pool
      .request()
      .input("userId", sql.Int, req.user.userId)
      .query(`SELECT signature_image, signature_uploaded_at FROM users WHERE id = @userId`);

    const user = result.recordset[0];
    if (!user || !user.signature_image) {
      return res.status(404).json({ message: "Гарын үсгийн зураг олдсонгүй" });
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", user.signature_image.length);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(user.signature_image);
  } catch (err) {
    console.error("getSignature error:", err);
    return res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// GET /users/signature/:id  (admin: view any user's signature)
export async function getSignatureByUserId(req, res) {
  const targetId = Number(req.params.id);
  if (!targetId) return res.status(400).json({ message: "ID буруу" });

  try {
    const pool = await getConnection();

    const result = await pool
      .request()
      .input("userId", sql.Int, targetId)
      .query(`SELECT signature_image FROM users WHERE id = @userId`);

    const user = result.recordset[0];
    if (!user || !user.signature_image) {
      return res.status(404).json({ message: "Гарын үсгийн зураг олдсонгүй" });
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", user.signature_image.length);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(user.signature_image);
  } catch (err) {
    console.error("getSignatureByUserId error:", err);
    return res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// POST /users/signature/:id  (admin: upload signature for any user)
export async function uploadSignatureByUserId(req, res) {
  const targetId = Number(req.params.id);
  if (!targetId) return res.status(400).json({ message: "ID буруу" });

  if (!req.file) {
    return res.status(400).json({ message: "Гарын үсгийн зураг оруулна уу" });
  }

  try {
    const pngBuffer = await processSignature(req.file.buffer);

    const pool = await getConnection();

    await pool
      .request()
      .input("userId", sql.Int, targetId)
      .input("signatureImage", sql.VarBinary(sql.MAX), pngBuffer)
      .query(`
        UPDATE users
        SET signature_image = @signatureImage,
            signature_uploaded_at = GETDATE(),
            updated_at = GETDATE()
        WHERE id = @userId
      `);

    return res.json({ message: "Гарын үсэг амжилттай хадгалагдлаа" });
  } catch (err) {
    console.error("uploadSignatureByUserId error:", err);
    return res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// DELETE /users/signature/:id  (admin: delete any user's signature)
export async function deleteSignatureByUserId(req, res) {
  const targetId = Number(req.params.id);
  if (!targetId) return res.status(400).json({ message: "ID буруу" });

  try {
    const pool = await getConnection();

    await pool
      .request()
      .input("userId", sql.Int, targetId)
      .query(`
        UPDATE users
        SET signature_image = NULL,
            signature_uploaded_at = NULL,
            updated_at = GETDATE()
        WHERE id = @userId
      `);

    return res.json({ message: "Гарын үсэг амжилттай устгагдлаа" });
  } catch (err) {
    console.error("deleteSignatureByUserId error:", err);
    return res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

// DELETE /users/profile/signature
export async function deleteSignatureImage(req, res) {
  try {
    const pool = await getConnection();

    await pool
      .request()
      .input("userId", sql.Int, req.user.userId)
      .query(`
        UPDATE users
        SET signature_image = NULL,
            signature_uploaded_at = NULL,
            updated_at = GETDATE()
        WHERE id = @userId
      `);

    return res.json({ message: "Гарын үсэг амжилттай устгагдлаа" });
  } catch (err) {
    console.error("deleteSignature error:", err);
    return res.status(500).json({ message: "Алдаа гарлаа", error: String(err.message ?? err) });
  }
}

import multer from "multer";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

const storage = multer.memoryStorage();

export const uploadSignature = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB (raw photo before processing)
    files: 1,
  },
  fileFilter(req, file, cb) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error("Зөвхөн PNG, JPG зураг оруулна уу"), false);
    }
    cb(null, true);
  },
}).single("signature");

export function handleMulterError(err, req, res, next) {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Файлын хэмжээ 2MB-с хэтэрсэн" });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
}

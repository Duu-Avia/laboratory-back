import fs from "fs";
import path from "path";
import sql from "mssql";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getConnection } from "../config/connection-db.js";

/** -------------------- small utils -------------------- **/
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function splitTextToLines(text, maxLength) {
  const t = String(text ?? "");
  if (t.length <= maxLength) return [t, ""];
  const first = t.slice(0, maxLength);
  const lastSpace = first.lastIndexOf(" ");
  if (lastSpace > 0) return [t.slice(0, lastSpace).trim(), t.slice(lastSpace + 1, lastSpace + 1 + maxLength).trim()];
  return [t.slice(0, maxLength).trim(), t.slice(maxLength, maxLength * 2).trim()];
}

function cellText(row) {
  if (row.is_detected === true) return "Илэрсэн";
  if (row.is_detected === false) return "Илрээгүй";
  if (row.result_value !== null && row.result_value !== undefined && String(row.result_value).trim() !== "") {
    // CFU results are stored as JSON with temp22/temp37/average – show only the average
    try {
      const parsed = JSON.parse(row.result_value);
      if (parsed && typeof parsed === "object" && parsed.average !== undefined) {
        return String(parsed.average);
      }
    } catch {}
    return String(row.result_value);
  }
  return "";
}

/** -------------------- 1) fetch rows ------------------- **/
async function fetchReportRows(pool, reportId) {
  const r = await pool.request()
    .input("reportId", sql.Int, reportId)
    .query(`
      SELECT
        r.id AS report_id,
        r.created_at,
        r.test_start_date,
        r.test_end_date,
        r.approved_by,
        r.approved_at,
        r.signed_by,
        r.signed_at,
        r.status AS report_status,

        s.id AS sample_id,
        s.sample_name,
        s.sample_date,
        s.sample_amount,
        s.sampled_by,

        st.type_name,
        st.standard,

        i.id AS indicator_id,
        i.indicator_name,
        i.test_method,
        i.limit_value,

        tr.result_value,
        tr.is_detected

      FROM reports r
      JOIN samples s ON s.report_id = r.id AND s.status != 'deleted'
      JOIN sample_indicators si ON si.sample_id = s.id AND si.status != 'deleted'
      JOIN lab_types st ON st.id = s.lab_type_id
      JOIN indicators i ON i.id = si.indicator_id
      LEFT JOIN test_results tr ON tr.sample_indicator_id = si.id
      WHERE r.id = @reportId
      ORDER BY i.id, s.id;
    `);

  return r.recordset ?? [];
}

/** -------------------- 2) build model (NO pdf here) -------------------- **/
function buildModel(rows, reportId) {
  if (!rows.length) return null;

  const first = rows[0];

  // Report-level info
  const reportYear = new Date(first.created_at).getFullYear();
  const tailanDugaar = `${reportYear}_${reportId}`;

  const testedDate = `${isoDate(first.test_start_date)} - ${isoDate(first.test_end_date)}`;
  const sampled_date = isoDate(first.sample_date);

  // If sample_amount / sampled_by can differ per sample, you SHOULD decide which one to display.
  // For now keep the "first row" behavior (same as your current code):
  const sample_amount = first.sample_amount;
  const sampled_by = first.sampled_by;
  const soritsTodorhoilolt = first.type_name;
  const tehnikiinShaardlaga = first.standard;

  // Collect unique samples and indicators
  const sampleMap = new Map();
  const indicatorMap = new Map();

  // Matrix: indicatorId -> (sampleId -> value)
  const matrix = new Map();

  for (const row of rows) {
    if (!sampleMap.has(row.sample_id)) {
      sampleMap.set(row.sample_id, { id: row.sample_id, name: row.sample_name });
    }
    if (!indicatorMap.has(row.indicator_id)) {
      indicatorMap.set(row.indicator_id, {
        id: row.indicator_id,
        name: row.indicator_name,
        method: row.test_method,
        limit: row.limit_value,
      });
    }

    if (!matrix.has(row.indicator_id)) matrix.set(row.indicator_id, new Map());
    matrix.get(row.indicator_id).set(row.sample_id, cellText(row));
  }

  const samples = Array.from(sampleMap.values());
  const indicators = Array.from(indicatorMap.values());

  // labDugaar formatting
  const sampleIds = samples.map((s) => s.id);
  const sampleEhniiDugaar = sampleIds[0];
  const sampleSuuliinDugaar = sampleIds[sampleIds.length - 1];
  const labDugaar = `${reportId}/${sampleEhniiDugaar}-${sampleSuuliinDugaar}`;

  return {
    tailanDugaar,
    testedDate,
    sampled_date,
    sample_amount,
    sampled_by,
    soritsTodorhoilolt,
    tehnikiinShaardlaga,
    labDugaar,
    samples,
    indicators,
    matrix,
    approved_by: first.approved_by ?? null,
    approved_at: first.approved_at ? isoDate(first.approved_at) : null,
    signed_by: first.signed_by ?? null,
    signed_at: first.signed_at ? isoDate(first.signed_at) : null,
    report_status: first.report_status ?? "",
  };
}

/** -------------------- 3) layout config (ONE place to tweak) -------------------- **/
const LAYOUT = {
  // table
  tableTopY: 290,
  rowHeight: 25,
  rowsPerPage: 8,

  // left cols
  noX: 105,
  indicatorX: 130,
  standardX: 216,
  limitX: 300,

  // header y
  sampleHeaderY: 320,

  // “fixed texts” positions
  x_amount: 140, y_amount: 385,
  x_tested: 421, y_tested: 385,
  x_sampledDate: 290, y_sampledDate: 385,
  x_tailan: 296, y_tailan: 617,
  x_lab: 145, y_lab: 539,
  x_sampledBy: 180, y_sampledBy: 436,
  x_soritsType: 348, y_soritsType: 539,
  x_tehnikiinShaardlaga: 235, y_tehnikiinShaardlaga:539,

  // sample list area
  sampleListX: 140,
  sampleListStartY: 500,
};

function buildSampleColumns(sampleCount) {
  const startX = 450;      // base area
  const step = 55;         // distance between sample columns
  const headerOffset = -67;
  const valueOffset = -77;

  return Array.from({ length: sampleCount }, (_, i) => {
    const base = startX + i * step;
    return {
      xHeader: base + headerOffset,
      xValue: base + valueOffset,
    };
  });
}

/** -------------------- 4) render page helpers -------------------- **/
function drawFixedHeader(page, model, font) {
  const black = rgb(0, 0, 0);

  page.drawText(`Тус бүр ${model.sample_amount}л`, { x: LAYOUT.x_amount, y: LAYOUT.y_amount, size: 9, font, color: black });
  page.drawText(model.testedDate, { x: LAYOUT.x_tested, y: LAYOUT.y_tested, size: 9, font, color: black });
  page.drawText(model.sampled_date, { x: LAYOUT.x_sampledDate, y: LAYOUT.y_sampledDate, size: 9, font, color: black });
  page.drawText(String(model.tailanDugaar), { x: LAYOUT.x_tailan, y: LAYOUT.y_tailan, size: 9, font, color: black });
  page.drawText(String(model.labDugaar), { x: LAYOUT.x_lab, y: LAYOUT.y_lab, size: 9, font, color: black });
  page.drawText(String(model.tehnikiinShaardlaga), { x: LAYOUT.x_tehnikiinShaardlaga, y: LAYOUT.y_tehnikiinShaardlaga, size: 9, font, color: black });
  page.drawText(String(model.sampled_by ?? ""), { x: LAYOUT.x_sampledBy, y: LAYOUT.y_sampledBy, size: 9, font, color: black });
  page.drawText(String(model.soritsTodorhoilolt ?? ""), { x: LAYOUT.x_soritsType, y: LAYOUT.y_soritsType, size: 9, font, color: black });
}

function drawSampleList(page, sampleBatch, font) {
  const black = rgb(0, 0, 0);

  let y = LAYOUT.sampleListStartY;
  const spacing = sampleBatch.length > 3 ? 8 : 10;

  sampleBatch.forEach((s, i) => {
    page.drawText(`${i + 1}. ${s.id}  ${s.name}`.slice(0, 50), {
      x: LAYOUT.sampleListX,
      y: y - i * spacing,
      size: 8,
      font,
      color: black,
    });
  });
}

function drawSampleHeaders(page, sampleBatch, columns, font) {
  const black = rgb(0, 0, 0);

  sampleBatch.forEach((s, i) => {
    page.drawText(String(s.id), {
      x: columns[i].xHeader+9,         // ✅ header x only
      y: LAYOUT.sampleHeaderY,
      size: 10,
      font,
      color: black,
    });
  });
}

function drawIndicatorRows(page, indicatorChunk, sampleBatch, columns, model, font) {
  const black = rgb(0, 0, 0);

  indicatorChunk.forEach((ind, rowIndex) => {
    const y = LAYOUT.tableTopY - rowIndex * LAYOUT.rowHeight;

    // row number
    page.drawText(String(rowIndex + 1), { x: LAYOUT.noX, y, size: 8, font, color: black });

    // indicator name (2 lines)
    const [line1, line2] = splitTextToLines(ind.name, 15);
    const indicatorNameY = line2 ? y :y - 4
    page.drawText(line1, { x: LAYOUT.indicatorX, y:indicatorNameY, size: 7, font, color: black });
    if (line2) page.drawText(line2, { x: LAYOUT.indicatorX, y1: indicatorNameY - 8, size: 7, font, color: black });

    // method/standard (2 lines)
    const [m1, m2] = splitTextToLines(ind.method, 12);
    const methodY = m2 ? y : y-4;
    page.drawText(m1, { x: LAYOUT.standardX, y:methodY, size: 7, font, color: black });
    if (m2) page.drawText(m2, { x: LAYOUT.standardX, y: methodY - 8, size: 7, font, color: black });

    // limit value
    page.drawText(String(ind.limit ?? "").slice(0, 15), { x: LAYOUT.limitX, y, size: 8, font, color: black });

    // values
    sampleBatch.forEach((s, colIndex) => {
      const val = model.matrix.get(ind.id)?.get(s.id) ?? "";
      const text = String(val).slice(0, 10);
      const textWidth = font.widthOfTextAtSize(text, 8);
      page.drawText(text, {
        x: columns[colIndex].xValue - textWidth / 2 + 28,  // ✅ value x only
        y,
        size: 8,
        font,
        color: black,
      });
    });
  });
}

function drawSignatures(page, model, font) {
  const black = rgb(0, 0, 0);

  // Engineer signature (who performed the tests)
  if (model.signed_by) {
    page.drawText(model.signed_by, { x: 360, y: 137, size: 9, font, color: black });
  }

  // Senior engineer approval signature ("Баталсан" area)
  if (model.report_status === "approved" && model.approved_by) {
    page.drawText(model.approved_by, { x: 360, y: 116, size: 9, font, color: black });
  }
}

/** -------------------- controller -------------------- **/
export async function getReportPdf(req, res) {
  const reportId = Number(req.params.id);
  if (!reportId) return res.status(400).json({ message: "Invalid report id" });

  try {
    const TEMPLATE_PATH = path.join(process.cwd(), "src", "templates", "Microbiology-blank.pdf.pdf");
    const FONT_PATH = path.join(process.cwd(), "src", "fonts", "NotoSans-Regular.ttf");

    const pool = await getConnection();
    const rows = await fetchReportRows(pool, reportId);
    if (!rows.length) return res.status(404).json({ message: "No data for this report" });

    const model = buildModel(rows, reportId);
    if (!model) return res.status(404).json({ message: "No data for this report" });

    // pdf init
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const templateDoc = await PDFDocument.load(templateBytes);

    const outDoc = await PDFDocument.create();
    outDoc.registerFontkit(fontkit);

    const fontBytes = fs.readFileSync(FONT_PATH);
    const font = await outDoc.embedFont(fontBytes);

    // pagination
    const sampleBatches = chunk(model.samples, 3);
    const indicatorChunks = chunk(model.indicators, LAYOUT.rowsPerPage);

    for (const sampleBatch of sampleBatches) {
      const columns = buildSampleColumns(sampleBatch.length);

      for (const indicatorChunk of indicatorChunks) {
        const [page] = await outDoc.copyPages(templateDoc, [0]);
        outDoc.addPage(page);

        drawFixedHeader(page, model, font);
        drawSampleList(page, sampleBatch, font);
        drawSampleHeaders(page, sampleBatch, columns, font);
        drawIndicatorRows(page, indicatorChunk, sampleBatch, columns, model, font);
        drawSignatures(page, model, font);
      }
    }

    const out = await outDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="report-${reportId}.pdf"`);
    res.send(Buffer.from(out));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate pdf", error: String(err?.message ?? err) });
  }
}

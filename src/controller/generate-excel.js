import ExcelJS from "exceljs";
import { getConnection } from "../config/connection-db.js";
import sql from "mssql";

/* ── helpers ────────────────────────────────────────────── */

const fmtDate = (d) =>
  d ? new Date(d).toISOString().slice(0, 10).replace(/-/g, ".") : "";

function parseCfuValue(resultValue) {
  if (!resultValue) return { temp22: "", temp37: "", average: "" };
  try {
    const p = JSON.parse(resultValue);
    if (p && typeof p === "object") return p;
  } catch {}
  return { temp22: "", temp37: "", average: "" };
}

/* ── styles ─────────────────────────────────────────────── */

const thin = { style: "thin", color: { indexed: 64 } };
const allBorders = { top: thin, left: thin, bottom: thin, right: thin };
const font12 = { name: "Times New Roman", size: 12 };
const font11 = { name: "Times New Roman", size: 11 };
const font10 = { name: "Times New Roman", size: 10 };
const centerWrap = { horizontal: "center", vertical: "middle", wrapText: true };
const centerMiddle = { horizontal: "center", vertical: "middle" };

function cell(ws, r, c, value, font = font12, alignment = centerWrap) {
  const cl = ws.getRow(r).getCell(c);
  cl.value = value;
  cl.font = font;
  cl.alignment = alignment;
  cl.border = allBorders;
  return cl;
}

/* ── controller ─────────────────────────────────────────── */

export async function generateExcel(req, res) {
  const status = req.query.status ?? "all";

  try {
    const pool = await getConnection();

    /* 1 ── fetch rows ───────────────────────────────────── */
    const { recordset: dbRows } = await pool
      .request()
      .input("status", sql.NVarChar(50), status)
      .query(`
        SELECT
          s.id   AS sample_id,
          r.id   AS report_id,
          r.test_start_date,
          r.test_end_date,
          s.sample_name,

          i.id             AS indicator_id,
          i.indicator_name,
          i.unit,
          i.input_type,
          i.test_method,
          i.limit_value,

          st.standard AS lab_standard,

          tr.result_value,
          tr.is_detected
        FROM reports r
        JOIN samples s            ON s.report_id = r.id            AND s.status  != 'deleted'
        JOIN sample_indicators si ON si.sample_id = s.id           AND si.status != 'deleted'
        JOIN indicators i         ON i.id = si.indicator_id
        JOIN lab_types st         ON st.id = s.lab_type_id
        LEFT JOIN test_results tr ON tr.sample_indicator_id = si.id
        WHERE r.status != 'deleted'
          AND (@status = 'all' OR r.status = @status)
        ORDER BY r.test_start_date, r.id, s.id, i.id
      `);

    /* 2 ── unique indicators (preserve order) ───────────── */
    const indMap = new Map();
    for (const r of dbRows) {
      if (!indMap.has(r.indicator_id)) {
        indMap.set(r.indicator_id, {
          id: r.indicator_id,
          name: r.indicator_name,
          unit: r.unit,
          test_method: r.test_method,
          limit_value: r.limit_value,
          isCfu: (r.unit || "").toLowerCase().includes("cfu"),
        });
      }
    }
    const indicators = Array.from(indMap.values());
    const labStandard = dbRows[0]?.lab_standard || "";

    /* 3 ── group by sample ──────────────────────────────── */
    const sampleMap = new Map();
    for (const r of dbRows) {
      const key = `${r.report_id}_${r.sample_id}`;
      if (!sampleMap.has(key)) {
        sampleMap.set(key, {
          report_id: r.report_id,
          sample_id: r.sample_id,
          test_start_date: r.test_start_date,
          test_end_date: r.test_end_date,
          sample_name: r.sample_name,
          results: new Map(),
        });
      }
      sampleMap.get(key).results.set(r.indicator_id, {
        result_value: r.result_value,
        is_detected: r.is_detected,
      });
    }
    const samples = Array.from(sampleMap.values());

    /* 4 ── column layout ────────────────────────────────── */
    //  A=Д/д  B=Сорьцын дугаар  C=Эхэлсэн  D=Дууссан  E=Сорьцын нэр
    let col = 6;
    const indCols = indicators.map((ind) => {
      const start = col;
      const count = ind.isCfu ? 3 : 1;
      col += count;
      return { ...ind, startCol: start, endCol: start + count - 1, colCount: count };
    });
    const totalCols = col - 1;
    const firstInd = 6;
    const lastInd = totalCols;

    /* 5 ── workbook & worksheet ─────────────────────────── */
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Тайлан");

    // column widths
    ws.getColumn(1).width = 6.33;
    ws.getColumn(2).width = 10.11;
    ws.getColumn(3).width = 12.44;
    ws.getColumn(4).width = 14.66;
    ws.getColumn(5).width = 40;
    for (const ic of indCols) {
      if (ic.isCfu) {
        ws.getColumn(ic.startCol).width = 10.66;
        ws.getColumn(ic.startCol + 1).width = 10.66;
        ws.getColumn(ic.startCol + 2).width = 10.66;
      } else {
        ws.getColumn(ic.startCol).width = 18.66;
      }
    }

    // row heights
    ws.getRow(1).height = 16.5;
    ws.getRow(2).height = 21.75;
    ws.getRow(3).height = 26.4;
    ws.getRow(4).height = 15.75;
    ws.getRow(5).height = 14.25;
    ws.getRow(6).height = 16.5;

    /* 6 ── 6-row header ─────────────────────────────────── */

    // ── fixed columns ──
    // A1:A6  Д/д
    ws.mergeCells(1, 1, 6, 1);
    cell(ws, 1, 1, "Д/д", font11);

    // B1:B6  Сорьцын дугаар
    ws.mergeCells(1, 2, 6, 2);
    cell(ws, 1, 2, "Сорьцын дугаар");

    // C1:D2  Шинжилгээ
    ws.mergeCells(1, 3, 2, 4);
    cell(ws, 1, 3, "Шинжилгээ ");

    // C3:C6  Эхэлсэн
    ws.mergeCells(3, 3, 6, 3);
    cell(ws, 3, 3, "Эхэлсэн", font11);

    // D3:D6  Дууссан
    ws.mergeCells(3, 4, 6, 4);
    cell(ws, 3, 4, "Дууссан", font11);

    // E1:E6  Сорьцын нэр
    ws.mergeCells(1, 5, 6, 5);
    cell(ws, 1, 5, "Сорьцын нэр");

    // ── indicator columns ──
    if (indCols.length > 0) {
      // Row 1: "Шинжилгээний үзүүлэлт" merged across all indicator cols
      ws.mergeCells(1, firstInd, 1, lastInd);
      cell(ws, 1, firstInd, "Шинжилгээний үзүүлэлт");

      // Row 4: "Зөвшөөрөгдөх хэмжээ /standard/" merged across all indicator cols
      ws.mergeCells(4, firstInd, 4, lastInd);
      cell(ws, 4, firstInd, `Зөвшөөрөгдөх хэмжээ /${labStandard}/`, font11);
    }

    for (const ic of indCols) {
      if (ic.isCfu) {
        // Row 2: indicator name merged across 3 sub-cols
        ws.mergeCells(2, ic.startCol, 2, ic.endCol);
        cell(ws, 2, ic.startCol, "CFU ", font11);

        // Row 3: test method merged across 3 sub-cols
        ws.mergeCells(3, ic.startCol, 3, ic.endCol);
        cell(ws, 3, ic.startCol, `/${ic.test_method}/`, font10);

        // Row 5: limit value merged across 3 sub-cols
        ws.mergeCells(5, ic.startCol, 5, ic.endCol);
        cell(ws, 5, ic.startCol, ic.limit_value || "", font11);

        // Row 6: 22°C / 37°C / Дундаж
        cell(ws, 6, ic.startCol, "22°C");
        cell(ws, 6, ic.startCol + 1, "37°C");
        cell(ws, 6, ic.startCol + 2, "Дундаж");
      } else {
        // Row 2: indicator name
        cell(ws, 2, ic.startCol, ic.name, font11);

        // Row 3: test method
        cell(ws, 3, ic.startCol, `/${ic.test_method}/`, font10);

        // Row 5-6: limit value merged vertically
        ws.mergeCells(5, ic.startCol, 6, ic.startCol);
        cell(ws, 5, ic.startCol, ic.limit_value || "");
      }
    }

    // fill remaining header cells with borders
    for (let r = 1; r <= 6; r++) {
      for (let c = 1; c <= totalCols; c++) {
        const cl = ws.getRow(r).getCell(c);
        if (!cl.border) cl.border = allBorders;
        if (!cl.font) cl.font = font11;
        if (!cl.alignment) cl.alignment = centerWrap;
      }
    }

    /* 7 ── data rows ────────────────────────────────────── */
    samples.forEach((s, idx) => {
      const rn = 7 + idx; // row number
      const row = ws.getRow(rn);

      // A – Д/д
      const cA = row.getCell(1);
      cA.value = idx + 1;
      cA.font = font11;
      cA.alignment = centerMiddle;
      cA.border = allBorders;

      // B – Сорьцын дугаар
      const cB = row.getCell(2);
      cB.value = s.sample_id;
      cB.font = font11;
      cB.alignment = { horizontal: "left" };
      cB.border = allBorders;

      // C – Эхэлсэн
      const cC = row.getCell(3);
      cC.value = fmtDate(s.test_start_date);
      cC.font = font11;
      cC.alignment = centerMiddle;
      cC.border = allBorders;

      // D – Дууссан
      const cD = row.getCell(4);
      cD.value = fmtDate(s.test_end_date);
      cD.font = font11;
      cD.alignment = centerMiddle;
      cD.border = allBorders;

      // E – Сорьцын нэр
      const cE = row.getCell(5);
      cE.value = s.sample_name || "";
      cE.font = font11;
      cE.alignment = { vertical: "middle" };
      cE.border = allBorders;

      // indicator result columns
      for (const ic of indCols) {
        const result = s.results.get(ic.id);

        if (ic.isCfu) {
          const cfu = parseCfuValue(result?.result_value);

          // 22°C
          const c22 = row.getCell(ic.startCol);
          c22.value = cfu.temp22 !== "" ? Number(cfu.temp22) : "";
          c22.font = font11;
          c22.alignment = centerMiddle;
          c22.border = allBorders;

          // 37°C
          const c37 = row.getCell(ic.startCol + 1);
          c37.value = cfu.temp37 !== "" ? Number(cfu.temp37) : "";
          c37.font = font11;
          c37.alignment = centerMiddle;
          c37.border = allBorders;

          // Дундаж  =AVERAGE(Fn:Gn)
          const letter22 = ws.getColumn(ic.startCol).letter;
          const letter37 = ws.getColumn(ic.startCol + 1).letter;
          const cAvg = row.getCell(ic.startCol + 2);
          cAvg.value = { formula: `AVERAGE(${letter22}${rn}:${letter37}${rn})` };
          cAvg.font = font11;
          cAvg.alignment = centerMiddle;
          cAvg.border = allBorders;
        } else {
          // detection
          const cDet = row.getCell(ic.startCol);
          if (result?.is_detected === true) cDet.value = "Илэрсэн";
          else if (result?.is_detected === false) cDet.value = "Илрээгүй";
          else cDet.value = "";
          cDet.font = font11;
          cDet.alignment = centerMiddle;
          cDet.border = allBorders;
        }
      }
    });

    /* 8 ── send response ────────────────────────────────── */
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="reports.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating excel:", error.message);
    res.status(500).json({
      message: "Failed to generate excel",
      error: error.message,
    });
  }
}

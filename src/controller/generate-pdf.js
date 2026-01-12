import fs from "fs";
import path from "path";
import sql from "mssql";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getConnection } from "../config/connection-db.js";

export async function getReportPdf(req, res) {
  const reportId = Number(req.params.id);
  if (!reportId) return res.status(400).json({ message: "Invalid report id" });

  try {
    const TEMPLATE_PATH = path.join(process.cwd(), "src", "templates", "Microbiology-blank.pdf.pdf");
    const FONT_PATH = path.join(process.cwd(), "src", "fonts", "NotoSans-Regular.ttf");
    
    function chunk(arr, size) {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    }

    function splitTextToLines(text, maxLength) {
      if (!text || text.length <= maxLength) {
        return [text || "", ""];
      }
      
      const firstPart = text.slice(0, maxLength);
      const lastSpace = firstPart.lastIndexOf(' ');
      
      if (lastSpace > 0) {
        return [
          text.slice(0, lastSpace).trim(),
          text.slice(lastSpace + 1).slice(0, maxLength).trim()
        ];
      }
      
      return [
        text.slice(0, maxLength).trim(),
        text.slice(maxLength, maxLength * 2).trim()
      ];
    }
    
    const pool = await getConnection();
    const r = await pool.request()
      .input("reportId", sql.Int, reportId)
      .query(`
        SELECT
          r.id AS report_id, r.report_title,
          s.id AS sample_id, s.sample_name,
          i.id AS indicator_id, i.indicator_name, i.test_method, i.limit_value,
          tr.result_value
        FROM reports r
        JOIN samples s ON s.report_id = r.id
        JOIN sample_indicators si ON si.sample_id = s.id
        JOIN indicators i ON i.id = si.indicator_id
        LEFT JOIN test_results tr ON tr.sample_indicator_id = si.id
        WHERE r.id = @reportId
        ORDER BY i.id, s.id;
      `);

    const rows = r.recordset;
    if (rows.length === 0) return res.status(404).json({ message: "No data for this report" });

    const sampleMap = new Map();
    const indicatorMap = new Map();
    const resultsMap = new Map();

    let reportTitle = rows[0].report_title ?? "";

    for (const row of rows) {
      if (!sampleMap.has(row.sample_id)) {
        sampleMap.set(row.sample_id, { id: row.sample_id, sample_name: row.sample_name });
      }
      if (!indicatorMap.has(row.indicator_id)) {
        indicatorMap.set(row.indicator_id, {
          id: row.indicator_id,
          indicator_name: row.indicator_name,
          test_method: row.test_method,
          limit_value: row.limit_value,
        });
      }

      if (!resultsMap.has(row.indicator_id)) resultsMap.set(row.indicator_id, new Map());
      resultsMap.get(row.indicator_id).set(row.sample_id, row.result_value ?? "");
    }

    const samples = Array.from(sampleMap.values());
    const indicators = Array.from(indicatorMap.values());

    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const templateDoc = await PDFDocument.load(templateBytes);
    const outDoc = await PDFDocument.create();

    outDoc.registerFontkit(fontkit);
    
    const fontBytes = fs.readFileSync(FONT_PATH);
    const font = await outDoc.embedFont(fontBytes);
    
    const black = rgb(0, 0, 0);

    const tableTopY = 290;
    const rowHeight = 25;
    const rowsPerPage = 8;

    const noX = 109;
    const indicatorX = 130;
    const standardX = 230;
    const methodX = 309;

    const colX = [460, 530, 600];

    const sampleBatches = chunk(samples, 3);
    const indicatorChunks = chunk(indicators, rowsPerPage);

    for (const sampleBatch of sampleBatches) {
      for (const indicatorChunk of indicatorChunks) {
        const [page] = await outDoc.copyPages(templateDoc, [0]);
        outDoc.addPage(page);

       // Report title at the top (under "Сорьцын нэр:")
page.drawText(String(reportTitle).slice(0, 50), { 
  x: 140, 
  y: 500,  // Top position
  size: 8, 
  font, 
  color: black 
});

// Sample names - each on new line BELOW the report title
let sampleListY = 490; // Start below report title
sampleBatch.forEach((s, i) => {
  page.drawText(String(s.sample_name).slice(0, 50), { 
    x: 140, 
    y: sampleListY - (i * 10), 
    size: 8, 
    font, 
    color: black 
  });
});

        // Sample IDs in column headers
        sampleBatch.forEach((s, i) => {
          page.drawText(String(s.id), { 
            x: colX[i], 
            y: 310, 
            size: 9, 
            font, 
            color: black 
          });
        });

        // Table rows
        indicatorChunk.forEach((ind, rowIndex) => {
          const y = tableTopY - rowIndex * rowHeight;

          page.drawText(String(rowIndex + 1), { x: noX, y, size: 8, font, color: black });
          
          const indicatorText = String(ind.indicator_name ?? "");
          const [line1, line2] = splitTextToLines(indicatorText, 12);
          
          page.drawText(line1, { x: indicatorX, y: y + 5, size: 7, font, color: black });
          if (line2) {
            page.drawText(line2, { x: indicatorX, y: y - 5, size: 7, font, color: black });
          }

          const standardText = String(ind.test_method ?? "");
          const [stdLine1, stdLine2] = splitTextToLines(standardText, 10);
          
          page.drawText(stdLine1, { x: standardX, y: y + 5, size: 7, font, color: black });
          if (stdLine2) {
            page.drawText(stdLine2, { x: standardX, y: y - 5, size: 7, font, color: black });
          }
          
          page.drawText(String(ind.limit_value ?? "").slice(0, 12), { 
            x: methodX, 
            y, 
            size: 7, 
            font, 
            color: black 
          });

          sampleBatch.forEach((s, colIndex) => {
            const val = resultsMap.get(ind.id)?.get(s.id) ?? "";
            page.drawText(String(val).slice(0, 10), { 
              x: colX[colIndex], 
              y, 
              size: 8, 
              font, 
              color: black 
            });
          });
        });
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
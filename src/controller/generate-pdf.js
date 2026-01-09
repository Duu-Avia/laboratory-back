import { getConnection } from '../config/connection-db.js';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generatePDF(req, res) {
  try {
    const sampleId = parseInt(req.params.sampleId);
    const pool = await getConnection();

    const sampleResult = await pool.request()
      .input('sampleId', sampleId)
      .query(`
        SELECT s.*, st.type_name, st.standard
        FROM samples s
        JOIN sample_types st ON s.sample_type_id = st.id
        WHERE s.id = @sampleId
      `);
    const sample = sampleResult.recordset[0];

    const resultsData = await pool.request()
      .input('sampleId', sampleId)
      .query(`
        SELECT 
          i.indicator_name,
          i.test_method,
          i.limit_value,
          tr.result_value,
          tr.is_detected,
          si.analyst,
        FROM sample_indicators si
        JOIN indicators i ON si.indicator_id = i.id
        LEFT JOIN test_results tr ON tr.sample_indicator_id = si.id
        WHERE si.sample_id = @sampleId
      `);
    const results = resultsData.recordset;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=sample_${sampleId}_report.pdf`);
      res.send(pdfBuffer);
    });

    // Register font
    const fontPath = path.join(__dirname, '../fonts/Roboto-Regular.ttf');
    doc.registerFont('Roboto', fontPath);
    doc.font('Roboto');

    // Header
    doc.fontSize(16).text('УСНЫ ШИНЖИЛГЭЭНИЙ ЛАБОРАТОРИ', { align: 'center' });
    doc.fontSize(10).text('Өмнөговь аймаг, Цогтцэций сум, "Ухаа Худаг" уурхай', { align: 'center' });
    doc.moveDown();

    // Title
    doc.fontSize(18).text('СОРИЛТЫН ТАЙЛАН', { align: 'center' });
    doc.moveDown();

    // Sample info
    doc.fontSize(11);
    doc.text(`Сорьцын код: ${sample.sample_code}`);
    doc.text(`Сорьцын нэр: ${sample.sample_name}`);
    doc.text(`Төрөл: ${sample.type_name}`);
    doc.text(`Стандарт: ${sample.standard}`);
    doc.moveDown();

    // Results
    doc.fontSize(12).text('Шинжилгээний үр дүн:', { underline: true });
    doc.moveDown();

    const col1 = 50, col2 = 200, col3 = 350, col4 = 450;
    doc.fontSize(9);
    doc.text('Үзүүлэлт', col1, doc.y);
    doc.text('Зөвшөөрөгдөх', col2, doc.y - 12);
    doc.text('Дүн', col3, doc.y - 12);
    doc.text('Илэрсэн', col4, doc.y - 12);
    doc.moveDown();

    let y = doc.y;
    for (const row of results) {
      doc.text(String(row.indicator_name || ''), col1, y, { width: 140 });
      doc.text(String(row.limit_value || ''), col2, y);
      doc.text(String(row.result_value || '-'), col3, y);
      doc.text(row.is_detected ? 'Тийм' : 'Үгүй', col4, y);
      y += 20;
    }

    doc.moveDown(3);
    doc.text(`Шинжилгээ гүйцэтгэсэн: ${results[0]?.analyst || '-'}`);

    doc.end();
  } catch (error) {
    console.log('PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
}
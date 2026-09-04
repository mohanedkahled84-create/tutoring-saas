import PDFDocument from "pdfkit";

export interface StudentBarcodeItem {
  id: string;
  name: string;
  student_code?: string | null;
  code?: string | null;
}

export interface BarcodeSheetOptions {
  group_name: string;
  students: StudentBarcodeItem[];
}

// Code 39 standard barcode pattern mapping: 'w' = wide bar/space, 'n' = narrow bar/space
const CODE39_PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnnnwnnw",
  "2": "nnwnnwnnw",
  "3": "wnwnnwnnn",
  "4": "nnnnwwnnw",
  "5": "wnnnwwnnn",
  "6": "nnwnwwnnn",
  "7": "nnnnnwwwn",
  "8": "wnnnnwwwn",
  "9": "nnwnnwwwn",
  A: "wnnnnnwwn",
  B: "nnwnnnwwn",
  C: "wnwnnnwnn",
  D: "nnnnwnwwn",
  E: "wnnnwnwnn",
  F: "nnwnwnwnn",
  G: "nnnnnnwwn",
  H: "wnnnnnwnn",
  I: "nnwnnnwnn",
  J: "nnnnwnwnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwnnwnnwn",
  "*": "nwnnwnwnn", // Start/stop delimiter
};

// Draw vector Code 39 barcode onto PDF canvas
export function drawCode39Barcode(
  doc: PDFKit.PDFDocument,
  text: string,
  startX: number,
  startY: number,
  barcodeHeight: number = 28
): void {
  const narrowWidth = 1.1;
  const wideWidth = 2.6;
  const interCharSpace = narrowWidth;

  const fullString = `*${text.toUpperCase()}*`;

  // Calculate total width to center barcode in box
  let totalWidth = 0;
  for (let i = 0; i < fullString.length; i++) {
    const char = fullString[i];
    const pattern = CODE39_PATTERNS[char] || CODE39_PATTERNS["*"];
    for (let p = 0; p < pattern.length; p++) {
      totalWidth += pattern[p] === "w" ? wideWidth : narrowWidth;
    }
    if (i < fullString.length - 1) totalWidth += interCharSpace;
  }

  let currentX = startX - totalWidth / 2;

  for (let i = 0; i < fullString.length; i++) {
    const char = fullString[i];
    const pattern = CODE39_PATTERNS[char] || CODE39_PATTERNS["*"];

    for (let p = 0; p < pattern.length; p++) {
      const isBar = p % 2 === 0; // Even index = bar (black), Odd = space (white)
      const barWidth = pattern[p] === "w" ? wideWidth : narrowWidth;

      if (isBar) {
        doc.rect(currentX, startY, barWidth, barcodeHeight).fill("#000000");
      }

      currentX += barWidth;
    }

    currentX += interCharSpace;
  }
}

// Generates printable A4 PDF sheet (3 cols x 8 rows = 24 cards per page)
export function generateBarcodeSheetPdf(options: BarcodeSheetOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
        autoFirstPage: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 20;

      const cols = 3;
      const rows = 8;
      const perPage = cols * rows; // 24 cards per A4 page

      const cardWidth = (pageWidth - margin * 2) / cols;
      const cardHeight = (pageHeight - margin * 2) / rows;

      const students = options.students;
      const totalPages = Math.max(1, Math.ceil(students.length / perPage));

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        if (pageIdx > 0) {
          doc.addPage({
            size: "A4",
            margins: { top: 20, bottom: 20, left: 20, right: 20 },
          });
        }

        const pageStudents = students.slice(pageIdx * perPage, (pageIdx + 1) * perPage);

        pageStudents.forEach((student, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);

          const x = margin + col * cardWidth;
          const y = margin + row * cardHeight;

          // Dashed border cutting guide
          doc
            .save()
            .dash(3, { space: 2 })
            .lineWidth(0.5)
            .rect(x + 2, y + 2, cardWidth - 4, cardHeight - 4)
            .stroke("#94a3b8")
            .undash()
            .restore();

          // Group Header (Small)
          doc
            .fontSize(7)
            .fillColor("#64748b")
            .text(options.group_name, x + 6, y + 6, {
              width: cardWidth - 12,
              align: "center",
              ellipsis: true,
            });

          // Student Name
          doc
            .fontSize(10)
            .fillColor("#0f172a")
            .text(student.name, x + 6, y + 17, {
              width: cardWidth - 12,
              align: "center",
              ellipsis: true,
            });

          // Barcode vector
          const barcodeCode = student.student_code || student.code || "1001";
          const centerX = x + cardWidth / 2;
          const barcodeY = y + 34;

          drawCode39Barcode(doc, barcodeCode, centerX, barcodeY, 30);

          // Numeric Code underneath barcode
          doc
            .fontSize(8)
            .fillColor("#334155")
            .text(`* ${barcodeCode} *`, x + 6, y + 70, {
              width: cardWidth - 12,
              align: "center",
            });
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

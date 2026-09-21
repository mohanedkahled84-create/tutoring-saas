import test from "node:test";
import assert from "node:assert/strict";

// Helper functions mirroring app.js Smart Import Wizard
function normalizeDigits(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776))
    .trim();
}

function normalizeImportPhone(val) {
  if (!val && val !== 0) return '';
  let digits = normalizeDigits(String(val)).trim().replace(/[^\d+]/g, '');
  if (digits.startsWith('+20')) {
    digits = '0' + digits.slice(3);
  } else if (digits.startsWith('0020')) {
    digits = '0' + digits.slice(4);
  } else if (digits.startsWith('20') && digits.length === 12) {
    digits = '0' + digits.slice(2);
  }
  return digits;
}

function isImportPhoneValid(phone) {
  return /^01[0125]\d{8}$/.test(phone);
}

function parseCsvOrTsv(text) {
  if (!text || typeof text !== 'string') return [];
  const rawLines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (rawLines.length === 0) return [];

  let tabCount = 0, commaCount = 0, semiCount = 0;
  const sampleLines = rawLines.slice(0, Math.min(rawLines.length, 5));
  for (const line of sampleLines) {
    tabCount += (line.match(/\t/g) || []).length;
    commaCount += (line.match(/,/g) || []).length;
    semiCount += (line.match(/;/g) || []).length;
  }

  let delimiter = ',';
  if (tabCount >= commaCount && tabCount >= semiCount && tabCount > 0) {
    delimiter = '\t';
  } else if (semiCount > commaCount && semiCount > tabCount && semiCount > 0) {
    delimiter = ';';
  }

  const rows = [];
  for (const line of rawLines) {
    if (delimiter === '\t') {
      const parts = line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (parts.some(p => p.length > 0)) rows.push(parts);
    } else {
      const row = [];
      let inQuotes = false;
      let currentField = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          row.push(currentField.trim().replace(/^["']|["']$/g, ''));
          currentField = '';
        } else {
          currentField += char;
        }
      }
      row.push(currentField.trim().replace(/^["']|["']$/g, ''));
      if (row.some(p => p.length > 0)) rows.push(row);
    }
  }
  return rows;
}

function detectHeadersAndColumns(rawRows) {
  if (!rawRows || rawRows.length === 0) {
    return { headers: [], dataRows: [], mapping: {} };
  }

  const firstRow = rawRows[0];
  const headerKeywords = [
    'اسم', 'طالب', 'الاسم', 'ولي', 'امر', 'أمر', 'هاتف', 'موبايل', 'تليفون',
    'كود', 'مسلسل', 'باركود', 'مصاريف', 'رسوم', 'name', 'student', 'phone',
    'mobile', 'parent', 'guardian', 'code', 'id', 'fee'
  ];

  const row0HasPhone = firstRow.some(cell => isImportPhoneValid(normalizeImportPhone(cell)));
  const row0KeywordMatches = firstRow.filter(cell => {
    const lower = String(cell).toLowerCase();
    return headerKeywords.some(kw => lower.includes(kw));
  }).length;

  const isHeader = !row0HasPhone && (row0KeywordMatches >= 1 || rawRows.length > 1);

  let headers = [];
  let dataRows = [];

  if (isHeader) {
    headers = firstRow.map((h, i) => {
      const str = String(h || '').trim();
      return str.length > 0 ? str : `العمود ${i + 1}`;
    });
    dataRows = rawRows.slice(1);
  } else {
    headers = firstRow.map((_, i) => `العمود ${i + 1}`);
    dataRows = rawRows;
  }

  const mapping = {
    name: -1,
    parent_phone: -1,
    student_phone: -1,
    code: -1,
    fee: -1,
  };

  const usedCols = new Set();

  headers.forEach((h, colIdx) => {
    const norm = String(h).trim().toLowerCase().replace(/[\s_\-]+/g, '');

    if (mapping.name === -1 && !norm.includes('ولي') && !norm.includes('هاتف') && !norm.includes('موبايل') && !norm.includes('كود')) {
      if (norm.includes('اسم') || norm.includes('طالب') || norm.includes('student') || norm.includes('name')) {
        mapping.name = colIdx;
        usedCols.add(colIdx);
        return;
      }
    }

    if (mapping.parent_phone === -1) {
      if (norm.includes('ولي') || norm.includes('امر') || norm.includes('parent') || norm.includes('guardian') || norm.includes('father')) {
        mapping.parent_phone = colIdx;
        usedCols.add(colIdx);
        return;
      }
    }

    if (mapping.student_phone === -1 && !norm.includes('ولي') && !norm.includes('امر')) {
      if (norm.includes('هاتف') || norm.includes('موبايل') || norm.includes('تليفون') || norm.includes('phone') || norm.includes('mobile')) {
        mapping.student_phone = colIdx;
        usedCols.add(colIdx);
        return;
      }
    }

    if (mapping.code === -1) {
      if (norm.includes('كود') || norm.includes('مسلسل') || norm.includes('باركود') || norm.includes('code') || norm.includes('id')) {
        mapping.code = colIdx;
        usedCols.add(colIdx);
        return;
      }
    }

    if (mapping.fee === -1) {
      if (norm.includes('مصاريف') || norm.includes('رسوم') || norm.includes('اشتراك') || norm.includes('fee') || norm.includes('مبلغ')) {
        mapping.fee = colIdx;
        usedCols.add(colIdx);
        return;
      }
    }
  });

  const sampleRows = dataRows.slice(0, Math.min(dataRows.length, 10));

  const phoneCols = [];
  headers.forEach((_, colIdx) => {
    if (usedCols.has(colIdx)) return;
    let validPhoneCount = 0;
    let totalNonEmpty = 0;
    for (const row of sampleRows) {
      const val = row[colIdx];
      if (val && String(val).trim().length > 0) {
        totalNonEmpty++;
        if (isImportPhoneValid(normalizeImportPhone(val))) {
          validPhoneCount++;
        }
      }
    }
    if (totalNonEmpty > 0 && (validPhoneCount / totalNonEmpty) >= 0.5) {
      phoneCols.push(colIdx);
    }
  });

  for (const pCol of phoneCols) {
    if (mapping.parent_phone === -1) {
      mapping.parent_phone = pCol;
      usedCols.add(pCol);
    } else if (mapping.student_phone === -1) {
      mapping.student_phone = pCol;
      usedCols.add(pCol);
    }
  }

  if (mapping.name === -1) {
    headers.forEach((_, colIdx) => {
      if (usedCols.has(colIdx)) return;
      let arabicNameCount = 0;
      let totalNonEmpty = 0;
      for (const row of sampleRows) {
        const val = String(row[colIdx] || '').trim();
        if (val) {
          totalNonEmpty++;
          const words = val.split(/\s+/);
          if (words.length >= 2 && /^[\u0600-\u06FF\s]+$/.test(val)) {
            arabicNameCount++;
          }
        }
      }
      if (totalNonEmpty > 0 && (arabicNameCount / totalNonEmpty) >= 0.5) {
        mapping.name = colIdx;
        usedCols.add(colIdx);
      }
    });
  }

  if (mapping.code === -1) {
    headers.forEach((_, colIdx) => {
      if (usedCols.has(colIdx)) return;
      let codeCount = 0;
      let totalNonEmpty = 0;
      for (const row of sampleRows) {
        const val = String(row[colIdx] || '').trim();
        if (val) {
          totalNonEmpty++;
          if (/^[a-zA-Z0-9]{2,8}$/.test(val) && !isImportPhoneValid(val)) {
            codeCount++;
          }
        }
      }
      if (totalNonEmpty > 0 && (codeCount / totalNonEmpty) >= 0.6) {
        mapping.code = colIdx;
        usedCols.add(colIdx);
      }
    });
  }

  return { headers, dataRows, mapping };
}

// Tests
test("DEV-IMPORT-WIZARD: Phone Normalization converts Arabic digits and formats Egyptian prefixes", () => {
  assert.equal(normalizeImportPhone("٠١٠١٢٣٤٥٦٧٨"), "01012345678");
  assert.equal(normalizeImportPhone("+20 10 1234 5678"), "01012345678");
  assert.equal(normalizeImportPhone("00201122334455"), "01122334455");
  assert.equal(normalizeImportPhone("201200001111"), "01200001111");
  assert.equal(normalizeImportPhone("01555554444"), "01555554444");

  assert.equal(isImportPhoneValid("01012345678"), true);
  assert.equal(isImportPhoneValid("01122223333"), true);
  assert.equal(isImportPhoneValid("01233334444"), true);
  assert.equal(isImportPhoneValid("01555556666"), true);
  assert.equal(isImportPhoneValid("01999998888"), false); // Invalid 019 prefix
  assert.equal(isImportPhoneValid("0233445566"), false);  // Landline
});

test("DEV-IMPORT-WIZARD: Tab-delimited (Excel copy-paste) with inverted columns and extra columns", () => {
  // Simulating user having parent phone in Col 0, Student name in Col 1, Code in Col 2, Extra cols 3 & 4
  const excelTsv = `رقم ولي الأمر\tاسم الطالب\tكود الطالب\tالمدرسة\tملاحظات
01011112222\tأحمد محمد إبراهيم\t7001\tالأورمان\tطالب جديد
01122223333\tمحمود سعيد علي\t7002\tالسعيدية\tمسدد`;

  const parsed = parseCsvOrTsv(excelTsv);
  assert.equal(parsed.length, 3); // 1 header + 2 data rows

  const detected = detectHeadersAndColumns(parsed);
  assert.equal(detected.mapping.parent_phone, 0, "Parent phone must map to column 0");
  assert.equal(detected.mapping.name, 1, "Student name must map to column 1");
  assert.equal(detected.mapping.code, 2, "Student code must map to column 2");
  assert.equal(detected.dataRows.length, 2);
});

test("DEV-IMPORT-WIZARD: Comma-separated CSV with many columns and non-standard header names", () => {
  const csv = `الرقم القومي,اسم الطالب بالكامل,الفرقة,تليفون ولي الامر,موبايل الطالب,مصاريف شهرية,العنوان
29901011234567,عمر حسن الشريف,الأول الثانوي,01234567890,01512345678,250,الدقي - الجيزة
29901017654321,نوران حسام الدين,الأول الثانوي,01098765432,,250,المهندسين`;

  const parsed = parseCsvOrTsv(csv);
  assert.equal(parsed.length, 3);

  const detected = detectHeadersAndColumns(parsed);
  assert.equal(detected.mapping.name, 1, "Name must map to col 1");
  assert.equal(detected.mapping.parent_phone, 3, "Parent phone must map to col 3");
  assert.equal(detected.mapping.student_phone, 4, "Student phone must map to col 4");
  assert.equal(detected.mapping.fee, 5, "Fee must map to col 5");
});

test("DEV-IMPORT-WIZARD: Content-based heuristic auto-detects columns when headers are absent", () => {
  // File with NO header row, parent phone in col 0, student name in col 1, code in col 2
  const rawRows = [
    ["01055556666", "يوسف عادل خليل", "901"],
    ["01144445555", "سارة طارق فهمي", "902"],
    ["01233332222", "كريم حسام كمال", "903"],
  ];

  const detected = detectHeadersAndColumns(rawRows);
  assert.equal(detected.mapping.parent_phone, 0, "Col 0 contains Egyptian phone numbers");
  assert.equal(detected.mapping.name, 1, "Col 1 contains Arabic names");
  assert.equal(detected.mapping.code, 2, "Col 2 contains short codes");
});

export interface RawStudentRow {
  name?: string;
  parent_phone?: string;
  student_phone?: string;
  code?: string;
  student_code?: string;
  fee_override?: number | string;
  exempt?: boolean | string;
  notes?: string;
  [key: string]: any;
}

export interface ImportResult {
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  errors: Array<{ row: number; name?: string; error: string }>;
  imported_students: Array<{ id: string; name: string; code: string; parent_phone: string }>;
}

// Clean phone number: remove all non-digits except leading +
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  let clean = phone.trim().replace(/[\s\-\(\)\.]/g, "");
  // Normalize Egyptian numbers
  if (clean.startsWith("+20")) clean = clean.slice(3);
  else if (clean.startsWith("0020")) clean = clean.slice(4);
  else if (clean.startsWith("20") && clean.length === 12) clean = clean.slice(2);
  if (!clean.startsWith("0") && clean.length === 10) clean = "0" + clean;
  return clean;
}

export function isValidEgyptianPhone(phone?: string | null): boolean {
  if (!phone) return false;
  const normalized = normalizePhoneNumber(phone);
  return /^01[0125][0-9]{8}$/.test(normalized);
}

// Standard CSV string to row objects parser
export function parseCSV(csvContent: string): Record<string, string>[] {
  // Strip BOM if present
  const content = csvContent.replace(/^\uFEFF/, "").trim();
  if (!content) return [];

  const lines = content.split(/\r\n|\n|\r/);
  if (lines.length < 2) return [];

  // Parse header line
  const headers = parseCSVLine(lines[0]).map((h) => h.trim());

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] !== undefined ? values[idx].trim() : "";
    });

    rows.push(row);
  }

  return rows;
}

// Helper to parse individual CSV line respecting quotes
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Flexible header detection mapping for English and Arabic columns
export function mapRowToStudent(row: Record<string, any>, customMapping?: Record<string, string>): RawStudentRow {
  const normalized: RawStudentRow = {};

  // Default header alias dictionary
  const aliasMap: Record<string, string[]> = {
    name: ["name", "student_name", "الاسم", "اسم الطالب", "طالب", "الاسم ثلاثي"],
    parent_phone: ["parent_phone", "parent_mobile", "ولي الامر", "ولي الأمر", "موبايل ولي الأمر", "هاتف ولي الأمر", "تليفون ولي الأمر", "رقم ولي الامر"],
    student_phone: ["student_phone", "mobile", "phone", "موبايل الطالب", "هاتف الطالب", "تليفون الطالب", "رقم الطالب"],
    code: ["code", "student_code", "serial", "كود", "الكود", "كود الطالب", "مسلسل", "الرقم التعريفي"],
    fee_override: ["fee_override", "price", "fee", "سعر خاص", "قيمة الحصة", "مصاريف"],
    exempt: ["exempt", "معفي", "منحة", "اعفاء", "إعفاء"],
    notes: ["notes", "ملاحظات", "ملاحظة"],
  };

  // If custom mapping provided, apply first
  if (customMapping) {
    for (const [targetKey, sourceColumn] of Object.entries(customMapping)) {
      if (row[sourceColumn] !== undefined) {
        normalized[targetKey as keyof RawStudentRow] = row[sourceColumn];
      }
    }
  }

  // Automatic matching based on aliases if not already filled
  for (const [key, aliases] of Object.entries(aliasMap)) {
    if (normalized[key as keyof RawStudentRow] !== undefined) continue;

    for (const alias of aliases) {
      const foundKey = Object.keys(row).find((k) => k.trim().toLowerCase() === alias.toLowerCase());
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== "") {
        normalized[key as keyof RawStudentRow] = row[foundKey];
        break;
      }
    }
  }

  return normalized;
}

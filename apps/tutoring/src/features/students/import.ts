export interface RawStudentRow {
  name?: string;
  parent_phone?: string;
  student_phone?: string;
  code?: string;
  student_code?: string;
  fee_override?: number | string;
  exempt?: boolean | string;
  notes?: string;
  [key: string]: unknown;
}

export interface ImportResult {
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  errors: Array<{ row: number; name?: string; error: string }>;
  imported_students: Array<{
    id: string;
    name: string;
    code: string;
    parent_phone: string;
    fee_override?: number | null;
    exempt?: boolean | null;
  }>;
}

// Clean phone number: remove all non-digits except leading +, and convert Arabic-Indic digits
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  let clean = phone.trim().replace(/[\s\-().]/g, "");

  // Convert Arabic-Indic digits (٠-٩) to standard ASCII (0-9)
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  for (let i = 0; i < 10; i++) {
    clean = clean.replaceAll(arabicDigits[i], String(i));
  }

  // Normalize Egyptian numbers
  if (clean.startsWith("+20")) clean = clean.slice(3);
  else if (clean.startsWith("0020")) clean = clean.slice(4);
  else if (clean.startsWith("+2")) clean = clean.slice(2);
  else if (clean.startsWith("20") && clean.length === 12) clean = clean.slice(2);
  if (!clean.startsWith("0") && clean.length === 10 && /^[1][0125]/.test(clean)) clean = "0" + clean;
  return clean;
}

export function isValidEgyptianPhone(phone?: string | null): boolean {
  if (!phone) return false;
  const normalized = normalizePhoneNumber(phone);
  return /^01[0125][0-9]{8}$/.test(normalized);
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

// Flexible header detection mapping for English and Arabic columns
export function mapRowToStudent(
  row: Record<string, unknown>,
  customMapping?: Record<string, string>
): RawStudentRow {
  const normalized: RawStudentRow = {};

  // Default header alias dictionary
  const aliasMap: Record<string, string[]> = {
    name: [
      "name",
      "student_name",
      "student name",
      "الاسم",
      "اسم الطالب",
      "طالب",
      "الاسم ثلاثي",
      "الاسم رباعي",
      "اسم الطالب ثلاثي",
      "اسم الطالب رباعي",
      "full name",
      "fullname",
    ],
    parent_phone: [
      "parent_phone",
      "parent_mobile",
      "parent phone",
      "parent mobile",
      "ولي الامر",
      "ولي الأمر",
      "موبايل ولي الأمر",
      "موبايل ولي الامر",
      "هاتف ولي الأمر",
      "هاتف ولي الامر",
      "تليفون ولي الأمر",
      "تليفون ولي الامر",
      "تلفون ولي الأمر",
      "تلفون ولي الامر",
      "رقم ولي الامر",
      "رقم ولي الأمر",
      "رقم تليفون ولي الامر",
      "رقم تليفون ولي الأمر",
      "رقم هاتف ولي الامر",
      "رقم هاتف ولي الأمر",
      "رقم الاب",
      "هاتف الاب",
      "تليفون الاب",
      "موبايل الاب",
      "رقم الام",
      "هاتف الام",
      "father_phone",
      "father phone",
    ],
    student_phone: [
      "student_phone",
      "student phone",
      "student_mobile",
      "student mobile",
      "mobile",
      "phone",
      "موبايل الطالب",
      "هاتف الطالب",
      "تليفون الطالب",
      "تلفون الطالب",
      "رقم الطالب",
      "رقم تليفون الطالب",
      "رقم هاتف الطالب",
      "رقم موبايل الطالب",
      "رقم الهاتف",
      "رقم التليفون",
      "رقم الموبايل",
      "الهاتف",
      "الموبايل",
      "التليفون",
    ],
    code: [
      "code",
      "student_code",
      "student code",
      "serial",
      "id",
      "كود",
      "الكود",
      "كود الطالب",
      "مسلسل",
      "الرقم التعريفي",
      "رقم الجلوس",
      "رقم الطالب التعريفي",
    ],
    fee_override: ["fee_override", "price", "fee", "سعر خاص", "قيمة الحصة", "مصاريف", "سعر الحصة", "السعر"],
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

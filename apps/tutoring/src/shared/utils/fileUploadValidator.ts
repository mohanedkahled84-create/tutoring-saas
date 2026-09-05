import crypto from "node:crypto";
import path from "node:path";

export interface FileUploadValidationInput {
  buffer: Buffer;
  originalFilename: string;
  declaredMimeType?: string;
  maxSizeBytes?: number;
  allowedMimes?: string[];
}

export interface FileUploadValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFilename?: string;
  detectedMimeType?: string;
  extension?: string;
}

const DEFAULT_ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const EXTENSION_MIME_MAP: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".pdf": ["application/pdf"],
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

/**
 * Inspects binary magic bytes to determine the true content type.
 */
export function detectMimeTypeFromMagicBytes(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: 'RIFF' at 0..4 and 'WEBP' at 8..12
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  // PDF: %PDF (25 50 44 46)
  if (buffer.toString("ascii", 0, 4) === "%PDF") {
    return "application/pdf";
  }

  return null;
}

/**
 * Validates an uploaded file according to GAP.4 policy rules:
 * 1. Checks magic bytes (never trusts client headers).
 * 2. Checks allowed extensions and blocks multi-extension evasion.
 * 3. Enforces maximum file size limit.
 * 4. Generates a server-side random UUID filename.
 */
export function validateFileUpload(input: FileUploadValidationInput): FileUploadValidationResult {
  const {
    buffer,
    originalFilename,
    declaredMimeType,
    maxSizeBytes = 5 * 1024 * 1024, // 5MB default
    allowedMimes = DEFAULT_ALLOWED_MIMES,
  } = input;

  // 1. Buffer existence and size checks
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: "File buffer is empty" };
  }

  if (buffer.length > maxSizeBytes) {
    return {
      isValid: false,
      error: `File size exceeds allowed limit of ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
    };
  }

  // 2. Extension check & path traversal prevention
  const cleanOriginal = path.basename(originalFilename || "").trim().toLowerCase();
  const ext = path.extname(cleanOriginal);

  if (!ext || !EXTENSION_MIME_MAP[ext]) {
    return {
      isValid: false,
      error: `File extension '${ext}' is not permitted. Allowed: ${Object.keys(EXTENSION_MIME_MAP).join(", ")}`,
    };
  }

  // Check for dangerous double extensions (e.g., shell.php.png or invoice.exe.jpg)
  const nameParts = cleanOriginal.split(".");
  if (nameParts.length > 2) {
    const forbiddenSubExtensions = ["php", "phtml", "exe", "sh", "bat", "cmd", "js", "mjs", "html", "htm", "svg", "dll", "bin"];
    for (let i = 1; i < nameParts.length - 1; i++) {
      if (forbiddenSubExtensions.includes(nameParts[i])) {
        return {
          isValid: false,
          error: `Dangerous secondary extension '.${nameParts[i]}' detected in filename`,
        };
      }
    }
  }

  // 3. Inspect magic bytes
  const detectedMime = detectMimeTypeFromMagicBytes(buffer);
  if (!detectedMime) {
    return {
      isValid: false,
      error: "Could not identify valid file signature (magic bytes mismatch or unknown format)",
    };
  }

  if (!allowedMimes.includes(detectedMime)) {
    return {
      isValid: false,
      error: `Detected file type '${detectedMime}' is not permitted`,
    };
  }

  // 4. Verify extension matches detected magic bytes
  const allowedExtensionsForMime = EXTENSION_MIME_MAP[ext];
  if (!allowedExtensionsForMime || !allowedExtensionsForMime.includes(detectedMime)) {
    return {
      isValid: false,
      error: `File extension '${ext}' does not match detected content type '${detectedMime}'`,
    };
  }

  // 5. If declared MIME type provided, verify consistency
  if (declaredMimeType && declaredMimeType.toLowerCase() !== detectedMime.toLowerCase()) {
    return {
      isValid: false,
      error: `Declared MIME type '${declaredMimeType}' conflicts with true content signature '${detectedMime}'`,
    };
  }

  // 6. Generate secure random filename
  const canonicalExt = MIME_EXTENSION_MAP[detectedMime] || ext;
  const sanitizedFilename = `${crypto.randomUUID()}${canonicalExt}`;

  return {
    isValid: true,
    sanitizedFilename,
    detectedMimeType: detectedMime,
    extension: canonicalExt,
  };
}

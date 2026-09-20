import test from "node:test";
import assert from "node:assert/strict";
import { validateFileUpload } from "../dist/shared/utils/fileUploadValidator.js";
import { homeworkSubmissionRateLimiter } from "../dist/shared/middleware/rateLimit.js";

// ============================================================================
// C-05: Secure File Uploads Audit Test
// ============================================================================

test("C-05: Magic bytes validation strictly permits legitimate PDFs, PNGs, and JPEGs", () => {
  // Valid PDF header (%PDF-1.4)
  const validPdfBuffer = Buffer.concat([
    Buffer.from("%PDF-1.4\n%test\n"),
    Buffer.alloc(1024, 0x20),
  ]);
  const pdfResult = validateFileUpload({
    buffer: validPdfBuffer,
    originalFilename: "homework-solution.pdf",
    declaredMimeType: "application/pdf",
    maxSizeBytes: 10 * 1024 * 1024,
  });
  assert.equal(pdfResult.isValid, true, "Valid PDF must pass file validation");
  assert.equal(pdfResult.detectedMimeType, "application/pdf");
  assert.ok(pdfResult.sanitizedFilename?.endsWith(".pdf"));

  // Valid PNG header (\x89PNG\r\n\x1a\n)
  const validPngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(1024, 0x00),
  ]);
  const pngResult = validateFileUpload({
    buffer: validPngBuffer,
    originalFilename: "diagram.png",
    declaredMimeType: "image/png",
    maxSizeBytes: 10 * 1024 * 1024,
  });
  assert.equal(pngResult.isValid, true, "Valid PNG must pass file validation");
  assert.equal(pngResult.detectedMimeType, "image/png");
  assert.ok(pngResult.sanitizedFilename?.endsWith(".png"));

  // Valid JPEG header (\xFF\xD8\xFF)
  const validJpgBuffer = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
    Buffer.alloc(1024, 0x00),
  ]);
  const jpgResult = validateFileUpload({
    buffer: validJpgBuffer,
    originalFilename: "assignment_photo.jpg",
    declaredMimeType: "image/jpeg",
    maxSizeBytes: 10 * 1024 * 1024,
  });
  assert.equal(jpgResult.isValid, true, "Valid JPEG must pass file validation");
  assert.equal(jpgResult.detectedMimeType, "image/jpeg");
  assert.ok(jpgResult.sanitizedFilename?.endsWith(".jpg"));
});

test("C-05: Malicious and disguised files are strictly blocked", () => {
  // Disguised script disguised as PDF (does not start with %PDF magic bytes)
  const fakePdf = Buffer.from("echo 'unauthorized script execution';");
  const fakePdfResult = validateFileUpload({
    buffer: fakePdf,
    originalFilename: "homework.pdf",
    declaredMimeType: "application/pdf",
    maxSizeBytes: 10 * 1024 * 1024,
  });
  assert.equal(fakePdfResult.isValid, false, "Disguised text file as PDF must be blocked");

  // Non-image file disguised as PNG
  const fakePng = Buffer.from("INVALID_PNG_BINARY_DATA_CORRUPT");
  const fakePngResult = validateFileUpload({
    buffer: fakePng,
    originalFilename: "homework.png",
    declaredMimeType: "image/png",
    maxSizeBytes: 10 * 1024 * 1024,
  });
  assert.equal(fakePngResult.isValid, false, "Disguised binary without PNG header must be blocked");

  // Double extension evasion (e.g. exploit.php.pdf)
  const doubleExtPdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(100)]);
  const doubleExtResult = validateFileUpload({
    buffer: doubleExtPdf,
    originalFilename: "exploit.php.pdf",
    declaredMimeType: "application/pdf",
    maxSizeBytes: 10 * 1024 * 1024,
  });
  assert.equal(doubleExtResult.isValid, false, "Double extension containing .php must be blocked");

  // HTML / JS payload disguised as PDF
  const xssPdf = Buffer.from("<html><body>test</body></html>");
  const xssResult = validateFileUpload({
    buffer: xssPdf,
    originalFilename: "assignment.pdf",
    declaredMimeType: "application/pdf",
    maxSizeBytes: 10 * 1024 * 1024,
  });
  assert.equal(xssResult.isValid, false, "HTML payload disguised as PDF must be blocked");
});

test("C-05: Enforces 10MB size limit", () => {
  // 11MB buffer exceeds limit
  const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024, 0x20);
  oversizedBuffer.write("%PDF-1.4", 0);

  const sizeResult = validateFileUpload({
    buffer: oversizedBuffer,
    originalFilename: "giant_homework.pdf",
    declaredMimeType: "application/pdf",
    maxSizeBytes: 10 * 1024 * 1024,
  });
  assert.equal(sizeResult.isValid, false, "Files exceeding 10MB must be rejected");
  assert.match(sizeResult.error || "", /limit/i, "Error message must indicate size limit");
});

test("C-05: Homework submission rate limiter is properly instantiated", () => {
  assert.ok(typeof homeworkSubmissionRateLimiter === "function", "homeworkSubmissionRateLimiter middleware must exist");
});

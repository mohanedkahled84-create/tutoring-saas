# File Upload Security Policy (GAP.4)

**Document Version**: 1.0  
**Status**: Active / Mandatory Policy  
**Effective Date**: 2026-09-05  
**Applicability**: All backend services, endpoints, serverless functions, and file storage layers across Centrly / Tutoring SaaS.

---

## 1. Overview & Threat Model

Although the core MVP does not expose general file upload forms, any future endpoint accepting file uploads (e.g., payment proof slips, national ID verification, teacher profile photos, center logos, student CSV rosters) represents a critical attack surface. 

Unrestricted or improperly validated file uploads introduce severe security risks:
- **Remote Code Execution (RCE)**: Uploading server-side executable scripts (`.php`, `.jsp`, `.sh`, `.exe`, `.js`, `.py`) that may be interpreted by the server or storage tier.
- **Path Traversal / Arbitrary File Overwrite**: User-supplied filenames like `../../etc/passwd` or `../../../public/bundle.js` overwriting critical system or application assets.
- **Stored Cross-Site Scripting (Stored XSS)**: Uploading SVG or HTML files containing embedded `<script>` tags that execute in the victim's browser when viewed.
- **Denial of Service (DoS) / Zip Bombs**: Massive files or archive bombs exhausting disk space, RAM, or bandwidth.
- **MIME Confusion / Content Sniffing Attacks**: Providing executable payloads disguised with deceptive extensions or fake `Content-Type` headers.

---

## 2. Mandatory Security Rules

Every file upload handler in the codebase **MUST** adhere to the following 5 non-negotiable rules:

### Rule 1: Never Trust Client-Reported MIME Types (Enforce Magic Bytes Verification)
The `Content-Type` header sent by browsers and HTTP clients is entirely user-controlled and trivial to forge. 
- All uploaded file buffers **must be inspected for magic bytes** (file signatures) at the beginning of the file.
- Allowed MIME types and their authoritative file signatures:
  - `image/jpeg` (`FF D8 FF`)
  - `image/png` (`89 50 4E 47 0D 0A 1A 0A`)
  - `image/webp` (`52 49 46 46` ... `57 45 42 50`)
  - `application/pdf` (`25 50 44 46` - `%PDF`)
- Any file whose magic bytes do not match an allowlisted signature must be immediately rejected with HTTP 400 `INVALID_FILE_TYPE`.

### Rule 2: Strict Extension Allowlist (No Dangerous Extensions)
- Only the following lowercase extensions are permitted:
  - `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`
- Double extensions (e.g. `invoice.pdf.exe` or `avatar.php.png`) must be detected and rejected.
- Executable, script, or markup extensions are strictly forbidden: `.php`, `.phtml`, `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.mjs`, `.html`, `.htm`, `.svg`, `.xml`, `.dll`, etc.

### Rule 3: Server-Side Random Filename Generation
- **Never reuse client-supplied filenames or file paths.**
- The server must generate a cryptographically random UUID v4 filename upon ingest:
  ```typescript
  const safeFilename = `${crypto.randomUUID()}${allowedExtension}`;
  ```
- All client-supplied path components (`../`, `..\`, `/`, `\`, null bytes `%00`) are discarded automatically by using only the random UUID.

### Rule 4: Strict File Size Limits
- Maximum upload size limits must be enforced at both the reverse proxy / web server layer and the application parsing layer:
  - **Images (profile photo, payment proof)**: Maximum 5 MB (`5 * 1024 * 1024` bytes).
  - **Documents (PDF verification)**: Maximum 10 MB (`10 * 1024 * 1024` bytes).
  - **CSV Imports**: Maximum 2 MB (`2 * 1024 * 1024` bytes).
- Payloads exceeding these limits must be rejected with HTTP 413 `PAYLOAD_TOO_LARGE`.

### Rule 5: Safe Storage and Delivery Isolation
- Files must be stored outside the web server root (in private object storage, e.g., Supabase Storage / S3 / GCS).
- When serving user-uploaded files:
  - Set `Content-Disposition: attachment; filename="safe_name.ext"` where applicable.
  - Set `X-Content-Type-Options: nosniff`.
  - Ensure uploaded content is served with appropriate `Content-Security-Policy: sandbox` to prevent script execution even if an attacker attempts SVG/HTML smuggling.

---

## 3. Standard Utility Implementation

All services must import and execute the centralized validator from `src/shared/utils/fileUploadValidator.ts`:

```typescript
import { validateFileUpload } from "../../shared/utils/fileUploadValidator.js";

const result = validateFileUpload({
  buffer: uploadedFileBuffer,
  originalFilename: req.file.originalname,
  declaredMimeType: req.file.mimetype,
  maxSizeBytes: 5 * 1024 * 1024,
});

if (!result.isValid) {
  return res.status(400).json({ error: { code: "INVALID_UPLOAD", message: result.error } });
}

// Proceed using result.sanitizedFilename and result.detectedMimeType
```

---

## 4. Compliance & Verification
Any pull request or development task introducing an upload endpoint will be audited against this policy prior to acceptance. Unit tests must explicitly verify:
1. Rejection of forged MIME types (e.g., PHP script with `image/jpeg` header).
2. Rejection of dangerous file extensions.
3. Enforcement of maximum file size limits.
4. Correct generation of sanitized UUID filenames.

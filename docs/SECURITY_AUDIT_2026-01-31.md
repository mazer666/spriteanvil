# SpriteAnvil Security Audit Report

**Audit Date:** 2026-01-31  
**Auditor:** Antigravity AI  
**Project:** SpriteAnvil Pixel Art Editor  
**Status:** Comprehensive Security Review Complete

---

## Executive Summary

This report documents a comprehensive security review of the SpriteAnvil codebase. The application is a React/TypeScript-based pixel art editor with Supabase backend integration, AI-powered features, and real-time collaboration capabilities.

**Overall Security Posture:** The codebase demonstrates good security practices in several areas (XSS prevention, API key encryption), but has identified vulnerabilities and areas requiring attention before production deployment.

**Critical Findings:** 2 Medium Priority, 5 High Priority  
**Total Issues Identified:** 15

---

## 🔴 Critical Priority Issues

### None identified

---

## 🟠 High Priority Issues

### 1. **Dependency Vulnerabilities - esbuild/vite**

**Location:** `package.json`, `node_modules/`  
**Severity:** High  
**Type:** Third-party Dependency Vulnerability

**Description:**  
npm audit revealed 2 moderate vulnerabilities in development dependencies:

- `esbuild` (<=0.24.2): CVE enabling any website to send requests to development server and read responses
- `vite` (0.11.0 - 6.1.6): Indirectly affected through esbuild dependency

**Evidence:**

```json
{
  "vulnerabilities": {
    "moderate": 2,
    "total": 2
  },
  "esbuild": {
    "severity": "moderate",
    "cwe": ["CWE-346"],
    "cvss": 5.3
  }
}
```

**Impact:**

- Development server could be exploited to leak sensitive information
- Cross-origin attacks possible during development
- Could expose environment variables or project structure

**Recommendation:**

```bash
# Update to latest versions
npm install vite@^7.3.1 --save-dev
npm audit fix
```

**Priority:** Fix before deploying to production or running public development servers

---

### 2. **Unvalidated JSON Parsing from localStorage**

**Location:** `src/App.tsx:175-182`  
**Severity:** High  
**Type:** Data Validation / Injection

**Description:**  
The application parses JSON from localStorage without proper validation, which could lead to code execution or application crashes if malicious data is injected.

**Vulnerable Code:**

```typescript
function loadLocalProjects(): Project[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Project[];  // ⚠️ No validation
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse local projects:", error);
    return [];
  }
}
```

**Attack Vector:**  
An attacker with access to browser developer tools or a malicious browser extension could inject crafted JSON that causes:

- Type confusion attacks
- Prototype pollution
- Application crashes
- Unexpected behavior in project loading

**Recommendation:**

1. Implement schema validation using a library like Zod or Yup
1. Validate all fields of parsed projects
1. Sanitize data before using it in the application

**Example Fix:**

```typescript
import { z } from 'zod';

const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(255),
  user_id: z.string(),
  // ... define all fields
});

function loadLocalProjects(): Project[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    
    // Validate each project
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(p => ProjectSchema.safeParse(p).success)
      .map(p => ProjectSchema.parse(p));
  } catch (error) {
    console.warn("Failed to parse local projects:", error);
    return [];
  }
}
```

---

### 3. **Missing CSRF Protection for Supabase Operations**

**Location:** `src/lib/supabase/projects.ts`, `src/lib/supabase/frames.ts`, `src/lib/supabase/sprites.ts`  
**Severity:** High  
**Type:** Cross-Site Request Forgery (CSRF)

**Description:**  
Supabase client operations lack CSRF token validation. While Supabase has built-in protections, additional client-side validation is recommended.

**Affected Operations:**

- Project creation/deletion (`createProject`, `deleteProject`)
- Frame operations (`deleteFrame`)
- Database mutations

**Recommendation:**

1. Verify Supabase RLS policies are properly configured
1. Implement additional CSRF tokens for sensitive operations
1. Add confirmation dialogs for destructive actions (already partially implemented)
1. Consider implementing a challenge-response mechanism for critical operations

---

### 4. **Environment Variable Exposure Risk**

**Location:** `src/config.ts`, `index.html`  
**Severity:** High  
**Type:** Information Disclosure

**Description:**  
Environment variables are loaded from `import.meta.env` and could be exposed if not properly handled during build.

**Current Implementation:**

```typescript
export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ""
}
```

**Concerns:**

1. `.env` files properly ignored in `.gitignore` ✅
1. No `.env.example` template provided ⚠️
1. Anonymous key is safe to expose (by design) ✅
1. No service role key in frontend code ✅
1. Missing Content Security Policy headers ⚠️

**Recommendation:**

1. Create `.env.example` template:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Add CSP meta tag to `index.html`:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: blob:; 
               connect-src 'self' https://*.supabase.co https://openrouter.ai;">
```

3. Document security expectations in README

---

### 5. **Real-time Collaboration Message Validation**

**Location:** `src/App.tsx:626-654`  
**Severity:** High  
**Type:** Input Validation / Remote Code Execution

**Description:**  
Real-time collaboration events (cursor positions, pixel updates) are not validated before processing.

**Vulnerable Code:**

```typescript
channel.on("broadcast", { event: "pixel-update" }, ({ payload }) => {
  if (!payload || payload.userId === localUserId) return;
  const { frameId, layerId, patch } = payload as {  // ⚠️ Type assertion without validation
    userId: string;
    frameId: string;
    layerId: string;
    patch: number[];
  };
  if (!frameId || !layerId || !Array.isArray(patch)) return;
  // ... applies patch directly
});
```

**Attack Vector:**  
A malicious collaborator could send:

- Extremely large patches causing memory exhaustion
- Invalid pixel indices causing buffer overflow
- Malformed data causing application crashes

**Recommendation:**

1. Validate all incoming broadcast messages
1. Implement size limits for patches
1. Validate pixel indices are within buffer bounds
1. Rate limit incoming updates per user
1. Implement user trust levels or permissions

**Example Fix:**

```typescript
const MAX_PATCH_SIZE = 10000; // Max pixels per update
const MAX_UPDATES_PER_SECOND = 30;

channel.on("broadcast", { event: "pixel-update" }, ({ payload }) => {
  if (!isValidPixelUpdate(payload)) {
    console.warn("Invalid pixel update received", payload);
    return;
  }
  
  // Rate limiting
  if (isRateLimited(payload.userId)) {
    return;
  }
  
  // Apply update
  applyPixelUpdate(payload);
});

function isValidPixelUpdate(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.userId === localUserId) return false;
  
  const { frameId, layerId, patch } = payload;
  
  if (typeof frameId !== 'string' || !frameId) return false;
  if (typeof layerId !== 'string' || !layerId) return false;
  if (!Array.isArray(patch)) return false;
  if (patch.length > MAX_PATCH_SIZE * 5) return false; // 5 values per pixel
  
  // Validate patch structure
  for (let i = 0; i < patch.length; i += 5) {
    const pixelIndex = patch[i];
    if (typeof pixelIndex !== 'number' || pixelIndex < 0) return false;
    // Validate RGBA values
    for (let j = 1; j <= 4; j++) {
      const val = patch[i + j];
      if (typeof val !== 'number' || val < 0 || val > 255) return false;
    }
  }
  
  return true;
}
```

---

## 🟡 Medium Priority Issues

### 6. **AI API Key Storage Security**

**Location:** `src/lib/ai/keys.ts`  
**Severity:** Medium  
**Type:** Cryptographic Implementation

**Description:**  
AI API keys are encrypted using AES-GCM with user-provided passphrase. While the encryption is properly implemented, there are concerns:

**Current Implementation:** ✅ Good

- Uses Web Crypto API
- AES-GCM with 256-bit key
- PBKDF2 with 120,000 iterations
- Unique IV for each encryption
- Salt for key derivation

**Concerns:**

1. Passphrase strength not enforced
1. No password complexity requirements
1. Keys stored in Supabase `users.ai_keys` field (centralized risk)
1. No key rotation mechanism
1. Decryption errors not logged for security monitoring

**Recommendation:**

1. Implement passphrase strength requirements (min 12 chars, complexity)
1. Add passphrase strength meter in UI
1. Implement key rotation policy
1. Consider hardware-backed encryption where available
1. Add security event logging

---

### 7. **Missing Rate Limiting on AI Requests**

**Location:** `src/lib/ai/providers.ts:84-130`  
**Severity:** Medium  
**Type:** Resource Exhaustion / Cost

**Description:**  
AI image generation requests to OpenRouter lack rate limiting, potentially causing:

- Unexpected API costs
- Resource exhaustion
- Account suspension

**Vulnerable Code:**

```typescript
generate: async (request: AIRequest, apiKey: string): Promise<AIResult> => {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      // ... no rate limiting
    },
    // ...
  });
}
```

**Recommendation:**

1. Implement client-side rate limiting (max requests per minute)
1. Add request queue with backpressure
1. Display cost estimates before generation
1. Implement usage tracking and warnings
1. Cache recent results to avoid duplicate requests

---

### 8. **Prototype Pollution Risk in Pixel Buffer Operations**

**Location:** `src/App.tsx:189-217`, `src/editor/pixels.ts`  
**Severity:** Medium  
**Type:** Prototype Pollution

**Description:**  
While no direct prototype pollution was found, the extensive use of object spreading and array operations could be vulnerable if user-controlled data reaches these functions.

**Affected Functions:**

- `buildPixelPatch()`
- `applyPixelPatch()`
- Pixel buffer manipulation functions

**Recommendation:**

1. Use `Object.create(null)` for patch objects
1. Freeze prototype objects
1. Validate all indices before array access
1. Use TypeScript strict mode (already enabled ✅)

---

### 9. **Missing HTTP Security Headers**

**Location:** `index.html`, Vite configuration  
**Severity:** Medium  
**Type:** Security Headers

**Description:**  
The application lacks security headers for production deployment.

**Missing Headers:**

- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- Referrer-Policy

**Recommendation:**  
Add to `index.html`:

```html
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="referrer" content="strict-origin-when-cross-origin">
```

For production deployment, configure server-side headers in hosting platform.

---

### 10. **Insufficient Error Messages Sanitization**

**Location:** Multiple files, e.g., `src/lib/ai/providers.ts:114-115`  
**Severity:** Medium  
**Type:** Information Disclosure

**Description:**  
Error messages from external APIs are directly displayed to users without sanitization.

**Example:**

```typescript
throw new Error(`OpenRouter Error: ${error?.error?.message || response.statusText}`);
```

**Risk:**

- Could leak internal API structure
- Expose backend implementation details
- Reveal API keys in error traces

**Recommendation:**

1. Sanitize all error messages before display
1. Log full errors server-side only
1. Show generic error messages to users
1. Implement error code system

---

## 🟢 Low Priority / Informational

### 11. **localStorage Size Limits Not Enforced**

**Location:** `src/App.tsx`, `src/lib/storage/frameCache.ts`  
**Severity:** Low  
**Type:** Resource Management

**Description:**  
Projects are saved to localStorage without size checking. Large projects could exceed browser limits (typically 5-10MB).

**Recommendation:**

1. Check available space before saving
1. Implement storage quota monitoring
1. Migrate to IndexedDB for large projects (already using for cache ✅)
1. Add user warnings for large projects

---

### 12. **No Input Length Limits on Text Fields**

**Location:** UI components (project names, descriptions, etc.)  
**Severity:** Low  
**Type:** Resource Exhaustion

**Description:**  
Text inputs lack maximum length validation in UI, though database may have limits.

**Recommendation:**  
Add `maxLength` attributes to inputs:

```tsx
<input maxLength={255} ... />
<textarea maxLength={1000} ... />
```

---

### 13. **Weak Cursor Position Broadcast Throttling**

**Location:** `src/App.tsx:lastCursorBroadcastRef`  
**Severity:** Low  
**Type:** Performance / Resource Usage

**Description:**  
Cursor position broadcasts are throttled but implementation details not visible in reviewed code.

**Recommendation:**  
Ensure minimum throttle interval of 50-100ms to prevent network flooding.

---

### 14. **No Integrity Checking on Imported Files**

**Location:** Palette import functionality  
**Severity:** Low  
**Type:** Data Integrity

**Description:**  
Imported palette files are not checked for integrity or malicious content.

**Recommendation:**

1. Validate file format and structure
1. Sanitize color values
1. Implement file size limits
1. Check for malicious payloads in JSON

---

### 15. **Session Persistence Without Timeout**

**Location:** `src/lib/supabase/client.ts:88-93`  
**Severity:** Low  
**Type:** Session Management

**Description:**  
Supabase session persistence is enabled without apparent timeout configuration.

**Current Config:**

```typescript
auth: {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true
}
```

**Recommendation:**

1. Configure session timeout in Supabase dashboard
1. Implement idle timeout detection
1. Add "Remember me" option for session persistence
1. Clear sensitive data on logout

---

## ✅ Security Strengths Identified

1. **No XSS Vulnerabilities:** No use of `innerHTML` or `dangerouslySetInnerHTML` ✅
1. **No eval() Usage:** No dangerous code execution patterns ✅
1. **Proper API Key Encryption:** AI keys encrypted with AES-GCM ✅
1. **.env Files Ignored:** Environment files properly excluded from git ✅
1. **TypeScript Strict Mode:** Strong type checking enabled ✅
1. **Supabase RLS Mentioned:** Row Level Security referenced in comments ✅
1. **IndexedDB for Caching:** Proper use of IndexedDB instead of localStorage for large data ✅
1. **Anonymous Key Usage:** Correctly using Supabase anonymous key (not service role key) ✅

---

## Recommended Actions (Prioritized)

### Immediate (Before Next Release)

1. ✅ Update vite and esbuild dependencies
1. ✅ Add JSON schema validation to localStorage parsing
1. ✅ Validate real-time collaboration messages
1. ✅ Create `.env.example` file
1. ✅ Add basic security headers to `index.html`

### Short Term (Next Sprint)

1. Implement AI request rate limiting
1. Add input length validation to all text fields
1. Implement error message sanitization
1. Add localStorage quota monitoring
1. Document security configuration in README

### Medium Term (Next Quarter)

1. Implement CSRF tokens for sensitive operations
1. Add Content Security Policy (CSP) enforcement
1. Implement session timeout/idle detection
1. Add security event logging
1. Conduct penetration testing
1. Implement key rotation for encrypted AI keys

### Long Term (Roadmap)

1. Security audit of Supabase RLS policies
1. Implement security monitoring and alerting
1. Add bug bounty program
1. Regular dependency audits (automated)
1. Security training for contributors

---

## Additional Security Considerations

### For Production Deployment

- [ ] Enable HTTPS only (HSTS)
- [ ] Configure CORS properly in Supabase
- [ ] Set up CDN with DDoS protection
- [ ] Implement API rate limiting server-side
- [ ] Regular automated security scans
- [ ] Incident response plan
- [ ] Regular backups with encryption

### For Contributors

- [ ] Security guidelines in CONTRIBUTING.md
- [ ] Code review checklist including security
- [ ] Automated security linting
- [ ] Dependency update policy
- [ ] Secrets scanning in CI/CD

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [React Security Best Practices](https://react.dev/learn/security)
- CVE Database for identified vulnerabilities

---

## Conclusion

SpriteAnvil demonstrates a solid foundation with good security practices in key areas. The identified issues are typical for applications in active development and can be addressed systematically. The highest priority should be given to dependency updates, input validation, and real-time collaboration security before production deployment.

**Risk Level:** Medium  
**Recommended Action:** Address High Priority issues before production deployment  
**Next Review:** After implementing recommended fixes

---

**End of Report**

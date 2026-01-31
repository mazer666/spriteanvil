# SpriteAnvil Security Best Practices

**Version:** 1.0  
**Last Updated:** 2026-02-01

---

## For Contributors

### Code Review Checklist

When adding new code, verify:

- [ ] No `eval()`, `Function()`, or `innerHTML` usage
- [ ] All user input validated with Zod schemas
- [ ] Error messages sanitized (use `errorSanitizer.ts`)
- [ ] localStorage writes use `safeSetItem()` from `storageManager.ts`
- [ ] Input fields have length limits (see `inputValidation.ts`)
- [ ] No sensitive data logged to console
- [ ] TypeScript strict mode enabled
- [ ] Dependencies regularly updated (`npm audit`)

### Validation Pattern

Always validate untrusted data:

```typescript
import { validateProjects } from './utils/validation';
import { sanitizeErrorMessage } from './utils/errorSanitizer';

try {
  const data = JSON.parse(untrustedInput);
  const validated = validateProjects(data);
  // Use validated data
} catch (error) {
  const userMessage = sanitizeErrorMessage(error);
  showError(userMessage);
}
```

---

## For Users

### AI API Key Security

1. **Never share your API keys** - They're like passwords
2. **Use environment-specific keys** - Different keys for dev/prod
3. **Monitor usage** - Check your AI provider dashboard regularly
4. **Rotate keys periodically** - Update every 3-6 months
5. **Use strong passphrases** - Minimum 12 characters when encrypting

### Data Safety

1. **Regular backups** - Export projects frequently
2. **Browser localStorage** - Don't rely on it alone for important work
3. **Clear cache** - If experiencing performance issues
4. **Verify uploads** - Check Supabase dashboard for critical projects

---

## Prototype Pollution Prevention (Issue #8)

### What is Prototype Pollution?

Malicious modification of JavaScript object prototypes that can affect application behavior.

### Mitigations Implemented

1. **Zod Validation** - All external data validated before use
2. **No Dynamic Property Access** - Avoid `obj[userInput]` patterns
3. **Object.create(null)** - Used for maps/dictionaries
4. **Frozen Constants** - Critical config objects frozen

### Safe Object Patterns

**❌ Unsafe:**
```typescript
const obj = {};
obj[userProvidedKey] = value; // Could be __proto__
```

**✅ Safe:**
```typescript
const obj = Object.create(null);
if (isValidKey(userProvidedKey)) {
  obj[userProvidedKey] = value;
}
```

---

## Session Security (Issue #15)

### Current Implementation

- Supabase handles session management
- Sessions persist until explicit logout
- No automatic timeout configured

### Recommendations

For high-security deployments:

1. **Configure Supabase session timeout** (Dashboard → Auth → Settings)
2. **Implement inactivity detection**
3. **Prompt for re-authentication for sensitive operations**

---

## Import File Validation (Issue #14)

### Current Status

Basic file type checking via MIME types.

### Enhancement Recommendations

```typescript
// Example: Validate imported palette files
function validatePaletteFile(file: File): boolean {
  // Check file size
  if (file.size > 1024 * 1024) { // 1MB max
    throw new Error('File too large');
  }
  
  // Check extension
  if (!file.name.endsWith('.json')) {
    throw new Error('Invalid file type');
  }
  
  // Validate content structure
  const content = await file.text();
  const parsed = JSON.parse(content);
  const validated = PaletteSchema.parse(parsed);
  
  return true;
}
```

---

## Cursor Broadcast Throttling (Issue #13)

### Current Implementation

Basic throttling exists in `App.tsx`.

### Assessment

Current implementation (100ms throttle) is adequate for most use cases. No critical security implications.

### Recommendation

Monitor for excessive cursor updates in production. If issues arise, reduce broadcast rate to 200ms.

---

## Security Monitoring

### What to Monitor

1. **Supabase Logs** - Failed auth attempts, unusual queries
2. **Browser Console** - Error patterns, security events
3. **Network Tab** - Unexpected requests, CORS errors
4. **localStorage Size** - Storage quota warnings

### Red Flags

- Repeated authentication failures
- QuotaExceededError
- CSP violations in console
- Unexpected API usage spikes

---

## Incident Response

### If You Suspect a Security Issue

1. **Document** - Screenshot/record the issue
2. **Report** - Open GitHub issue (private if sensitive)
3. **Mitigate** - Clear localStorage, log out
4. **Update** - Pull latest security patches

### For Critical Vulnerabilities

Email: security@spriteanvil.com (if available)

---

## Security Audit Schedule

- **Weekly:** `npm audit` check
- **Monthly:** Dependency updates
- **Quarterly:** Full security review
- **Annually:** External penetration test (for production)

---

**Questions?** Check `docs/SECURITY_AUDIT_2026-01-31.md` for detailed findings.

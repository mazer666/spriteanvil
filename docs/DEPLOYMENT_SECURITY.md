# SpriteAnvil Security Deployment Guide

**Version:** 1.0  
**Last Updated:** 2026-02-01  
**Audience:** DevOps, System Administrators, Deployment Engineers

---

## Overview

This guide provides platform-specific instructions for deploying SpriteAnvil with proper security headers and configurations. All deployments must implement the security requirements outlined below.

---

## Required Security Headers

All hosting platforms must serve these HTTP headers:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://openrouter.ai wss://*.supabase.co; worker-src 'self' blob:;
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

> **Note:** Some headers are already configured in `index.html` via meta tags, but server-side headers take precedence and provide better security.

---

## Platform-Specific Configuration

### Vercel

**File:** `vercel.json` (create at project root)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://openrouter.ai wss://*.supabase.co; worker-src 'self' blob:;"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "Permissions-Policy",
          "value": "geolocation=(), microphone=(), camera=()"
        }
      ]
    }
  ]
}
```

**Deployment:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

---

### Netlify

**File:** `netlify.toml` (create at project root)

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://openrouter.ai wss://*.supabase.co; worker-src 'self' blob:;"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Deployment:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

---

### Cloudflare Pages

**Configuration:** Via Cloudflare Dashboard

1. Go to your Cloudflare Pages project
2. Navigate to **Settings** → **Custom Headers**
3. Add the following headers:

| Header | Value |
|--------|-------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://openrouter.ai wss://*.supabase.co; worker-src 'self' blob:;` |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| Strict-Transport-Security | max-age=31536000; includeSubDomains |
| Permissions-Policy | geolocation=(), microphone=(), camera=() |

**Deployment:**
```bash
npm run build
npx wrangler pages publish dist
```

---

### AWS S3 + CloudFront

**CloudFront Configuration:**

1. Create/edit CloudFront distribution
2. Under **Behaviors** → **Edit** → **Response Headers Policy**:
   - Create custom policy with headers above
   
**Example CloudFront Response Headers Policy (JSON):**

```json
{
  "ResponseHeadersPolicyConfig": {
    "Name": "SpriteAnvil-Security-Headers",
    "SecurityHeadersConfig": {
      "ContentSecurityPolicy": {
        "ContentSecurityPolicy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://openrouter.ai wss://*.supabase.co; worker-src 'self' blob:;",
        "Override": true
      },
      "FrameOptions": {
        "FrameOption": "DENY",
        "Override": true
      },
      "ContentTypeOptions": {
        "Override": true
      },
      "ReferrerPolicy": {
        "ReferrerPolicy": "strict-origin-when-cross-origin",
        "Override": true
      },
      "StrictTransportSecurity": {
        "AccessControlMaxAgeSec": 31536000,
        "IncludeSubdomains": true,
        "Override": true
      }
    }
  }
}
```

---

### Nginx

**File:** `/etc/nginx/sites-available/spriteanvil`

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Security Headers
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://openrouter.ai wss://*.supabase.co; worker-src 'self' blob:;" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    root /var/www/spriteanvil/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Reload Nginx:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Environment Variables

### Required Variables

Create `.env` file (never commit this!):

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Development flags
VITE_DEV_MODE=false
```

### Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] Environment variables set in hosting platform dashboard
- [ ] No secrets in client-side code
- [ ] Supabase RLS policies enabled
- [ ] Only anonymous key used in frontend (not service role key)

---

## SSL/TLS Configuration

### Requirements

- ✅ TLS 1.2 or higher
- ✅ Strong cipher suites only
- ✅ HSTS enabled (see headers above)
- ✅ Certificate from trusted CA (Let's Encrypt recommended)

### Let's Encrypt (Certbot)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (runs twice daily)
sudo systemctl enable certbot.timer
```

---

## CORS Configuration

Configure in Supabase Dashboard:

1. Go to **Settings** → **API** → **CORS**
2. Add your production domain(s):
   ```
   https://yourdomain.com
   ```
3. **Never** use `*` in production

---

## Rate Limiting (Optional)

For additional protection, configure platform-level rate limiting:

### Cloudflare

- Free tier: 10,000 requests/month
- Rate Limiting Rules: 100 requests/minute per IP

### Nginx

```nginx
# Add to http block
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;

# Add to location block
location / {
    limit_req zone=general burst=20 nodelay;
    # ... rest of config
}
```

---

## Monitoring & Alerting

### Recommended Tools

1. **Uptime Monitoring:** UptimeRobot, Pingdom
2. **Error Tracking:** Sentry, Rollbar
3. **Performance:** Lighthouse CI, WebPageTest
4. **Security Scanning:** OWASP ZAP, Security Headers

### Security Scan Checklist

Before production:

```bash
# Check security headers
curl -I https://yourdomain.com

# Run Lighthouse audit
npx lighthouse https://yourdomain.com --view

# Check SSL configuration
https://www.ssllabs.com/ssltest/
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Update dependencies: `npm audit fix`
- [ ] Run tests: `npm test`
- [ ] Build production: `npm run build`
- [ ] Verify no console errors
- [ ] Check security headers in build
- [ ] Verify environment variables

### Post-Deployment

- [ ] SSL certificate valid
- [ ] Security headers present (use curl or browser dev tools)
- [ ] CSP not blocking resources
- [ ] Supabase connection working
- [ ] AI features functional (if enabled)
- [ ] Real-time collaboration working
- [ ] No console errors in production

### Security Verification

```bash
# Test headers
curl -I https://yourdomain.com | grep -E "X-Frame|Content-Security|X-Content"

# Expected output:
# content-security-policy: default-src 'self'...
# x-frame-options: DENY
# x-content-type-options: nosniff
```

---

## Incident Response

### Security Incident Protocol

1. **Detect:** Monitor logs and error tracking
2. **Assess:** Determine severity and impact
3. **Contain:** Block malicious IPs, disable affected features
4. **Remediate:** Patch vulnerabilities, update dependencies
5. **Document:** Record incident details and response
6. **Review:** Update security measures

### Emergency Contacts

- Supabase Support: https://supabase.com/support
- Hosting Platform Support: (varies by platform)

---

## Additional Resources

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Security Headers Scanner](https://securityheaders.com/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/going-into-prod)

---

**Last Updated:** 2026-02-01  
**Maintained By:** SpriteAnvil Security Team

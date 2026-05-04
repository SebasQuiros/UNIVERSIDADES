# Cloudflare — Setup gratis (10 min)

Cloudflare Free pone su red CDN/WAF entre el internet y tu VPS. Beneficios reales:

- DDoS protection automático (mitiga ataques de capa 3/4 sin que llegues a verlos)
- WAF con reglas OWASP (bloquea SQLi, XSS conocidos, scanners)
- Bot scoring (bloquea scrapers automáticos antes de llegar a tu nginx)
- Logs de cada request bloqueado
- TLS 1.3 + DNSSEC gratis
- Caché de assets estáticos (te ahorra ancho de banda)

**Costo:** $0/mes en el plan Free. No hay límite de tráfico.

---

## Paso 1 — Crear cuenta y agregar el dominio

1. Andá a https://dash.cloudflare.com/sign-up y crea cuenta.
2. Click "Add a site" → escribí tu dominio (ej. `sjqa.utn.ac.cr`).
3. Plan: **Free**.
4. Cloudflare escanea tus DNS records existentes — verificá que estén todos.

## Paso 2 — Cambiar nameservers en tu registrador

Cloudflare te dará 2 nameservers (ej. `ada.ns.cloudflare.com`).
Andá a tu registrador (NIC.cr para .cr, GoDaddy, Namecheap, etc.) y cambiá los nameservers a los de Cloudflare.

DNS propaga en 5 min – 24 h. Cloudflare te avisa por email.

## Paso 3 — Configuración recomendada (en el dashboard de Cloudflare)

### SSL/TLS
- **Encryption mode:** `Full (strict)` — exige que tu nginx tenga TLS válido detrás. Como ya configuramos certbot en `docker-compose.prod.yml`, esto funciona out-of-the-box.
- Activá: **Always Use HTTPS**, **Automatic HTTPS Rewrites**, **TLS 1.3**.

### Security
- **Security Level:** `Medium` (Free tier).
- **Bot Fight Mode:** ON (gratis).
- **Browser Integrity Check:** ON.
- **Challenge Passage:** 30 minutos.

### Firewall Rules (gratis: 5 reglas)

Recomendadas:

```
Rule 1: Block traffic from countries you don't serve
   (http.request.method eq "POST") and (ip.geoip.country ne "CR")
   → Action: Managed Challenge

Rule 2: Block known bad user-agents (scrapers)
   (lower(http.user_agent) contains "wget") or
   (lower(http.user_agent) contains "curl/") or
   (lower(http.user_agent) contains "python-requests") or
   (http.user_agent eq "")
   → Action: Block

Rule 3: Rate limit login endpoint (Free tier permite 1 regla)
   (http.request.uri.path eq "/api/v1/auth/login")
   → Action: Rate Limit (10 req/min/IP)

Rule 4: Bloquear acceso directo al backend (que solo pase por dominio principal)
   (http.host ne "tudominio.cr") and (http.host ne "www.tudominio.cr")
   → Action: Block
```

### Network
- **HTTP/3 (QUIC):** ON (más rápido en mobile).
- **0-RTT Connection Resumption:** ON.

### Caching
- **Browser Cache TTL:** 4 hours.
- **Always Online:** ON (sirve versión cacheada si tu servidor cae).

### Page Rules (Free: 3 reglas)

```
1. tudominio.cr/api/*
   → Cache Level: Bypass (no cachear API)

2. tudominio.cr/_next/static/*
   → Cache Level: Cache Everything
   → Edge Cache TTL: 1 month
```

---

## Paso 4 — Verificar que funciona

```bash
curl -sI https://tudominio.cr | grep -iE "cf-ray|server"
# Esperado: server: cloudflare, cf-ray: <valor>
```

Si ves `cf-ray`, el tráfico está pasando por Cloudflare. Si no, revisá DNS.

---

## Por qué esto te protege específicamente

- **Bots/scrapers buscando data de estudiantes:** bloqueados antes de llegar al backend (no consumen tu rate limiter).
- **Scans de vulnerabilidades automáticos** (Nikto, sqlmap básico): bloqueados por WAF.
- **DDoS de un competidor o estudiante enojado:** Cloudflare absorbe el tráfico, tu VPS ni se entera.
- **Geo-blocking:** si el ataque viene de Rusia/China, ni llega.
- **TLS al día:** Cloudflare maneja la cipher suite y rotación de protocolos sin que tengas que pensar.

---

## Lo único que perdés

- **IPs reales en logs:** Cloudflare le envía a tu nginx un header `CF-Connecting-IP` con la IP real del cliente. Tenés que configurar nginx para usarla en logs y rate limiting (1 línea en config).
- Configuración correcta de nginx detrás de Cloudflare:
  ```nginx
  set_real_ip_from 173.245.48.0/20;   # rangos oficiales de Cloudflare
  set_real_ip_from 103.21.244.0/22;
  set_real_ip_from 103.22.200.0/22;
  # ... lista completa: https://www.cloudflare.com/ips/
  real_ip_header CF-Connecting-IP;
  ```
  Copia esto al inicio del bloque `server` en `deploy/nginx.prod.conf.template`.

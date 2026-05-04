# Cumplimiento — Ley 8968 (CR Protección de Datos)

Costa Rica regula el tratamiento de datos personales mediante la
**Ley N° 8968** y su reglamento. PRODHAB (Agencia de Protección de Datos
de los Habitantes) es la autoridad.

Para una plataforma educativa que maneja:
- Nombres, correos institucionales y contactos de estudiantes
- Notas / calificaciones
- Datos de "empresas ficticias" inventadas por los alumnos

estás dentro del scope de la ley.

**No es opcional.** Sanciones por incumplimiento: 1 a 30 salarios base
(~₡462k–₡13.8M / 2026), más eventuales daños civiles en caso de breach.

---

## Checklist mínimo

### 1. Inscribir la base de datos ante PRODHAB
- Trámite: https://www.prodhab.go.cr/
- Costo: ₡30,000 — vigencia 5 años.
- Requiere: descripción de la base, finalidad, medidas de seguridad, encargado de tratamiento.
- **Estimado:** 1 día hábil de trabajo administrativo.

### 2. Publicar Política de Privacidad accesible
- Link visible en el footer del sitio público (ej. `/politica-privacidad`).
- Template gratis abajo en este doc.

### 3. Obtener consentimiento explícito
- Al registrarse: checkbox **NO premarcado** que diga
  "He leído y acepto la Política de Privacidad y autorizo el tratamiento
   de mis datos para fines educativos."
- Guardar `acceptedTermsAt: timestamp` en la tabla `users`. (Ya tenés algo similar en onboarding — verificá que se persista).

### 4. Acuerdo de Tratamiento de Datos (DPA) con UTN
- La UTN te da los emails y nombres de los estudiantes → ellos son el "responsable",
  vos sos el "encargado de tratamiento".
- Firmar DPA donde se diga: qué datos te dan, para qué los usás, cómo los protegés,
  cuándo los borrás, qué pasa si hay breach.
- Template gratis: PRODHAB tiene modelos.
- **Estimado:** 1 reunión + revisión legal (UTN tiene departamento jurídico que ya lo vio antes).

### 5. Procedimiento de respuesta a incidentes (Breach Notification)
- Si pasa un breach: notificar a PRODHAB en máximo **5 días hábiles**.
- Notificar a los afectados "sin demora indebida".
- Tener escrito UN documento que diga: quién decide, a quién se llama, qué se comunica.
- Template abajo.

### 6. Derechos ARCO de los usuarios
La ley exige que el usuario pueda:
- **A**cceder a sus datos
- **R**ectificarlos
- **C**ancelarlos (=borrarlos)
- **O**ponerse al tratamiento

Estado actual del sistema:
- ✅ Acceso: usuario puede ver su perfil en `/perfil`.
- ✅ Rectificación: puede editar nombre/avatar en `/perfil`.
- ✅ Cancelación: implementado endpoint `DELETE /api/v1/auth/me` (anonimiza).
- ⚠️ Oposición: no aplica explícitamente (no hay opt-in de marketing). OK por defecto.

### 7. Conservación limitada
- No conservar datos más de lo necesario.
- Recomendación: borrar/anonimizar cuentas de estudiantes **2 años después**
  de su último login (la mayoría se gradúa en menos de eso).
- Implementar: cron job que llame `deleteAccount` para usuarios con
  `lastLogin < now - 2 years`.

---

## Política de Privacidad — TEMPLATE

> Pegalo en `frontend/src/app/(public)/politica-privacidad/page.tsx` y ajustá
> los valores entre `[corchetes]`.

```
POLÍTICA DE PRIVACIDAD — SJQA GROUP
Vigente desde: [DD/MM/AAAA]

1. Identidad del responsable
   SJQA GROUP, [cédula jurídica], [dirección], correo: [contacto@sjqa.cr]

2. Datos que recopilamos
   - Nombre completo y correo institucional (provisto por la universidad)
   - Datos de actividad académica (ejercicios, calificaciones, tiempo de uso)
   - Direcciones IP y user-agent del navegador (para seguridad y auditoría)
   - Datos opcionales que el usuario ingresa al practicar (cédula jurídica
     ficticia, nombre de empresa simulada, etc.)

3. Finalidad
   - Brindar el servicio educativo contratado por la universidad
   - Generar reportes de avance académico para el profesor y el administrador
     institucional
   - Mejorar la calidad del servicio mediante análisis agregado y anónimo
   - Cumplir obligaciones legales

4. Base legal
   - Consentimiento del titular al registrarse
   - Contrato con la universidad ([UTN])
   - Obligación legal (Ley 8968)

5. Conservación
   Los datos se conservan mientras el usuario tenga cuenta activa y hasta
   2 años después de su último acceso. Posteriormente se anonimizan.
   Los registros contables y de auditoría se conservan 5 años por requisitos
   tributarios y de auditoría.

6. Cesión a terceros
   No vendemos ni cedemos datos a terceros con fines comerciales.
   Encargados de tratamiento: [proveedor de hosting], [Backblaze para backups],
   [Cloudflare para CDN]. Todos contractualmente obligados a proteger los datos.

7. Derechos del titular (ARCO)
   Podés acceder, rectificar, cancelar tus datos u oponerte al tratamiento
   escribiendo a [privacidad@sjqa.cr] o usando las funciones del sistema:
   - Editar perfil: /perfil
   - Eliminar cuenta: /perfil/seguridad → "Eliminar mi cuenta"

8. Seguridad
   Aplicamos medidas técnicas y organizativas razonables: cifrado en
   tránsito (TLS 1.3), control de accesos, auditoría continua, backups
   cifrados offsite, autenticación de dos factores para administradores.

9. Notificación de incidentes
   En caso de breach que comprometa datos personales, notificaremos a
   PRODHAB en 5 días hábiles y a los afectados sin demora indebida.

10. Modificaciones
    Avisaremos a los usuarios con 30 días de anticipación a cualquier
    cambio sustancial.

11. Autoridad de control
    Agencia de Protección de Datos de los Habitantes (PRODHAB)
    https://www.prodhab.go.cr — Costa Rica
```

---

## Procedimiento de Breach — TEMPLATE 1 página

> Imprimilo, leelo cuando todo esté tranquilo, guardalo donde lo encuentres
> en pánico.

```
PROTOCOLO DE INCIDENTE DE SEGURIDAD — SJQA GROUP

PASO 1 — DETECTAR (en cualquier momento)
   Disparadores:
     · Alerta de "BULK_READ_DETECTED" en activity_logs
     · Alerta de "AUTH_LOCKOUT" persistente del mismo IP
     · Aviso externo (cliente, investigador, redes sociales)
     · Caída inexplicable + datos faltantes/modificados

PASO 2 — CONTENER (primeras 2 horas)
   Si el atacante está activo:
     1. Cambiar JWT_SECRET y REFRESH_SECRET (todos los logueados pierden sesión)
     2. Cambiar POSTGRES_PASSWORD y REDIS_PASSWORD
     3. Activar Cloudflare "Under Attack Mode"
     4. Si fue por cuenta admin comprometida: forzar logout-all + reset password

   Si ya pasó (data breach pasivo):
     1. Identificar qué tablas/registros están comprometidos
     2. Preservar logs y dumps de DB para forense (NO reiniciar/limpiar todavía)

PASO 3 — INVESTIGAR (24-48 h)
   Revisar:
     · activity_logs últimas 30 días
     · Cloudflare logs últimas 30 días
     · Backend logs (docker logs contafacil_backend --since 30d)
     · DB: SELECT * FROM users WHERE updatedAt > X;
   Determinar:
     · Vector de entrada
     · Qué se accedió/modificó
     · Cuántos usuarios afectados y quiénes

PASO 4 — NOTIFICAR (en 5 días hábiles)
   PRODHAB: https://www.prodhab.go.cr/notificacion-incidente
     · Fecha del incidente
     · Naturaleza de los datos afectados
     · Número de afectados
     · Medidas adoptadas

   Universidades afectadas: email a su contacto institucional + DPA designado
     · Mismo contenido que PRODHAB
     · Coordinar comunicado conjunto a estudiantes si corresponde

   Usuarios afectados: email individual sin demora
     · Qué pasó (sin tecnicismos)
     · Qué deben hacer (cambiar password, activar 2FA si no lo tenían)
     · Cómo contactarte

PASO 5 — CORREGIR
   · Parchar la vulnerabilidad
   · Forzar password change a todos los afectados
   · Auditar accesos privilegiados de los últimos 90 días
   · Documentar lecciones aprendidas

CONTACTOS
   Tú (responsable): [nombre / tel / email]
   Hosting: [proveedor / soporte 24/7]
   Cloudflare: dashboard
   Asesor legal: [opcional pero recomendado]
   PRODHAB: 2202-0700, info@prodhab.go.cr
```

---

## Costo total estimado para cumplir

| Item | Costo único | Anual |
|---|---|---|
| Inscripción PRODHAB (cada 5 años) | ₡30,000 | ₡6,000/año amortizado |
| Asesoría legal puntual (revisión de templates) | ₡100,000–200,000 | — |
| Backblaze B2 (backups offsite) | — | ~₡5,000/año |
| Cloudflare Free | — | ₡0 |
| Tu tiempo (setup inicial) | ~8 horas | — |

**Total año 1:** ~₡200,000 incluyendo asesoría.
**Anual recurrente:** ₡11,000 (PRODHAB + B2).

Sobre tu presupuesto de ₡2,500,000/año, eso es <1%.

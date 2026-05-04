import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Métricas personalizadas ───────────────────────────────────
const loginErrors   = new Counter('login_errors');
const apiErrors     = new Counter('api_errors');
const loginRate     = new Rate('login_success_rate');
const apiDuration   = new Trend('api_duration', true);

// ── Escenarios: rampa hasta 1200 VUs ─────────────────────────
export const options = {
  scenarios: {
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100  }, // rampa a 100
        { duration: '30s', target: 300  }, // rampa a 300
        { duration: '30s', target: 600  }, // rampa a 600
        { duration: '60s', target: 1200 }, // pico: 1200 usuarios
        { duration: '30s', target: 0    }, // bajada
      ],
    },
  },
  thresholds: {
    http_req_duration:    ['p(95)<2000'],  // 95% de requests < 2s
    http_req_failed:      ['rate<0.05'],   // menos del 5% de errores
    login_success_rate:   ['rate>0.95'],   // 95%+ de logins exitosos
  },
};

const BASE = 'http://host.docker.internal';  // acceso al host desde Docker

// Usuarios de prueba (seed)
const USERS = [
  { email: 'admin@contafacil.cr',       password: 'Admin2026!' },
  { email: 'profesor@contafacil.cr',    password: 'Profesor2026!' },
  { email: 'estudiante1@contafacil.cr', password: 'Estudiante1-2026!' },
  { email: 'estudiante2@contafacil.cr', password: 'Estudiante2-2026!' },
];

export default function () {
  const user = USERS[Math.floor(Math.random() * USERS.length)];

  // ── 1. Login ──────────────────────────────────────────────
  const loginRes = http.post(
    `${BASE}/api/v1/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { 'Content-Type': 'application/json' }, timeout: '10s' },
  );

  const loginOk = check(loginRes, {
    'login status 2xx': (r) => r.status >= 200 && r.status < 300,
    'tiene access_token': (r) => {
      try { return !!JSON.parse(r.body).access_token; } catch { return false; }
    },
  });

  loginRate.add(loginOk);
  if (!loginOk) { loginErrors.add(1); sleep(1); return; }

  const token = JSON.parse(loginRes.body).access_token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  sleep(0.5);

  // ── 2. Requests autenticados ──────────────────────────────
  const endpoints = [
    '/api/v1/notifications',
    '/api/v1/attempts',
    '/api/v1/universities',
  ];

  for (const ep of endpoints) {
    const start = Date.now();
    const res = http.get(`${BASE}${ep}`, { headers, timeout: '10s' });
    apiDuration.add(Date.now() - start);

    const ok = check(res, {
      [`${ep} status ok`]: (r) => r.status < 400,
    });
    if (!ok) apiErrors.add(1);
    sleep(0.2);
  }

  // ── 3. Frontend ───────────────────────────────────────────
  const frontRes = http.get(`${BASE}/login`, { timeout: '10s' });
  check(frontRes, { 'frontend 200': (r) => r.status === 200 });

  sleep(Math.random() * 2);
}

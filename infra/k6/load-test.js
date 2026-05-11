/**
 * k6 Load Test — Amdox ERP API
 * Target: 2000 concurrent VUs, 10-minute steady state
 * Run: k6 run infra/k6/load-test.js --env BASE_URL=https://api.amdox.dev
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const apiLatency = new Trend('api_latency', true);
const authLatency = new Trend('auth_latency', true);
const glLatency = new Trend('gl_latency', true);

export const options = {
  stages: [
    { duration: '2m', target: 500 },    // Ramp-up to 500 VUs
    { duration: '2m', target: 1000 },   // Ramp-up to 1000 VUs
    { duration: '2m', target: 2000 },   // Ramp-up to 2000 VUs
    { duration: '10m', target: 2000 },  // Steady state: 2000 VUs for 10 min
    { duration: '2m', target: 0 },      // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95th percentile < 500ms
    http_req_failed: ['rate<0.01'],                    // Error rate < 1%
    error_rate: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Shared auth token (obtain once, reuse per VU)
let authToken = null;

function authenticate() {
  const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: 'test@amdox.dev',
    password: 'Test@1234!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, { 'login 200': (r) => r.status === 200 });
  authLatency.add(res.timings.duration);

  if (res.status === 200) {
    return JSON.parse(res.body).accessToken;
  }
  return null;
}

export function setup() {
  const token = authenticate();
  return { token };
}

export default function (data) {
  const token = data.token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  group('Health Checks', () => {
    const res = http.get(`${BASE_URL}/health/live`);
    check(res, { 'health 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    apiLatency.add(res.timings.duration);
  });

  group('GL - Journal Entries', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/finance/gl/journal-entries?page=1&limit=20`, { headers });
    check(res, {
      'GL list 200': (r) => r.status === 200,
      'GL response time < 300ms': (r) => r.timings.duration < 300,
    });
    errorRate.add(res.status !== 200);
    glLatency.add(res.timings.duration);
  });

  group('HR - Employees', () => {
    const res = http.get(`${BASE_URL}/api/v1/hr/employees?page=1&limit=20`, { headers });
    check(res, { 'employees 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    apiLatency.add(res.timings.duration);
  });

  group('Inventory', () => {
    const res = http.get(`${BASE_URL}/api/v1/supply-chain/inventory?page=1&limit=20`, { headers });
    check(res, { 'inventory 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    apiLatency.add(res.timings.duration);
  });

  group('BI Dashboard Metrics', () => {
    const res = http.get(`${BASE_URL}/api/v1/bi/dashboard/metrics`, { headers });
    check(res, {
      'metrics 200': (r) => r.status === 200,
      'metrics < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(res.status !== 200);
    apiLatency.add(res.timings.duration);
  });

  group('Create Journal Entry (write load)', () => {
    const payload = JSON.stringify({
      description: `Load test entry ${Date.now()}`,
      entryDate: new Date().toISOString(),
      lines: [
        { accountId: 'acc-cash', type: 'DEBIT', amount: 1000, currency: 'USD' },
        { accountId: 'acc-revenue', type: 'CREDIT', amount: 1000, currency: 'USD' },
      ],
    });
    const res = http.post(`${BASE_URL}/api/v1/finance/gl/journal-entries`, payload, { headers });
    check(res, { 'create JE 201': (r) => r.status === 201 });
    errorRate.add(res.status >= 400);
    apiLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 2 + 0.5); // Random think time 0.5-2.5s
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'infra/k6/results/load-test-results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, opts) {
  return `
=== AMDOX ERP LOAD TEST RESULTS ===
VUs: 2000 peak | Duration: 10-min steady state
p50: ${data.metrics.http_req_duration?.values?.['p(50)']?.toFixed(2)}ms
p95: ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2)}ms  
p99: ${data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(2)}ms
Error rate: ${(data.metrics.http_req_failed?.values?.rate * 100)?.toFixed(3)}%
Total requests: ${data.metrics.http_reqs?.values?.count}
RPS: ${data.metrics.http_reqs?.values?.rate?.toFixed(2)}
`;
}

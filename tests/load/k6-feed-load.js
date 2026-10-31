import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '1m', target: 200 },  // Sustained 200 req/sec
    { duration: '30s', target: 0 }    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'], // Home feed latency SLO
    http_req_failed: ['rate<0.005']                 // Error rate < 0.5%
  }
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5000/api/v1';

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // 1. Read Explore Feed (public)
  const exploreRes = http.get(`${BASE_URL}/feed/explore`, { headers });
  check(exploreRes, {
    'explore status is 200': (r) => r.status === 200,
    'explore latency < 250ms': (r) => r.timings.duration < 250
  });

  // 2. Read Single Post
  const postRes = http.get(`${BASE_URL}/posts/67243c111111111111111111`, { headers });
  check(postRes, {
    'post status is 200 or 404': (r) => r.status === 200 || r.status === 404
  });

  // 3. User Search prefix
  const searchRes = http.get(`${BASE_URL}/users/search?q=abebe`, { headers });
  check(searchRes, {
    'search status is 200': (r) => r.status === 200
  });

  sleep(1);
}

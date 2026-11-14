async function testApi() {
  console.log('Testing /api/tests/attempts endpoint with JWT...');

  // 1. Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nva@fpt.edu.vn', password: 'password' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.access_token;
  if (!token) {
    console.error('Login failed:', loginData);
    return;
  }
  console.log('✓ Login successful, got token');

  // 2. Fetch attempts
  const attemptsRes = await fetch('http://localhost:3000/api/tests/attempts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Attempts HTTP Status:', attemptsRes.status);
  const attempts = await attemptsRes.json();
  console.log(`✓ Received ${attempts.length} quiz attempts via API:`);
  attempts.slice(0, 3).forEach((a, i) => {
    console.log(`  [${i + 1}] Score: ${a.score}/10 | Target: ${a.test?.title || a.lesson?.topic} | Date: ${a.createdAt}`);
  });
}

testApi().catch(console.error);

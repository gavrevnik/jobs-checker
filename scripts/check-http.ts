import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { get } from 'node:http';

// Uses an isolated temporary database. Build the frontend first.
const dir = mkdtempSync(join(tmpdir(), 'scout-http-'));
const port = 4328;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts', '--production'], {
  env: { ...process.env, PORT: String(port), SCOUT_DB: join(dir, 'test.sqlite') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stderr.on('data', (b) => {
  logs += b.toString();
});
try {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${logs}`)), 10000);
    child.stdout.on('data', (b) => {
      if (String(b).includes('Scout доступен')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited ${code}: ${logs}`));
    });
  });
  const call = async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await fetch(base)).status, 200);
  const health = (await call('/health')).body;
  assert.equal(health.ok, true);
  assert.equal(health.application, 'scout-local');
  assert.equal(health.workspace, process.cwd());
  assert.equal(
    (
      await fetch(`${base}/api/jobs`, {
        method: 'POST',
        headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
    403,
  );
  assert.equal((await fetch(`${base}/api/jobs`, { method: 'POST', body: '{}' })).status, 415);
  // Fetch may normalize/ignore Host; use the HTTP client to send an actual hostile Host.
  const hostileHostStatus = await new Promise<number | undefined>((resolve, reject) => {
    get(`${base}/api/state`, { headers: { Host: 'evil.example' } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(hostileHostStatus, 403);
  const fixture = {
    title: 'HTTP test role',
    company: 'Test Company',
    url: 'https://example.com/http-check',
  };
  const created = await call('/jobs', 'POST', fixture);
  assert.equal(created.body.created, true);
  const id = created.body.job.id;
  await call(`/jobs/${id}`, 'PATCH', { stage: 'applied', notes: 'Persist me' });
  assert.equal((await call('/jobs', 'POST', fixture)).body.created, false);
  const state = (await call('/state')).body;
  assert.equal(state.jobs[0].notes, 'Persist me');
  assert.equal(state.jobs[0].history.length, 2);
  const bad = await call('/import', 'POST', {
    companies: [{ name: 'Should not exist' }],
    jobs: [{ title: '', company: 'Invalid' }],
  });
  assert.equal(bad.status, 400);
  assert.equal((await call('/state')).body.companies.length, 1);
  const exported = (await call('/export')).body;
  assert.equal(exported.jobs.length, 1);
  assert.equal(exported.jobs[0].notes, 'Persist me');
  assert.equal((await call('/import', 'POST', exported)).body.skipped, 1);
  assert.equal((await call('/unknown')).status, 404);
  if (process.argv.includes('--live')) {
    const result = await call('/sync', 'POST', {});
    assert.equal(result.status, 200);
    assert.equal(result.body.results[0].error, undefined, result.body.results[0].error);
    const cached = await call('/sync', 'POST', {});
    assert.equal(cached.body.results[0].cached, true);
    console.log(`Live sync: ${result.body.results[0].total} Remotive jobs; repeat used cache.`);
  }
  console.log(
    'HTTP check passed: production UI, CRUD, validation, import/export, loopback protections.',
  );
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }
  rmSync(dir, { recursive: true, force: true });
}

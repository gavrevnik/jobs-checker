import 'dotenv/config';
import { fetchJobs } from '../server/providers.js';
import { sourceSchema, type Source } from '../shared/model.js';

// Read-only smoke check. This does not create or modify the user's database.
const checks = [
  { provider: 'remotive', name: 'Remotive', board: '' },
  { provider: 'greenhouse', name: 'Greenhouse', board: 'greenhouse' },
  { provider: 'lever', name: 'Lever', board: 'lever' },
  { provider: 'ashby', name: 'Ashby', board: 'Ashby' },
];
const results = await Promise.all(
  checks.map(async (check) => {
    const source: Source = {
      ...sourceSchema.parse(check),
      id: 'check',
      lastSync: '',
      lastAttempt: '',
      error: '',
      count: 0,
    };
    try {
      const jobs = await fetchJobs(source);
      return {
        provider: source.provider,
        ok: true,
        jobs: jobs.length,
        sample: jobs[0]?.title || '(empty board)',
      };
    } catch (error) {
      return {
        provider: source.provider,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }),
);
console.table(results);
if (results.some((r) => !r.ok)) process.exitCode = 1;

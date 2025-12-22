#!/usr/bin/env node
/*
 Simple job processor for `job_queue`.
 Run this from your server or as a scheduled task.
*/
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function processOne() {
  try {
    const { data: job } = await admin
      .from('job_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!job) return false;

    await admin.from('job_queue').update({ status: 'in_progress', attempt_count: job.attempt_count + 1, updated_at: new Date().toISOString() }).eq('id', job.id);

    try {
      if (job.queue_name === 'paper-ingest') {
        const payload = job.payload || {};
        const caseId = payload.caseId;
        const fields = payload.fields || ['details','physical_exam_findings','diagnostic_findings'];

        const ingestUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000'}/api/cases/${caseId}/papers/ingest`;
        const res = await fetch(ingestUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ fields }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Ingest failed ${res.status} ${text}`);
        }

        await admin.from('job_queue').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', job.id);
        console.log('Processed job', job.id);
      } else {
        console.warn('Unknown queue_name', job.queue_name);
        await admin.from('job_queue').update({ status: 'failed', last_error: 'unknown_queue', updated_at: new Date().toISOString() }).eq('id', job.id);
      }
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      console.error('Job processing failed:', msg);
      await admin.from('job_queue').update({ status: 'failed', last_error: msg, updated_at: new Date().toISOString() }).eq('id', job.id);
    }

    return true;
  } catch (err) {
    console.error('Unexpected job loop error', err);
    return false;
  }
}

async function main() {
  while (true) {
    const got = await processOne();
    if (!got) await new Promise((r) => setTimeout(r, 5000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

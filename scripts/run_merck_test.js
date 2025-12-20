const fs = require('fs');
const path = require('path');
const axios = require('axios');

function loadEnv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    // Remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found in project root');
    process.exit(2);
  }
  const env = loadEnv(envPath);
  const key = env.GOOGLE_SEARCH_API_KEY;
  const cx = env.GOOGLE_SEARCH_CX;
  if (!key || !cx) {
    console.error('Missing GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_CX in .env.local');
    process.exit(2);
  }

  const q = process.argv[2] || 'mastitis in cattle';

  try {
    const resp = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: { key, cx, q, num: 3 }
    });
    const items = resp.data.items || [];
    console.log('Found', items.length, 'results');
    for (const it of items) {
      console.log('---');
      console.log('Title:', it.title);
      console.log('Snippet:', it.snippet);
      console.log('Link:', it.link);
    }
  } catch (err) {
    if (err.response) {
      console.error('Search failed:', err.response.status, err.response.data);
    } else {
      console.error('Search error:', String(err));
    }
    process.exit(1);
  }
}

main();

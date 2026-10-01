import { createReadStream, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const appDirectory = dirname(fileURLToPath(import.meta.url));
const distDirectory = resolve(appDirectory, 'dist');
const databasePath = resolve(process.env.DATABASE_PATH ?? './data/kestralbudget.sqlite');
const port = Number(process.env.PORT) || 8080;
const maxBodyBytes = 5 * 1024 * 1024;

mkdirSync(dirname(databasePath), { recursive: true });
const database = new Database(databasePath);
database.pragma('journal_mode = WAL');
database.pragma('busy_timeout = 5000');
database.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const readState = database.prepare('SELECT payload FROM app_state WHERE id = 1');
const writeState = database.prepare(`
  INSERT INTO app_state (id, payload) VALUES (1, ?)
  ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
`);

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleApi(request, response, pathname) {
  if (pathname !== '/api/state') {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  if (request.method === 'GET') {
    const row = readState.get();
    sendJson(response, 200, row
      ? { ...JSON.parse(row.payload), initialized: true }
      : { budgets: [], active: null, initialized: false });
    return;
  }

  if (request.method === 'PUT') {
    const payload = await readJson(request);
    if (!payload || !Array.isArray(payload.budgets) || !(payload.active === null || typeof payload.active === 'string')) {
      sendJson(response, 400, { error: 'Invalid budget state.' });
      return;
    }
    writeState.run(JSON.stringify({ budgets: payload.budgets, active: payload.active }));
    sendJson(response, 200, { saved: true });
    return;
  }

  response.writeHead(405, { Allow: 'GET, PUT' });
  response.end();
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

async function handleStatic(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const requestedPath = resolve(distDirectory, `.${pathname}`);
  if (requestedPath !== distDirectory && !requestedPath.startsWith(`${distDirectory}${sep}`)) {
    response.writeHead(404);
    response.end();
    return;
  }

  let filePath = requestedPath;
  try {
    if (statSync(filePath).isDirectory()) filePath = resolve(filePath, 'index.html');
    else if (!statSync(filePath).isFile()) filePath = resolve(distDirectory, 'index.html');
  } catch {
    filePath = resolve(distDirectory, 'index.html');
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    sendJson(response, 400, { error: 'Invalid request path.' });
    return;
  }

  const handler = pathname.startsWith('/api/')
    ? handleApi(request, response, pathname)
    : handleStatic(request, response, pathname);
  handler.catch((error) => {
    console.error(error);
    if (response.headersSent) response.destroy();
    else sendJson(response, error.statusCode || 500, { error: error.statusCode ? error.message : 'Internal server error.' });
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Kestral Budget listening on port ${port}; SQLite database: ${databasePath}`);
});
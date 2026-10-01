import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import initSqlJs from 'sql.js';

const appDirectory = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const maxBodyBytes = 5 * 1024 * 1024;
const createTableSql = `
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

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

async function handleApi(request, response, pathname, storage) {
  if (pathname !== '/api/state') {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  if (request.method === 'GET') {
    const payload = storage.readState();
    sendJson(response, 200, payload !== null
      ? { ...JSON.parse(payload), initialized: true }
      : { budgets: [], active: null, initialized: false });
    return;
  }

  if (request.method === 'PUT') {
    const payload = await readJson(request);
    if (!payload || !Array.isArray(payload.budgets) || !(payload.active === null || typeof payload.active === 'string')) {
      sendJson(response, 400, { error: 'Invalid budget state.' });
      return;
    }
    storage.writeState(JSON.stringify({ budgets: payload.budgets, active: payload.active }));
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

async function handleStatic(request, response, pathname, distDirectory) {
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

export async function startServer(options = {}) {
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const port = options.port ?? (Number(process.env.PORT) || 8080);
  const databasePath = resolve(options.databasePath ?? process.env.DATABASE_PATH ?? './data/kestralbudget.sqlite');
  const staticDirectory = resolve(options.staticDirectory ?? resolve(appDirectory, 'dist'));

  mkdirSync(dirname(databasePath), { recursive: true });
  const storage = await createStorage(databasePath, options.storage ?? 'native');
  const server = createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      sendJson(response, 400, { error: 'Invalid request path.' });
      return;
    }

    const handler = pathname.startsWith('/api/')
      ? handleApi(request, response, pathname, storage)
      : handleStatic(request, response, pathname, staticDirectory);
    handler.catch((error) => {
      console.error(error);
      if (response.headersSent) response.destroy();
      else sendJson(response, error.statusCode || 500, { error: error.statusCode ? error.message : 'Internal server error.' });
    });
  });

  try {
    await new Promise((resolveListen, rejectListen) => {
      server.once('error', rejectListen);
      server.listen(port, host, resolveListen);
    });
  } catch (error) {
    storage.close();
    throw error;
  }

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine the app server address.');
  return {
    server,
    origin: `http://${host}:${address.port}`,
    close: () => new Promise((resolveClose, rejectClose) => {
      server.close((error) => {
        storage.close();
        if (error) rejectClose(error);
        else resolveClose();
      });
    }),
  };
}

async function createStorage(databasePath, type) {
  if (type === 'wasm') {
    const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
    const database = existsSync(databasePath)
      ? new SQL.Database(readFileSync(databasePath))
      : new SQL.Database();
    database.run(createTableSql);

    return {
      readState: () => database.exec('SELECT payload FROM app_state WHERE id = 1')[0]?.values[0]?.[0] ?? null,
      writeState: (payload) => {
        database.run(`
          INSERT INTO app_state (id, payload) VALUES (1, ?)
          ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
        `, [payload]);
        const temporaryPath = `${databasePath}.tmp`;
        writeFileSync(temporaryPath, Buffer.from(database.export()));
        renameSync(temporaryPath, databasePath);
      },
      close: () => database.close(),
    };
  }

  if (type !== 'native') throw new Error(`Unsupported SQLite storage type: ${type}`);
  const { default: Database } = await import('better-sqlite3');
  const database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  database.exec(createTableSql);
  const readStatement = database.prepare('SELECT payload FROM app_state WHERE id = 1');
  const writeStatement = database.prepare(`
    INSERT INTO app_state (id, payload) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
  `);

  return {
    readState: () => readStatement.get()?.payload ?? null,
    writeState: (payload) => writeStatement.run(payload),
    close: () => database.close(),
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  startServer().then(({ server }) => {
    const address = server.address();
    console.log(`Kestral Budget listening on port ${typeof address === 'object' && address ? address.port : ''}; SQLite database: ${resolve(process.env.DATABASE_PATH ?? './data/kestralbudget.sqlite')}`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
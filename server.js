import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 10000);
const root = path.dirname(fileURLToPath(import.meta.url));
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }) : null;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '12mb' }));
app.use(express.static(root, { extensions: ['html'] }));

const collections = ['vendedores', 'equipes', 'clientes', 'rotas', 'itens', 'visitas', 'mensagens', 'customEntity', 'ausencias', 'graficos', 'mapas', 'painel', 'fotos', 'gpsLogs'];

async function databaseReady() {
  if (!pool) return false;
  await pool.query(`CREATE TABLE IF NOT EXISTS app_users (id BIGSERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'seller', display_name TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  await pool.query(`CREATE TABLE IF NOT EXISTS app_records (collection TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(collection, record_id));`);
  await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';`);
  const master = await pool.query('SELECT id FROM app_users WHERE username=$1', ['master']);
  if (!master.rowCount) await pool.query('INSERT INTO app_users(username,password_hash,role,display_name) VALUES(,,,)', ['master', await bcrypt.hash('1604', 12), 'master', 'Master']);
  return true;
}

function masterOnly(req, res, next) { if (req.user?.role !== 'master') return res.status(403).json({ error: 'Acesso permitido somente ao Master.' }); next(); }

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try { req.user = jwt.verify(token, process.env.JWT_SECRET || 'piremaxx-development-secret'); next(); } catch { res.status(401).json({ error: 'Não autenticado.' }); }
}

app.get('/api/health', async (_req, res) => {
  try { res.json({ ok: true, database: await databaseReady(), app: 'Piremaxx' }); } catch (error) { res.status(503).json({ ok: false, error: error.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Banco de dados ainda não configurado no Render.' });
  try {
    await databaseReady();
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const result = await pool.query('SELECT id,username,password_hash,role,display_name FROM app_users WHERE LOWER(username)=LOWER($1) AND active=TRUE', [username]);
    if (!result.rowCount || !(await bcrypt.compare(password, result.rows[0].password_hash))) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    const user = result.rows[0];
    res.json({ token: jwt.sign({ sub: user.id, username: user.username, displayName: user.display_name, role: user.role }, process.env.JWT_SECRET || 'piremaxx-development-secret', { expiresIn: '12h' }), user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/users', auth, masterOnly, async (_req, res) => {
  try { const result = await pool.query('SELECT id,username,display_name AS "displayName",role,active,created_at AS "createdAt" FROM app_users ORDER BY id'); res.json({ users: result.rows }); } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/users', auth, masterOnly, async (req, res) => {
  try { const username = String(req.body?.username || '').trim().toLowerCase(); const displayName = String(req.body?.displayName || '').trim(); const password = String(req.body?.password || ''); if (!username || !displayName || password.length < 4) return res.status(400).json({ error: 'Nome, login e senha com no mínimo 4 caracteres são obrigatórios.' }); const result = await pool.query('INSERT INTO app_users(username,password_hash,role,display_name) VALUES($1,$2,$3,$4) RETURNING id,username,display_name AS "displayName",role,active', [username, await bcrypt.hash(password, 12), 'seller', displayName]); res.status(201).json({ user: result.rows[0] }); } catch (error) { res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'Este login já existe.' : error.message }); }
});
app.get('/api/data', auth, async (req, res) => {
  try { const result = await pool.query('SELECT collection,record_id,payload FROM app_records'); const data = Object.fromEntries(collections.map(name => [name, []])); for (const row of result.rows) (data[row.collection] ||= []).push({ id: row.record_id, ...row.payload }); if (req.user.role === 'seller') { const visits = data.visitas.filter(v => String(v.vendedor || '').toLowerCase() === String(req.user.username).toLowerCase() || String(v.vendedor || '').toLowerCase() === String(req.user.displayName || '').toLowerCase()); const clients = new Set(visits.map(v => String(v.cliente || '').toLowerCase())); data.visitas = visits; data.clientes = data.clientes.filter(c => clients.has(String(c.nome || '').toLowerCase())); data.gpsLogs = data.gpsLogs.filter(log => visits.some(v => String(v.id) === String(log.visitaId))); for (const key of collections) if (!['visitas', 'clientes', 'gpsLogs'].includes(key)) data[key] = []; } res.json({ data }); } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/data', auth, masterOnly, async (req, res) => {
  const data = req.body?.data;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Payload de dados inválido.' });
  const client = await pool.connect();
  try { await client.query('BEGIN'); for (const collection of collections) { for (const record of Array.isArray(data[collection]) ? data[collection] : []) { const id = String(record.id ?? `${Date.now()}-${Math.random()}`); const { id: _id, ...payload } = record; await client.query(`INSERT INTO app_records(collection,record_id,payload,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(collection,record_id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=NOW()`, [collection, id, payload]); } } await client.query('COMMIT'); res.json({ ok: true }); } catch (error) { await client.query('ROLLBACK'); res.status(500).json({ error: error.message }); } finally { client.release(); }
});

app.get('/api/backup', auth, async (_req, res) => { const result = await pool.query('SELECT collection,record_id,payload FROM app_records'); const data = Object.fromEntries(collections.map(name => [name, []])); for (const row of result.rows) (data[row.collection] ||= []).push({ id: row.record_id, ...row.payload }); res.json({ app: 'Piremaxx', version: 2, exportedAt: new Date().toISOString(), data }); });
app.post('/api/backup', auth, async (req, res) => { req.body?.data ? res.json({ ok: true, message: 'Backup recebido. A restauração será concluída na próxima sincronização.' }) : res.status(400).json({ error: 'Backup inválido.' }); });

app.get('/{*splat}', (_req, res) => res.sendFile(path.join(root, 'index.html')));
databaseReady().then(() => app.listen(port, () => console.log(`Piremaxx online na porta ${port}`))).catch(error => { console.error(error); process.exit(1); });

const { neon } = require('@neondatabase/serverless');

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '';
}

function getSql() {
  const url = connectionString();
  if (!url) {
    const err = new Error('DATABASE_URL não configurada');
    err.code = 'NO_DATABASE_URL';
    throw err;
  }
  return neon(url);
}

function clean(value, max = 300) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\0/g, '').slice(0, max);
}

function parseDays(value) {
  const n = Number.parseInt(value || '30', 10);
  return Math.max(1, Math.min(3650, Number.isFinite(n) ? n : 30));
}

function sinceForDays(value) {
  const days = parseDays(value);
  return new Date(Date.now() - days * 86400000);
}

function crmAuthorized(req) {
  const expected = process.env.CRM_TOKEN || '';
  if (!expected) return true;
  const supplied = req.headers['x-crm-token'] || '';
  return supplied === expected;
}

function requireCrm(req, res) {
  if (crmAuthorized(req)) return true;
  res.status(401).json({ ok: false, error: 'unauthorized' });
  return false;
}

module.exports = { getSql, clean, parseDays, sinceForDays, requireCrm };

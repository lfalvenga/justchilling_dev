const { requireCrm } = require('./_db');
module.exports = async function handler(req, res) {
  if (!requireCrm(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    game_file: 'roadtostatuette/index.html',
    analytics: 'Vercel Functions',
    storage: 'Neon Postgres',
    database_configured: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL)
  });
};

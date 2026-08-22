module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const user = (body.user || '').trim().toLowerCase();
    const password = body.password || '';
    const expectedPassword = process.env.CRM_BASIC_PASSWORD || '';
    const allowedUsers = (process.env.CRM_BASIC_USERNAMES || '')
      .split(',')
      .map(u => u.trim().toLowerCase())
      .filter(Boolean);

    const userOk = allowedUsers.includes(user);
    const passOk = !!expectedPassword && password === expectedPassword;

    if (!userOk || !passOk) {
      return res.status(401).json({ ok: false, error: 'credenciais_invalidas' });
    }

    const maxAge = 8 * 60 * 60;
    res.setHeader('Set-Cookie', [
      `crm_auth=${expectedPassword}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
      `crm_user=${encodeURIComponent(user)}; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
    ]);
    return res.status(200).json({ ok: true, user });
  } catch (err) {
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
  }
};
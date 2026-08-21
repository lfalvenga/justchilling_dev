module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const password = body.password || '';
    const expected = process.env.CRM_BASIC_PASSWORD || '';

    if (!expected || password !== expected) {
      return res.status(401).json({ ok: false, error: 'senha_incorreta' });
    }

    // cookie vale por 8 horas; HttpOnly impede acesso via JavaScript (proteção contra XSS)
    const maxAge = 8 * 60 * 60;
    res.setHeader(
      'Set-Cookie',
      `crm_auth=${expected}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
  }
};
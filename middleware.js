// Protege /crm/painel e as rotas de dados do CRM, exigindo cookie de sessão válido
export const config = {
  matcher: [
    '/crm/painel',
    '/analytics/crm.html',
    '/api/metrics',
    '/api/source',
    '/api/export',
  ],
};

function getCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  const match = raw.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function middleware(req) {
  const expected = process.env.CRM_BASIC_PASSWORD;
  const cookieValue = getCookie(req, 'crm_auth');

  if (cookieValue && expected && cookieValue === expected) {
    return; // autenticado, deixa passar
  }

  const url = new URL(req.url);

  // chamadas de API não devem ser redirecionadas (o fetch não segue redirect de forma útil aqui)
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // páginas: manda pro login
  url.pathname = '/crm/login';
  return Response.redirect(url, 302);
}
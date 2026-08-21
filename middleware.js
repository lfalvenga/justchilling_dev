export const config = {
  matcher: ['/crm', '/analytics/crm.html', '/api/metrics', '/api/source', '/api/export'],
};

export default function middleware(req) {
  const authHeader = req.headers.get('authorization');
  const expectedPassword = process.env.CRM_BASIC_PASSWORD; // senha só do Basic Auth, separada da CRM_TOKEN

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded); // formato "usuario:senha"
      const [, password] = decoded.split(':');
      if (password === expectedPassword) {
        return; // senha certa, deixa passar
      }
    }
  }

  return new Response('Autenticação necessária', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="CRM justchilling"' },
  });
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const backend = 'http://100.116.60.65:4000';
    
    // Proxy /api/* to Dell backend
    if (url.pathname.startsWith('/api/')) {
      const backendUrl = backend + url.pathname + url.search;
      const res = await fetch(backendUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      return new Response(res.body, {
        status: res.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }
    
    // Serve static files from public/
    const staticUrl = new URL(url.pathname, 'http://static');
    return fetch(staticUrl.href);
  },
};

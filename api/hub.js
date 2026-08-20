const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

let cachedHtml;

function getHubHtml() {
  if (cachedHtml) return cachedHtml;
  const chunks = Array.from({ length: 6 }, (_, i) => {
    const name = `chunk-${String(i).padStart(3, '0')}.txt`;
    return fs.readFileSync(path.join(process.cwd(), 'hub-payload', name), 'utf8').trim();
  });
  cachedHtml = zlib.gunzipSync(Buffer.from(chunks.join(''), 'base64')).toString('utf8');
  return cachedHtml;
}

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=604800');
  res.status(200).send(getHubHtml());
};

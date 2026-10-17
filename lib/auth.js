const crypto = require('crypto');

// Confere o "Authorization: Bearer <API_TOKEN>" enviado pelo ESP32 (comparacao em tempo constante).
function tokenValido(req) {
  const esperado = process.env.API_TOKEN || '';
  const cab = req.headers['authorization'] || '';
  const recebido = cab.startsWith('Bearer ') ? cab.slice(7) : '';
  if (!esperado || !recebido) return false;
  const a = crypto.createHash('sha256').update(recebido).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = { tokenValido };

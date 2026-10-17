// POST /api/leituras  <- ESP32 envia 1 pacote por minuto (sensores juntos).
// Todos os campos de sensor sao opcionais e aceitam null (sensor sem sinal).
const crypto = require('crypto');
const { getPool, TABELA } = require('../../lib/db');

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const NIVEIS = ['NORMAL', 'ATENCAO', 'ALARME'];

const numero = (min, max) => v => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const inteiro = (min, max) => v => Number.isInteger(v) && v >= min && v <= max;
const nivel = v => NIVEIS.includes(v);
const texto = n => v => typeof v === 'string' && v.length <= n;

// Campos aceitos: nome da coluna -> validador. Os nomes sao fixos (seguros p/ SQL).
const CAMPOS = {
  uptime_s:              inteiro(0, 4294967295),
  temperatura_c:         numero(0, 60),
  temperatura_nivel:     nivel,
  bpm:                   inteiro(0, 400),
  bpm_nivel:             nivel,
  resp_rpm:              numero(0, 200),
  resp_qualidade:        numero(0, 1),
  resp_nivel:            nivel,
  resp_motivo:           texto(80),
  movimento_estado:      texto(16),
  movimento_intensidade: numero(0, 999.999),
  latitude:              numero(-90, 90),
  longitude:             numero(-180, 180)
};
const CHAVES = Object.keys(CAMPOS);
const CHAVES_SENSOR = CHAVES.filter(k => k !== 'uptime_s');

function tokenValido(req) {
  const esperado = process.env.API_TOKEN || '';
  const cab = req.headers['authorization'] || '';
  const recebido = cab.startsWith('Bearer ') ? cab.slice(7) : '';
  if (!esperado || !recebido) return false;
  const a = crypto.createHash('sha256').update(recebido).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

function validar(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return 'corpo invalido';
  if (typeof b.animal_id !== 'string' || !ID_RE.test(b.animal_id)) return 'animal_id invalido';
  for (const k of Object.keys(b)) {
    if (k === 'animal_id') continue;
    if (!Object.prototype.hasOwnProperty.call(CAMPOS, k)) return 'campo desconhecido: ' + k;
    if (b[k] !== null && !CAMPOS[k](b[k])) return 'valor invalido em ' + k;
  }
  if (!CHAVES_SENSOR.some(k => b[k] !== undefined && b[k] !== null)) return 'nenhum valor de sensor';
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'metodo nao permitido' });
  }
  if (!tokenValido(req)) return res.status(401).json({ erro: 'nao autorizado' });

  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch (e) { b = null; }
  }
  const erro = validar(b);
  if (erro) return res.status(400).json({ erro });

  try {
    const colunas = ['animal_id'].concat(CHAVES.filter(k => b[k] !== undefined));
    const valores = colunas.map(c => b[c]);
    await getPool().execute(
      'INSERT INTO ' + TABELA + ' (' + colunas.join(', ') + ') VALUES (' +
      colunas.map(() => '?').join(', ') + ')',
      valores
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('erro ao gravar leitura:', e.code || e.message);
    return res.status(500).json({ erro: 'falha ao gravar' });
  }
};

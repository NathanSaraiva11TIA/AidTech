// POST /api/respiros  <- ESP32 envia 1 pacote POR RESPIRO com o trecho real do sinal.
// Corpo: { animal_id, uptime_s?, periodo_ms, amp_mg, am: [mg, mg, ...] }
const { getPool, TABELA_RESPIROS } = require('../../lib/db');
const { tokenValido } = require('../../lib/auth');

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_AMOSTRAS = 48;
const MANTER_MINUTOS = 30;       // respiros mais velhos que isso sao apagados
const PODA_UMA_EM = 20;          // faz a limpeza em ~1 de cada 20 gravacoes

const inteiro = (min, max) => v => Number.isInteger(v) && v >= min && v <= max;
const CAMPOS = {
  uptime_s:   inteiro(0, 4294967295),
  periodo_ms: inteiro(1000, 10000),
  amp_mg:     inteiro(0, 5000),
  am:         v => Array.isArray(v) && v.length >= 6 && v.length <= MAX_AMOSTRAS &&
                   v.every(x => Number.isInteger(x) && x >= -5000 && x <= 5000)
};

function validar(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return 'corpo invalido';
  if (typeof b.animal_id !== 'string' || !ID_RE.test(b.animal_id)) return 'animal_id invalido';
  for (const k of Object.keys(b)) {
    if (k === 'animal_id') continue;
    if (!Object.prototype.hasOwnProperty.call(CAMPOS, k)) return 'campo desconhecido: ' + k;
    if (b[k] !== null && !CAMPOS[k](b[k])) return 'valor invalido em ' + k;
  }
  for (const k of ['periodo_ms', 'amp_mg', 'am']) {
    if (b[k] === undefined || b[k] === null) return 'falta o campo ' + k;
  }
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
    const pool = getPool();
    await pool.execute(
      'INSERT INTO ' + TABELA_RESPIROS + ' (animal_id, uptime_s, periodo_ms, amp_mg, amostras) VALUES (?, ?, ?, ?, ?)',
      [b.animal_id, b.uptime_s === undefined ? null : b.uptime_s, b.periodo_ms, b.amp_mg, b.am.join(',')]
    );
    if (Math.random() * PODA_UMA_EM < 1) {
      pool.execute(
        'DELETE FROM ' + TABELA_RESPIROS + ' WHERE animal_id = ? AND criado_em < NOW() - INTERVAL ' +
        MANTER_MINUTOS + ' MINUTE LIMIT 500',
        [b.animal_id]
      ).catch(e => console.error('erro na limpeza:', e.code || e.message));
    }
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('erro ao gravar respiro:', e.code || e.message);
    return res.status(500).json({ erro: 'falha ao gravar' });
  }
};

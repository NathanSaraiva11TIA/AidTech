// GET /api/respiros/recentes?animal_id=A01[&apos_id=123]
// Devolve os respiros novos (id > apos_id) para o site desenhar a onda ao vivo.
// Sem apos_id, devolve os ultimos 8 respiros.
const { getPool, TABELA_RESPIROS } = require('../../lib/db');

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

function linha(r) {
  return {
    id: Number(r.id),
    idade_s: Number(r.idade_s),
    periodo_ms: Number(r.periodo_ms),
    amp_mg: Number(r.amp_mg),
    am: String(r.amostras).split(',').map(Number)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'metodo nao permitido' });
  }

  const q = req.query || {};
  const animal = String(q.animal_id || '');
  if (!ID_RE.test(animal)) return res.status(400).json({ erro: 'animal_id invalido' });

  const temApos = q.apos_id !== undefined && q.apos_id !== '';
  const apos = Number(q.apos_id);
  if (temApos && (!Number.isInteger(apos) || apos < 0)) return res.status(400).json({ erro: 'apos_id invalido' });

  const colunas = 'id, periodo_ms, amp_mg, amostras, TIMESTAMPDIFF(SECOND, criado_em, NOW()) AS idade_s';
  try {
    let rows;
    if (temApos) {
      [rows] = await getPool().execute(
        'SELECT ' + colunas + ' FROM ' + TABELA_RESPIROS + ' WHERE animal_id = ? AND id > ? ORDER BY id ASC LIMIT 60',
        [animal, apos]
      );
    } else {
      [rows] = await getPool().execute(
        'SELECT ' + colunas + ' FROM ' + TABELA_RESPIROS + ' WHERE animal_id = ? ORDER BY id DESC LIMIT 8',
        [animal]
      );
      rows.reverse();
    }
    return res.status(200).json({ respiros: rows.map(linha) });
  } catch (e) {
    console.error('erro ao ler respiros:', e.code || e.message);
    return res.status(500).json({ erro: 'falha ao ler' });
  }
};

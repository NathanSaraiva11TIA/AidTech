// GET /api/leituras/ultima?animal_id=A024  -> última leitura do animal (card do site)
const { getPool, TABELA } = require('../../lib/db');

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const NUMERICOS = ['temperatura_c', 'bpm', 'resp_rpm', 'resp_qualidade', 'movimento_intensidade', 'latitude', 'longitude'];
const TEXTOS = ['temperatura_nivel', 'bpm_nivel', 'resp_nivel', 'resp_motivo', 'movimento_estado'];

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'metodo nao permitido' });
  }

  const animal = String((req.query && req.query.animal_id) || '');
  if (!ID_RE.test(animal)) return res.status(400).json({ erro: 'animal_id invalido' });

  try {
    const [rows] = await getPool().execute(
      'SELECT animal_id, ' + NUMERICOS.concat(TEXTOS).join(', ') + ', ' +
      'TIMESTAMPDIFF(SECOND, criado_em, NOW()) AS idade_s ' +
      'FROM ' + TABELA + ' WHERE animal_id = ? ORDER BY id DESC LIMIT 1',
      [animal]
    );
    if (!rows.length) return res.status(404).json({ erro: 'sem leituras' });

    const r = rows[0];
    const saida = { animal_id: r.animal_id, idade_s: Number(r.idade_s) };
    NUMERICOS.forEach(k => { saida[k] = r[k] === null ? null : Number(r[k]); });
    TEXTOS.forEach(k => { saida[k] = r[k]; });

    // BPM e temperatura chegam em pacotes diferentes: usa o último valor de cada um (até 180 s)
    for (const [campo, nivel] of [['bpm', 'bpm_nivel'], ['temperatura_c', 'temperatura_nivel']]) {
      const [rs] = await getPool().execute(
        'SELECT ' + campo + ' AS v, ' + nivel + ' AS n FROM ' + TABELA +
        ' WHERE animal_id = ? AND ' + campo + ' IS NOT NULL AND criado_em >= NOW() - INTERVAL 180 SECOND' +
        ' ORDER BY id DESC LIMIT 1',
        [animal]
      );
      saida[campo] = rs.length ? Number(rs[0].v) : null;
      saida[nivel] = rs.length ? rs[0].n : null;
    }

    // Última medida respiratória VÁLIDA (a janela mais recente pode ter vindo sem valor)
    const [rv] = await getPool().execute(
      'SELECT resp_rpm, resp_nivel, TIMESTAMPDIFF(SECOND, criado_em, NOW()) AS idade_s ' +
      'FROM ' + TABELA + ' WHERE animal_id = ? AND resp_rpm IS NOT NULL ORDER BY id DESC LIMIT 1',
      [animal]
    );
    saida.resp_valida = rv.length
      ? { rpm: Number(rv[0].resp_rpm), nivel: rv[0].resp_nivel, idade_s: Number(rv[0].idade_s) }
      : null;
    return res.status(200).json(saida);
  } catch (e) {
    console.error('erro ao ler leitura:', e.code || e.message);
    return res.status(500).json({ erro: 'falha ao ler' });
  }
};

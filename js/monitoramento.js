/*
 * Painel de Monitoramento.
 *
 * Ainda não existe backend: tudo abaixo é DADO DE DEMONSTRAÇÃO, reproduzindo
 * o layout de referência. Quando houver leituras reais da coleira, substitua
 * MONITOR_DATA (ou chame renderMonitor com os dados da API) — não misture os dois.
 *
 * status de cada sinal: 'normal' | 'atencao' | 'alerta' | null
 *   null (ou value null) => exibe "Sem sinal"; nunca mostra "Normal" sem dado.
 */
const MONITOR_DATA = {
  source: 'demo', // 'demo' | 'live'
  animal: {
    id: 'A01',
    breed: 'Holandesa',
    age: '4 anos',
    lactation: 2
  },
  vitals: {
    heartRate:       { value: 72,   unit: 'bpm', status: 'normal' },
    temperature:     { value: 38.6, unit: '°C',  status: 'normal' },
    respiratoryRate: { value: 24,   unit: 'rpm', status: 'normal' }
  },
  location: null // { lat, lng, updatedAt } quando houver GPS real
};

(function () {
  const STATUS_LABEL = {
    normal: 'Normal',
    atencao: 'Atenção',
    alerta: 'Alerta'
  };

  function setField(name, text) {
    document.querySelectorAll('[data-field="' + name + '"]').forEach(function (el) {
      el.textContent = text;
    });
  }

  function renderVital(card, vital) {
    const valueEl = card.querySelector('[data-part="value"]');
    const unitEl = card.querySelector('[data-part="unit"]');
    const badge = card.querySelector('[data-part="status"]');
    const hasValue = vital && vital.value !== null && vital.value !== undefined;

    valueEl.textContent = hasValue ? String(vital.value) : '—';
    if (hasValue && vital.unit) unitEl.textContent = vital.unit;
    unitEl.hidden = !hasValue;

    const status = hasValue && vital.status ? vital.status : null;
    badge.textContent = status ? STATUS_LABEL[status] + (vital.note ? ' · ' + vital.note : '') : 'Sem sinal';
    badge.dataset.status = status || 'none';
    card.classList.toggle('is-empty', !hasValue);

    // Respiração: 1 ciclo da animação = 1 respiração (período = 60 / rpm segundos)
    if (card.dataset.vital === 'respiratoryRate') {
      const rpm = Number(vital && (vital.rate !== undefined ? vital.rate : vital.value));
      const breathing = hasValue && rpm > 0;
      if (breathing) {
        const periodo = Math.min(8, Math.max(0.8, 60 / rpm));
        card.style.setProperty('--resp-period', periodo.toFixed(2) + 's');
      }
      card.classList.toggle('is-breathing', breathing);
    }
  }

  function renderMonitor(data) {
    const a = data.animal;
    setField('animal.id', a ? a.id : '—');
    setField('animal.details', a ? [a.breed, a.age, 'Lactação: ' + a.lactation].join(' • ') : 'Nenhum animal selecionado');

    document.querySelectorAll('.mon-card[data-vital]').forEach(function (card) {
      renderVital(card, data.vitals[card.dataset.vital]);
    });

    const isDemo = data.source === 'demo';
    const hasLocation = data.location && data.location.updatedAt;
    setField('location.label', hasLocation && !isDemo ? 'Ao vivo' : (isDemo ? 'Demonstração' : 'Indisponível'));
    document.querySelector('.mon-live').classList.toggle('is-live', Boolean(hasLocation && !isDemo));

    const vitals = Object.keys(data.vitals).map(function (k) { return data.vitals[k]; });
    const complete = vitals.every(function (v) { return v && v.value !== null && v.status; });
    const allNormal = complete && vitals.every(function (v) { return v.status === 'normal'; });

    if (!complete) {
      setField('summary.title', 'Aguardando dados');
      setField('summary.text', 'Nenhuma leitura completa recebida da coleira até o momento.');
    } else if (allNormal) {
      setField('summary.title', 'Tudo dentro do esperado!');
      setField('summary.text', 'Os sinais vitais da ' + a.id + ' estão estáveis no momento.');
    } else {
      setField('summary.title', 'Atenção a um ou mais sinais');
      setField('summary.text', 'Verifique os indicadores destacados da ' + a.id + '.');
    }

    const note = document.querySelector('.mon-demo-note');
    note.hidden = !isDemo;
    note.textContent = 'Dados de demonstração — valores ilustrativos, não são leituras reais de um animal.';
  }

  renderMonitor(MONITOR_DATA);
  window.renderMonitor = renderMonitor;

  // ---- Leitura real da coleira (API) ----
  // O ESP32 envia 1 medida por minuto para /api/leituras; aqui o card consulta a
  // última leitura. Enquanto nenhuma chegar (ou se a API estiver fora do ar), a
  // demonstração acima continua na tela. Quando chega dado real, o que a coleira
  // ainda não mede (batimento, temperatura, GPS) passa a mostrar "Sem sinal",
  // em vez de exibir valores de demonstração como se fossem reais.
  const ANIMAL_ID = MONITOR_DATA.animal.id;
  const POLL_MS = 15000;        // consulta a cada 15 s
  const VALIDADE_S = 180;       // sem leitura há mais de 3 min => "Sem sinal"
  const VALIDADE_RESP_S = 300;  // respiração: mantém a última medida válida por até 5 min
  const NIVEL_STATUS = { NORMAL: 'normal', ATENCAO: 'atencao', ALARME: 'alerta' };

  // Respiração: nem toda janela de 60 s dá medida válida (animal se mexendo etc.).
  // Por isso o card usa a ÚLTIMA medida válida (até VALIDADE_RESP_S) e avisa a idade dela.
  function respiracao(l) {
    // API nova manda resp_valida; se o servidor ainda roda a versão antiga, usa a leitura mais recente
    const v = l.resp_valida !== undefined
      ? l.resp_valida
      : (l.resp_rpm !== null && l.resp_rpm !== undefined ? { rpm: l.resp_rpm, nivel: l.resp_nivel, idade_s: l.idade_s } : null);
    if (!v || v.rpm === null || v.idade_s > VALIDADE_RESP_S) return { value: null, unit: 'rpm', status: null };
    return {
      value: Math.round(v.rpm),
      rate: v.rpm,                       // valor exato: define o ritmo da animação
      unit: 'rpm',
      status: NIVEL_STATUS[v.nivel] || null,
      note: v.idade_s > 90 ? 'há ' + Math.round(v.idade_s / 60) + ' min' : ''
    };
  }

  function aplicarLeitura(l) {
    const recente = l.idade_s <= VALIDADE_S;

    // Converte um sinal da API no formato do card; sem valor (ou leitura velha) => "Sem sinal"
    function sinal(valor, nivel, unidade, arredonda) {
      const tem = recente && valor !== null && valor !== undefined;
      return {
        value: tem ? (arredonda ? Math.round(valor) : valor) : null,
        unit: unidade,
        status: tem ? (NIVEL_STATUS[nivel] || null) : null
      };
    }

    MONITOR_DATA.source = 'live';
    MONITOR_DATA.vitals = {
      heartRate:       sinal(l.bpm,           l.bpm_nivel,         'bpm', true),
      temperature:     sinal(l.temperatura_c, l.temperatura_nivel, '°C',  false),
      respiratoryRate: respiracao(l)
    };
    renderMonitor(MONITOR_DATA);
  }

  async function buscarLeitura() {
    try {
      const r = await fetch('/api/leituras/ultima?animal_id=' + encodeURIComponent(ANIMAL_ID), { cache: 'no-store' });
      if (!r.ok) return;   // sem leituras ainda ou API fora do ar: mantém o que está na tela
      aplicarLeitura(await r.json());
    } catch (e) {
      // offline, ou página aberta direto do arquivo: mantém a demonstração
    }
  }

  buscarLeitura();
  setInterval(buscarLeitura, POLL_MS);

  // ---------- Onda respiratória ao vivo ----------
  // O ESP32 manda 1 pacote POR RESPIRO com o trecho real do sinal (em mg). Aqui os
  // trechos viram uma linha do tempo e a onda é desenhada com esses valores:
  // amplitude e velocidade vêm do sensor. Sem respiros chegando, a onda some.
  const RESP_POLL_MS = 2000;     // consulta respiros novos a cada 2 s
  const ESCALA_MG = 50;          // ±50 mg ocupa a altura toda da onda
  const JANELA_MS = 12000;       // tempo mostrado na onda
  const ATRASO_MS = 4000;        // mostra o passado recente: o respiro só é conhecido depois que termina
  const SEM_SINAL_MS = 15000;    // sem respiro novo há tanto tempo => a onda some
  const IDADE_MAX_S = 30;        // respiros mais velhos que isso são ignorados

  const respCard = document.querySelector('[data-vital="respiratoryRate"]');
  const canvas = respCard && respCard.querySelector('.mon-wave-live');
  const pulmao = respCard && respCard.querySelector('.mon-card-icon img');
  const reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onda = { pontos: [], ultimoId: 0, fimMs: 0, cor: '#8db365', corLida: 0, rodando: false };

  function adicionarRespiros(lista, agora) {
    lista.forEach(function (r) {
      onda.ultimoId = Math.max(onda.ultimoId, r.id);
      if (r.idade_s > IDADE_MAX_S || !r.am || r.am.length < 2) return;
      const periodo = r.periodo_ms;
      const estimado = agora - r.idade_s * 1000;               // quando o respiro terminou (± 1 s)
      const seguido = onda.fimMs && Math.abs(estimado - (onda.fimMs + periodo)) < 2500;
      const fim = seguido ? onda.fimMs + periodo : estimado;   // encadeia respiros seguidos
      const dt = periodo / (r.am.length - 1);
      const t0 = fim - periodo;
      for (let k = seguido ? 1 : 0; k < r.am.length; k++) {    // o 1º ponto repete o último do respiro anterior
        onda.pontos.push({ t: t0 + k * dt, v: r.am[k] });
      }
      onda.fimMs = fim;
    });
    const corte = agora - JANELA_MS - ATRASO_MS - 5000;
    while (onda.pontos.length && onda.pontos[0].t < corte) onda.pontos.shift();
  }

  function valorEm(t) {
    const p = onda.pontos;
    if (!p.length || t < p[0].t) return 0;
    for (let i = p.length - 1; i > 0; i--) {
      if (p[i - 1].t <= t) {
        if (t >= p[i].t) return p[i].v;
        const f = (t - p[i - 1].t) / (p[i].t - p[i - 1].t || 1);
        return p[i - 1].v + f * (p[i].v - p[i - 1].v);
      }
    }
    return p[0].v;
  }

  function desenhar(agora) {
    const viva = onda.fimMs > 0 && agora - onda.fimMs < SEM_SINAL_MS + ATRASO_MS;
    respCard.classList.toggle('has-wave', viva);
    if (!viva) {
      onda.pontos = []; onda.fimMs = 0;
      if (pulmao) pulmao.style.transform = '';
      const c0 = canvas.getContext('2d'); c0.clearRect(0, 0, canvas.width, canvas.height);
      return false;
    }
    const tShow = reduzMovimento ? onda.fimMs : agora - ATRASO_MS;

    if (agora - onda.corLida > 1000) {                         // acompanha o tema claro/escuro
      const cor = getComputedStyle(canvas).getPropertyValue('--mon-accent-text').trim();
      if (cor) onda.cor = cor;
      onda.corLida = agora;
    }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.lineWidth = 2.5 * dpr; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = onda.cor;

    const meio = h / 2;
    const xDe = t => (t - (tShow - JANELA_MS)) / JANELA_MS * w;
    const yDe = v => meio - Math.max(-1, Math.min(1, v / ESCALA_MG)) * meio * 0.9;
    g.beginPath();
    let ant = null, abriu = false;
    onda.pontos.forEach(function (p) {
      if (p.t > tShow || p.t < tShow - JANELA_MS - 600) return;
      const x = xDe(p.t), y = yDe(p.v);
      if (!abriu || (ant && p.t - ant.t > 1500)) { g.moveTo(x, y); abriu = true; }   // buraco = respiro descartado
      else { const mx = (ant.x + x) / 2, my = (ant.y + y) / 2; g.quadraticCurveTo(ant.x, ant.y, mx, my); }
      ant = { x: x, y: y, t: p.t };
    });
    if (ant) g.lineTo(ant.x, ant.y);
    g.stroke();

    if (pulmao) {                                              // o pulmão enche e esvazia com o sinal real
      const f = Math.max(-1, Math.min(1, valorEm(tShow) / ESCALA_MG));
      pulmao.style.transformOrigin = 'center';
      pulmao.style.transform = 'scale(' + (1 + 0.12 * f).toFixed(3) + ')';
    }
    return true;
  }

  function quadro(agora) {
    if (desenhar(agora)) requestAnimationFrame(quadro); else onda.rodando = false;
  }

  function iniciarDesenho() {
    const agora = performance.now();
    if (reduzMovimento) { desenhar(agora); return; }            // sem animação: mostra o último respiro parado
    if (!onda.rodando && onda.fimMs) { onda.rodando = true; requestAnimationFrame(quadro); }
  }

  async function buscarRespiros() {
    if (document.visibilityState === 'hidden') return;
    try {
      const url = '/api/respiros/recentes?animal_id=' + encodeURIComponent(ANIMAL_ID) +
                  (onda.ultimoId ? '&apos_id=' + onda.ultimoId : '');
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return;                                       // tabela ainda não criada ou API fora do ar
      const dados = await r.json();
      adicionarRespiros(dados.respiros || [], performance.now());
      iniciarDesenho();
    } catch (e) {
      // offline ou sem API: a onda simplesmente não aparece
    }
  }

  if (canvas) {
    buscarRespiros();
    setInterval(buscarRespiros, RESP_POLL_MS);
    setInterval(function () { if (!onda.rodando && onda.fimMs) desenhar(performance.now()); }, 3000);  // apaga a onda se parar de chegar
  }

  // Itens sem página ainda: avisa em vez de fingir navegação.
  const toast = document.querySelector('.mon-toast');
  let toastTimer;
  document.querySelectorAll('[data-pending]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      toast.textContent = el.dataset.pending + ': página em desenvolvimento.';
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('is-visible'); }, 2400);
    });
  });

  // main.js abre/fecha o menu; aqui só mantemos o aria-expanded em sincronia.
  const nav = document.querySelector('.main-nav');
  const toggle = document.querySelector('.menu-toggle');
  if (nav && toggle) {
    new MutationObserver(function () {
      toggle.setAttribute('aria-expanded', String(nav.classList.contains('is-open')));
    }).observe(nav, { attributes: true, attributeFilter: ['class'] });
  }
})();

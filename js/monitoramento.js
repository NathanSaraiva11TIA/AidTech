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

  const TERMO_MIN = 15;   // °C com o termômetro vazio
  const TERMO_MAX = 45;   // °C com o termômetro cheio

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
    card.dataset.status = status || 'none';

    // Temperatura: a coluna do termômetro enche de TERMO_MIN (vazio) a TERMO_MAX (cheio)
    if (card.dataset.vital === 'temperature') {
      const nivel = hasValue ? (Number(vital.value) - TERMO_MIN) / (TERMO_MAX - TERMO_MIN) : 0;
      card.style.setProperty('--thermo-nivel', Math.min(1, Math.max(0, nivel)).toFixed(3));
    }

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

  // ---------- Onda cardíaca ----------
  // Mesmo raciocínio da onda respiratória: <canvas> que rola da direita para a esquerda,
  // com o ritmo vindo do valor do card (BPM). O traçado é sintético e mais "reto": linha de
  // base quase plana e um complexo QRS em cada batida, como o ícone onda_ecg.png.
  const ECG_JANELA_MS = 2500;       // tempo mostrado na onda
  const ECG_ATRASO_MS = 250;        // a batida só aparece inteira depois que passa
  const ECG_SEM_SINAL_MS = 20000;   // sem valor novo há tanto tempo => a onda some
  const ecgCard = document.querySelector('[data-vital="heartRate"]');
  const ecgCanvas = ecgCard && ecgCard.querySelector('.mon-wave-ecg');
  const ecgIcone = ecgCard && ecgCard.querySelector('.mon-card-icon img');
  const ecgReduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ecg = { bpm: 0, atualizadoEm: 0, batidas: [], rodando: false, cor: '#8db365', corLida: 0 };

  // Forma de uma batida, em segundos a partir do pico R: [centro, largura, altura]
  const ECG_FORMA = [
    [-0.160, 0.022,  0.02],   // onda P (quase imperceptível)
    [-0.030, 0.008, -0.10],   // Q
    [ 0.000, 0.012,  0.75],   // R (o pico)
    [ 0.032, 0.012, -0.20],   // S
    [ 0.230, 0.040,  0.03]    // onda T (baixa)
  ];

  function ecgValor(t, bat) {                                  // t em ms
    let v = 0;                                                 // linha de base plana
    for (let i = 0; i < bat.length; i++) {
      const dt = (t - bat[i]) / 1000;
      if (dt < -0.35 || dt > 0.55) continue;
      for (let k = 0; k < ECG_FORMA.length; k++) {
        const f = ECG_FORMA[k], z = (dt - f[0]) / f[1];
        v += f[2] * Math.exp(-0.5 * z * z);
      }
    }
    return v;
  }

  function ecgDesenhar(agora) {
    const viva = ecg.bpm > 0 && agora - ecg.atualizadoEm < ECG_SEM_SINAL_MS;
    ecgCard.classList.toggle('has-wave', viva);
    if (!viva) {
      const c0 = ecgCanvas.getContext('2d'); c0.clearRect(0, 0, ecgCanvas.width, ecgCanvas.height);
      if (ecgIcone) ecgIcone.style.transform = '';
      return false;
    }
    const periodo = 60000 / ecg.bpm;
    const bat = ecg.batidas;
    if (!bat.length || agora - bat[bat.length - 1] > 5000) {   // começo, ou aba ficou parada: recomeça cheio
      bat.length = 0;
      for (let t = agora; t > agora - ECG_JANELA_MS - 1500; t -= periodo) bat.unshift(t);
    }
    while (bat[bat.length - 1] < agora + 400) bat.push(bat[bat.length - 1] + periodo);
    while (bat.length > 2 && bat[0] < agora - ECG_JANELA_MS - 1500) bat.shift();

    const tShow = ecgReduz ? agora : agora - ECG_ATRASO_MS;

    if (agora - ecg.corLida > 1000) {                          // acompanha o tema claro/escuro
      const cor = getComputedStyle(ecgCanvas).getPropertyValue('--mon-accent-text').trim();
      if (cor) ecg.cor = cor;
      ecg.corLida = agora;
    }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(2, Math.round(ecgCanvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(ecgCanvas.clientHeight * dpr));
    if (ecgCanvas.width !== w || ecgCanvas.height !== h) { ecgCanvas.width = w; ecgCanvas.height = h; }
    const g = ecgCanvas.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.lineWidth = 1.5 * dpr; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = ecg.cor;

    const meio = h / 2;
    g.beginPath();
    for (let x = 0; x < w; x++) {
      const t = tShow - ECG_JANELA_MS + x / (w - 1) * ECG_JANELA_MS;
      const v = Math.max(-1, Math.min(1, ecgValor(t, bat)));
      const y = meio - v * meio * 0.8;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();

    if (ecgIcone) {                                            // o coração dá uma leve batida a cada pico
      let p = 0;
      for (let i = 0; i < bat.length; i++) {
        const z = (tShow - bat[i]) / 90;
        if (Math.abs(z) < 4) p = Math.max(p, Math.exp(-0.5 * z * z));
      }
      ecgIcone.style.transformOrigin = 'center';
      ecgIcone.style.transform = 'scale(' + (1 + 0.14 * p).toFixed(3) + ')';
    }
    return true;
  }

  function ecgQuadro(agora) {
    if (ecgDesenhar(agora)) requestAnimationFrame(ecgQuadro); else ecg.rodando = false;
  }

  // Chamada a cada leitura da API com o BPM atual (null/0 = sem sinal: a onda some)
  function ecgDefinir(bpm) {
    if (!ecgCanvas) return;
    if (!(bpm > 0)) { ecg.bpm = 0; if (!ecg.rodando) ecgDesenhar(performance.now()); return; }
    ecg.bpm = bpm;
    ecg.atualizadoEm = performance.now();
    if (ecgReduz) { ecg.batidas = []; ecgDesenhar(ecg.atualizadoEm); return; }   // sem animação: quadro parado
    if (!ecg.rodando) { ecg.rodando = true; requestAnimationFrame(ecgQuadro); }
  }

  // ---------- Mapa do GPS ----------
  // Mapa real (Leaflet + tiles do OpenStreetMap), recolorido no CSS. Sem GPS da coleira,
  // mostra o UNASP São Paulo como local de referência; com latitude/longitude, segue a coleira.
  const MAPA_REF = { lat: -23.66595, lng: -46.77918, nome: 'UNASP São Paulo (referência)' };
  const MAPA_ZOOM = 17;
  const mapaBox = document.querySelector('.mon-map');
  const mapaEl = mapaBox && mapaBox.querySelector('.mon-map-tiles');
  const mapaLegenda = mapaBox && mapaBox.querySelector('.mon-map-caption');
  let mapa = null, mapaPino = null, mapaAoVivo = false;

  if (mapaEl && window.L) {
    mapa = L.map(mapaEl, {
      center: [MAPA_REF.lat, MAPA_REF.lng],
      zoom: MAPA_ZOOM,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true
    });
    mapa.attributionControl.setPrefix(false).setPosition('topright');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapa);
    mapaPino = L.marker([MAPA_REF.lat, MAPA_REF.lng], {
      keyboard: false,
      icon: L.divIcon({ className: 'mon-map-marker', html: '<span class="mon-map-pin"></span>', iconSize: [14, 14] })
    }).addTo(mapa);
    mapaBox.classList.add('has-tiles');
    // o card muda de tamanho depois que a página termina o layout: o Leaflet precisa recalcular
    if (window.ResizeObserver) new ResizeObserver(function () { mapa.invalidateSize(); }).observe(mapaEl);
    mapaBox.setAttribute('aria-label', 'Mapa: ' + MAPA_REF.nome + '.');
    if (mapaLegenda) mapaLegenda.textContent = MAPA_REF.nome;
  }

  // Chamada a cada leitura da API: { lat, lng } da coleira, ou null para voltar à referência
  function mapaDefinir(loc) {
    if (!mapa) return;
    const vivo = Boolean(loc);
    const pos = vivo ? [loc.lat, loc.lng] : [MAPA_REF.lat, MAPA_REF.lng];
    mapaPino.setLatLng(pos);
    if (vivo || mapaAoVivo) mapa.panTo(pos, { animate: !ecgReduz });
    mapaAoVivo = vivo;
    const texto = vivo ? 'Posição da coleira' : MAPA_REF.nome;
    if (mapaLegenda) mapaLegenda.textContent = texto;
    mapaBox.setAttribute('aria-label', 'Mapa: ' + texto + '.');
  }

  // ---- Leitura real da coleira (API) ----
  // O ESP32 envia 1 medida por minuto para /api/leituras; aqui o card consulta a
  // última leitura. Enquanto nenhuma chegar (ou se a API estiver fora do ar), a
  // demonstração acima continua na tela. Quando chega dado real, o que a coleira
  // ainda não mede (batimento, temperatura, GPS) passa a mostrar "Sem sinal",
  // em vez de exibir valores de demonstração como se fossem reais.
  const ANIMAL_ID = MONITOR_DATA.animal.id;
  const POLL_MS = 3000;        // consulta a cada 3 s
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
    const temGps = recente && l.latitude !== null && l.latitude !== undefined && l.longitude !== null && l.longitude !== undefined;
    MONITOR_DATA.location = temGps ? { lat: l.latitude, lng: l.longitude, updatedAt: Date.now() } : null;
    renderMonitor(MONITOR_DATA);
    ecgDefinir(MONITOR_DATA.vitals.heartRate.value);
    respDefinir(MONITOR_DATA.vitals.respiratoryRate.value);
    mapaDefinir(MONITOR_DATA.location);
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
  // Onda sintética e suave: o ritmo vem do rpm mostrado no card (1 ciclo = 1 respiração,
  // período = 60 / rpm s). A fase é acumulada quadro a quadro, então mudar o rpm não dá salto.
  const JANELA_MS = 12000;       // tempo mostrado na onda
  const SEM_SINAL_MS = 15000;    // sem rpm novo há tanto tempo => a onda some
  const INSPIRA = 0.42;          // fração do ciclo subindo (inspira um pouco mais rápido que expira)
  const AMPLITUDE = 0.7;         // altura da onda em relação ao canvas

  const respCard = document.querySelector('[data-vital="respiratoryRate"]');
  const canvas = respCard && respCard.querySelector('.mon-wave-live');
  const pulmao = respCard && respCard.querySelector('.mon-card-icon img');
  const onda = { rpm: 0, atualizadoEm: 0, fase: 0, tFase: 0, hist: [], cor: '#8db365', corLida: 0, rodando: false };

  // Forma de um ciclo (fase em voltas): sobe de -1 a 1 na inspiração, desce na expiração, sem quinas
  function formaResp(voltas) {
    const p = voltas - Math.floor(voltas);
    return p < INSPIRA ? -Math.cos(Math.PI * p / INSPIRA) : Math.cos(Math.PI * (p - INSPIRA) / (1 - INSPIRA));
  }

  // Fase (em voltas) no instante t: interpola o histórico; antes dele, extrapola com o rpm atual
  function faseEm(t) {
    const h = onda.hist;
    if (!h.length || t <= h[0].t) {
      const t0 = h.length ? h[0].t : onda.tFase, f0 = h.length ? h[0].fase : onda.fase;
      return f0 - (t0 - t) / 1000 * onda.rpm / 60;
    }
    for (let i = h.length - 1; i > 0; i--) {
      if (h[i - 1].t <= t) {
        if (t >= h[i].t) return h[i].fase;
        const f = (t - h[i - 1].t) / (h[i].t - h[i - 1].t || 1);
        return h[i - 1].fase + f * (h[i].fase - h[i - 1].fase);
      }
    }
    return h[0].fase;
  }

  function desenhar(agora) {
    const viva = onda.rpm > 0 && agora - onda.atualizadoEm < SEM_SINAL_MS;
    respCard.classList.toggle('has-wave', viva);
    if (!viva) {
      onda.hist = [];
      if (pulmao) pulmao.style.transform = '';
      const c0 = canvas.getContext('2d'); c0.clearRect(0, 0, canvas.width, canvas.height);
      return false;
    }

    // fase += dt * rpm/60 (em voltas; 1 volta = 2π)
    if (onda.tFase) onda.fase += Math.max(0, agora - onda.tFase) / 1000 * onda.rpm / 60;
    onda.tFase = agora;
    onda.hist.push({ t: agora, fase: onda.fase });
    while (onda.hist.length > 2 && onda.hist[1].t < agora - JANELA_MS - 1000) onda.hist.shift();

    if (agora - onda.corLida > 1000) {                         // acompanha o tema claro/escuro
      const cor = getComputedStyle(canvas).getPropertyValue('--mon-accent-text').trim();
      if (cor) onda.cor = cor;
      onda.corLida = agora;
    }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.lineWidth = 2.5 * dpr; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = onda.cor;

    const meio = h / 2;
    g.beginPath();
    for (let x = 0; x < w; x++) {                              // rola da direita (agora) para a esquerda
      const t = agora - JANELA_MS + x / (w - 1) * JANELA_MS;
      const y = meio - formaResp(faseEm(t)) * meio * AMPLITUDE;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();

    if (pulmao) {                                              // o pulmão enche e esvazia com a onda
      pulmao.style.transformOrigin = 'center';
      pulmao.style.transform = 'scale(' + (1 + 0.12 * formaResp(onda.fase)).toFixed(3) + ')';
    }
    return true;
  }

  function quadro(agora) {
    if (desenhar(agora)) requestAnimationFrame(quadro); else onda.rodando = false;
  }

  // Chamada a cada leitura da API com o rpm do card (null/0 = sem medida válida: a onda some)
  function respDefinir(rpm) {
    if (!canvas) return;
    if (!(rpm > 0)) { onda.rpm = 0; if (!onda.rodando) desenhar(performance.now()); return; }
    onda.rpm = rpm;
    onda.atualizadoEm = performance.now();
    if (!onda.rodando) { onda.rodando = true; onda.tFase = 0; requestAnimationFrame(quadro); }
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

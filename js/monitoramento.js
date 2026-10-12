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
    id: 'A024',
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
    badge.textContent = status ? STATUS_LABEL[status] : 'Sem sinal';
    badge.dataset.status = status || 'none';
    card.classList.toggle('is-empty', !hasValue);
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

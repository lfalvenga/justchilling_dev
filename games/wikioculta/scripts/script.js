(() => {
  const API = 'https://pt.wikipedia.org/w/api.php';
  const ANALYTICS = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/top';
  const els = {
    article: document.getElementById('article'),
    title: document.getElementById('visibleTitle'),
    guess: document.getElementById('guess'),
    guessBtn: document.getElementById('guessBtn'),
    hintBtn: document.getElementById('hintBtn'),
    skipBtn: document.getElementById('skipBtn'),
    msg: document.getElementById('message'),
    score: document.getElementById('score'),
    round: document.getElementById('roundInfo'),
    value: document.getElementById('valueText'),
    meter: document.getElementById('valueMeter'),
    revealLink: document.getElementById('revealLink'),
    newLink: document.getElementById('newLink'),
    changeModeLink: document.getElementById('changeModeLink'),
    modeScreen: document.getElementById('modeScreen'),
    modeBadge: document.getElementById('modeBadge')
  };

  let answer = '';
  let pageId = null;
  let mode = null;
  let score = Number(localStorage.getItem('wikioculta-score') || 0);
  let round = Number(localStorage.getItem('wikioculta-round') || 1);
  let roundValue = 100;
  let hintStage = 0;
  let letterHintOrder = [];
  let letterHintLimit = 0;
  let letterHintsUsed = 0;
  let finished = false;
  let controller = null;
  let popularPool = null;
  let roundCapital = [];
  let roundAliases = [];
  let pronunciationRedactions = 0;
  let foreignNameRedactions = 0;
  let answerTokens = [];
  let revealedTitleIndices = new Set();
  const seenNormal = new Set();
  const seenPaises = new Set();

  // Lista estática dos 193 estados-membros da ONU (título do artigo em pt.wikipedia + capital).
  // Quando um país tem mais de uma capital, foi escolhida uma única forma canônica — ver nota ao usuário.
  const COUNTRIES = [
    {title:'África do Sul', capital:'Pretória', aliases:[]},
    {title:'Angola', capital:'Luanda', aliases:[]},
    {title:'Argélia', capital:'Argel', aliases:[]},
    {title:'Benin', capital:'Porto-Novo', aliases:[]},
    {title:'Botsuana', capital:'Gaborone', aliases:[]},
    {title:'Burquina Fasso', capital:'Uagadugu', aliases:[]},
    {title:'Burundi', capital:'Gitega', aliases:[]},
    {title:'Cabo Verde', capital:'Praia', aliases:[]},
    {title:'Camarões', capital:'Iaundé', aliases:[]},
    {title:'Chade', capital:'Ndjamena', aliases:[]},
    {title:'Comores', capital:'Moroni', aliases:[]},
    {title:'República do Congo', capital:'Brazzaville', aliases:['Congo-Brazzaville']},
    {title:'República Democrática do Congo', capital:'Quinxassa', aliases:['Congo-Kinshasa']},
    {title:'Costa do Marfim', capital:'Iamussucro', aliases:[]},
    {title:'Djibouti', capital:'Djibouti', aliases:[]},
    {title:'Egito', capital:'Cairo', aliases:[]},
    {title:'Eritreia', capital:'Asmara', aliases:[]},
    {title:'Essuatíni', capital:'Mbabane', aliases:['Suazilândia']},
    {title:'Etiópia', capital:'Adis Abeba', aliases:[]},
    {title:'Gabão', capital:'Libreville', aliases:[]},
    {title:'Gâmbia', capital:'Banjul', aliases:[]},
    {title:'Gana', capital:'Acra', aliases:[]},
    {title:'Guiné', capital:'Conacri', aliases:[]},
    {title:'Guiné-Bissau', capital:'Bissau', aliases:[]},
    {title:'Guiné Equatorial', capital:'Malabo', aliases:[]},
    {title:'Quênia', capital:'Nairóbi', aliases:[]},
    {title:'Lesoto', capital:'Maseru', aliases:[]},
    {title:'Libéria', capital:'Monróvia', aliases:[]},
    {title:'Líbia', capital:'Trípoli', aliases:[]},
    {title:'Madagáscar', capital:'Antananarivo', aliases:[]},
    {title:'Malawi', capital:'Lilongwe', aliases:[]},
    {title:'Mali', capital:'Bamacô', aliases:[]},
    {title:'Marrocos', capital:'Rabat', aliases:[]},
    {title:'Maurícia', capital:'Porto Luís', aliases:[]},
    {title:'Mauritânia', capital:'Nuaquechote', aliases:[]},
    {title:'Moçambique', capital:'Maputo', aliases:[]},
    {title:'Namíbia', capital:'Vinduque', aliases:[]},
    {title:'Níger', capital:'Niamei', aliases:[]},
    {title:'Nigéria', capital:'Abuja', aliases:[]},
    {title:'República Centro-Africana', capital:'Bangui', aliases:[]},
    {title:'Ruanda', capital:'Quigali', aliases:[]},
    {title:'São Tomé e Príncipe', capital:'São Tomé', aliases:[]},
    {title:'Senegal', capital:'Dacar', aliases:[]},
    {title:'Serra Leoa', capital:'Freetown', aliases:[]},
    {title:'Seicheles', capital:'Vitória', aliases:[]},
    {title:'Somália', capital:'Mogadíscio', aliases:[]},
    {title:'Sudão', capital:'Cartum', aliases:[]},
    {title:'Sudão do Sul', capital:'Juba', aliases:[]},
    {title:'Tanzânia', capital:'Dodoma', aliases:[]},
    {title:'Togo', capital:'Lomé', aliases:[]},
    {title:'Tunísia', capital:'Tunes', aliases:[]},
    {title:'Uganda', capital:'Campala', aliases:[]},
    {title:'Zâmbia', capital:'Lusaca', aliases:[]},
    {title:'Zimbábue', capital:'Harare', aliases:[]},
    {title:'Afeganistão', capital:'Cabul', aliases:[]},
    {title:'Arábia Saudita', capital:'Riade', aliases:[]},
    {title:'Bahrein', capital:'Manama', aliases:[]},
    {title:'Bangladesh', capital:'Daca', aliases:[]},
    {title:'Butão', capital:'Thimphu', aliases:[]},
    {title:'Brunei', capital:'Bandar Seri Begawan', aliases:[]},
    {title:'Camboja', capital:'Pnom Penh', aliases:[]},
    {title:'Catar', capital:'Doha', aliases:[]},
    {title:'Cazaquistão', capital:'Astana', aliases:[]},
    {title:'Coreia do Norte', capital:'Pyongyang', aliases:[]},
    {title:'Coreia do Sul', capital:'Seul', aliases:[]},
    {title:'China', capital:'Pequim', aliases:[]},
    {title:'Chipre', capital:'Nicósia', aliases:[]},
    {title:'Emirados Árabes Unidos', capital:'Abu Dhabi', aliases:[]},
    {title:'Filipinas', capital:'Manila', aliases:[]},
    {title:'Índia', capital:'Nova Deli', aliases:[]},
    {title:'Indonésia', capital:'Jacarta', aliases:[]},
    {title:'Irã', capital:'Teerã', aliases:['Pérsia']},
    {title:'Iraque', capital:'Bagdá', aliases:[]},
    {title:'Israel', capital:'Jerusalém', aliases:[]},
    {title:'Japão', capital:'Tóquio', aliases:[]},
    {title:'Jordânia', capital:'Amã', aliases:[]},
    {title:'Kuwait', capital:'Cidade do Kuwait', aliases:[]},
    {title:'Laos', capital:'Vientiane', aliases:[]},
    {title:'Líbano', capital:'Beirute', aliases:[]},
    {title:'Malásia', capital:'Kuala Lumpur', aliases:[]},
    {title:'Maldivas', capital:'Malé', aliases:[]},
    {title:'Mianmar', capital:'Naypyidaw', aliases:['Birmânia']},
    {title:'Mongólia', capital:'Ulan Bator', aliases:[]},
    {title:'Nepal', capital:'Catmandu', aliases:[]},
    {title:'Omã', capital:'Mascate', aliases:[]},
    {title:'Paquistão', capital:'Islamabad', aliases:[]},
    {title:'Quirguistão', capital:'Bisqueque', aliases:[]},
    {title:'Singapura', capital:'Singapura', aliases:[]},
    {title:'Síria', capital:'Damasco', aliases:[]},
    {title:'Sri Lanka', capital:'Colombo', aliases:['Ceilão']},
    {title:'Tailândia', capital:'Banguecoque', aliases:[]},
    {title:'Tajiquistão', capital:'Duchambe', aliases:[]},
    {title:'Timor-Leste', capital:'Díli', aliases:['Timor Leste']},
    {title:'Turcomenistão', capital:'Asgabate', aliases:[]},
    {title:'Turquia', capital:'Ancara', aliases:['Türkiye']},
    {title:'Uzbequistão', capital:'Tasquente', aliases:[]},
    {title:'Vietnã', capital:'Hanói', aliases:[]},
    {title:'Iêmen', capital:'Sanaa', aliases:[]},
    {title:'Armênia', capital:'Ierevan', aliases:[]},
    {title:'Azerbaijão', capital:'Baku', aliases:[]},
    {title:'Geórgia', capital:'Tbilisi', aliases:[]},
    {title:'Albânia', capital:'Tirana', aliases:[]},
    {title:'Alemanha', capital:'Berlim', aliases:[]},
    {title:'Andorra', capital:'Andorra-a-Velha', aliases:[]},
    {title:'Áustria', capital:'Viena', aliases:[]},
    {title:'Bélgica', capital:'Bruxelas', aliases:[]},
    {title:'Bielorrússia', capital:'Minsk', aliases:[]},
    {title:'Bósnia e Herzegovina', capital:'Sarajevo', aliases:[]},
    {title:'Bulgária', capital:'Sófia', aliases:[]},
    {title:'Croácia', capital:'Zagreb', aliases:[]},
    {title:'Dinamarca', capital:'Copenhague', aliases:[]},
    {title:'Eslováquia', capital:'Bratislava', aliases:[]},
    {title:'Eslovênia', capital:'Liubliana', aliases:[]},
    {title:'Espanha', capital:'Madrid', aliases:[]},
    {title:'Estônia', capital:'Talin', aliases:[]},
    {title:'Finlândia', capital:'Helsínquia', aliases:[]},
    {title:'França', capital:'Paris', aliases:[]},
    {title:'Grécia', capital:'Atenas', aliases:[]},
    {title:'Hungria', capital:'Budapeste', aliases:[]},
    {title:'Irlanda', capital:'Dublin', aliases:[]},
    {title:'Islândia', capital:'Reiquiavique', aliases:[]},
    {title:'Itália', capital:'Roma', aliases:[]},
    {title:'Letônia', capital:'Riga', aliases:[]},
    {title:'Listenstaine', capital:'Vaduz', aliases:[]},
    {title:'Lituânia', capital:'Vilnius', aliases:[]},
    {title:'Luxemburgo', capital:'Luxemburgo', aliases:[]},
    {title:'Macedônia do Norte', capital:'Escópia', aliases:[]},
    {title:'Malta', capital:'Valeta', aliases:[]},
    {title:'Moldávia', capital:'Chisinau', aliases:[]},
    {title:'Mônaco', capital:'Mônaco', aliases:[]},
    {title:'Montenegro', capital:'Podgorica', aliases:[]},
    {title:'Noruega', capital:'Oslo', aliases:[]},
    {title:'Países Baixos', capital:'Amsterdã', aliases:['Holanda']},
    {title:'Polônia', capital:'Varsóvia', aliases:[]},
    {title:'Portugal', capital:'Lisboa', aliases:[]},
    {title:'Reino Unido', capital:'Londres', aliases:[]},
    {title:'República Tcheca', capital:'Praga', aliases:[]},
    {title:'Romênia', capital:'Bucareste', aliases:[]},
    {title:'Rússia', capital:'Moscou', aliases:[]},
    {title:'San Marino', capital:'San Marino', aliases:[]},
    {title:'Sérvia', capital:'Belgrado', aliases:[]},
    {title:'Suécia', capital:'Estocolmo', aliases:[]},
    {title:'Suíça', capital:'Berna', aliases:[]},
    {title:'Ucrânia', capital:'Kiev', aliases:[]},
    {title:'Austrália', capital:'Camberra', aliases:[]},
    {title:'Fiji', capital:'Suva', aliases:[]},
    {title:'Ilhas Marshall', capital:'Majuro', aliases:[]},
    {title:'Ilhas Salomão', capital:'Honiara', aliases:[]},
    {title:'Kiribati', capital:'Tarawa Sul', aliases:[]},
    {title:'Micronésia', capital:'Palikir', aliases:[]},
    {title:'Nauru', capital:'Iaren', aliases:[]},
    {title:'Nova Zelândia', capital:'Wellington', aliases:[]},
    {title:'Palau', capital:'Ngerulmud', aliases:[]},
    {title:'Papua-Nova Guiné', capital:'Port Moresby', aliases:[]},
    {title:'Samoa', capital:'Apia', aliases:[]},
    {title:'Tonga', capital:'Nukualofa', aliases:[]},
    {title:'Tuvalu', capital:'Funafuti', aliases:[]},
    {title:'Vanuatu', capital:'Port Vila', aliases:[]},
    {title:'Canadá', capital:'Otava', aliases:[]},
    {title:'Estados Unidos', capital:'Washington, D.C.', aliases:[]},
    {title:'México', capital:'Cidade do México', aliases:[]},
    {title:'Belize', capital:'Belmopan', aliases:[]},
    {title:'Costa Rica', capital:'San José', aliases:[]},
    {title:'El Salvador', capital:'San Salvador', aliases:[]},
    {title:'Guatemala', capital:'Cidade da Guatemala', aliases:[]},
    {title:'Honduras', capital:'Tegucigalpa', aliases:[]},
    {title:'Nicarágua', capital:'Manágua', aliases:[]},
    {title:'Panamá', capital:'Cidade do Panamá', aliases:[]},
    {title:'Antígua e Barbuda', capital:'Saint John\'s', aliases:[]},
    {title:'Bahamas', capital:'Nassau', aliases:[]},
    {title:'Barbados', capital:'Bridgetown', aliases:[]},
    {title:'Cuba', capital:'Havana', aliases:[]},
    {title:'Dominica', capital:'Roseau', aliases:[]},
    {title:'República Dominicana', capital:'Santo Domingo', aliases:[]},
    {title:'Granada', capital:'Saint George\'s', aliases:[]},
    {title:'Haiti', capital:'Porto Príncipe', aliases:[]},
    {title:'Jamaica', capital:'Kingston', aliases:[]},
    {title:'São Cristóvão e Neves', capital:'Basseterre', aliases:[]},
    {title:'Santa Lúcia', capital:'Castries', aliases:[]},
    {title:'São Vicente e Granadinas', capital:'Kingstown', aliases:[]},
    {title:'Trinidad e Tobago', capital:'Porto de Espanha', aliases:[]},
    {title:'Argentina', capital:'Buenos Aires', aliases:[]},
    {title:'Bolívia', capital:'Sucre', aliases:[]},
    {title:'Brasil', capital:'Brasília', aliases:[]},
    {title:'Chile', capital:'Santiago', aliases:[]},
    {title:'Colômbia', capital:'Bogotá', aliases:[]},
    {title:'Equador', capital:'Quito', aliases:[]},
    {title:'Guiana', capital:'Georgetown', aliases:[]},
    {title:'Paraguai', capital:'Assunção', aliases:[]},
    {title:'Peru', capital:'Lima', aliases:[]},
    {title:'Suriname', capital:'Paramaribo', aliases:[]},
    {title:'Uruguai', capital:'Montevidéu', aliases:[]},
    {title:'Venezuela', capital:'Caracas', aliases:[]}
  ];

  els.score.textContent = score;
  els.round.textContent = `Rodada ${round}`;

  function normalize(s) {
    return (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[_–—-]/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function baseTitle(t) {
    return t.replace(/\s*\([^)]*\)\s*$/, '').trim();
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const ACCENT_CLASSES = {
    a: 'aàáâãä',
    e: 'eèéêë',
    i: 'iìíîï',
    o: 'oòóôõö',
    u: 'uùúûü',
    c: 'cç',
    n: 'nñ',
    y: 'yýÿ'
  };

  function buildLoosePattern(str) {
    return Array.from(str).map(ch => {
      if (/[.*+?^${}()|[\]\\]/.test(ch)) return '\\' + ch;
      const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const cls = ACCENT_CLASSES[base];
      return cls ? `[${cls}]` : ch;
    }).join('');
  }

  function isAlphaNum(ch) {
    return /[\p{L}\p{N}]/u.test(ch);
  }

  function toStringArray(v) {
    if (!v) return [];
    return (Array.isArray(v) ? v : [v]).filter(Boolean);
  }

  function setMessage(text, cls='muted') {
    els.msg.className = cls;
    els.msg.textContent = text;
  }

  function setRoundValue(v) {
    roundValue = Math.max(0, v);
    els.value.textContent = `${roundValue} pontos`;
    els.meter.style.width = `${roundValue}%`;
  }

  function modeName() {
    if (mode === 'normal') return 'Normal · conhecidos';
    if (mode === 'paises') return 'Países · geografia';
    return 'Difícil · todos';
  }

  function setModeUI() {
    if (!mode) return;
    els.modeBadge.style.display = 'block';
    els.modeBadge.textContent = `Modo: ${modeName()}`;
  }

  async function api(params, signal) {
    const url = new URL(API);
    Object.entries({...params, format:'json', origin:'*'}).forEach(([k,v]) => url.searchParams.set(k,v));
    const r = await fetch(url, {signal});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function previousCompletedMonths(count=3) {
    const now = new Date();
    const out = [];
    for (let i = 1; i <= count; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      out.push({
        year: d.getUTCFullYear(),
        month: String(d.getUTCMonth() + 1).padStart(2, '0')
      });
    }
    return out;
  }

  async function fetchPopularMonth(year, month, signal) {
    const url = `${ANALYTICS}/pt.wikipedia.org/all-access/${year}/${month}/all-days`;
    const r = await fetch(url, {signal, headers:{'Accept':'application/json'}});
    if (!r.ok) throw new Error(`Analytics HTTP ${r.status}`);
    const data = await r.json();
    return data?.items?.[0]?.articles || [];
  }

  function decodeArticleTitle(raw) {
    const spaced = String(raw || '').replace(/_/g, ' ');
    try { return decodeURIComponent(spaced); } catch { return spaced; }
  }

  function eligiblePopularTitle(title) {
    const t = title.trim();
    if (!t || t.length < 3 || t.length > 100) return false;
    if (/^\d{1,4}$/.test(t)) return false;
    if (/^(Página principal|Main Page)$/i.test(t)) return false;
    if (/^(Especial|Wikipédia|Wikipedia|Ficheiro|Arquivo|Ajuda|Categoria|Portal|Predefinição|MediaWiki|Usuário|Utilizador|Discussão|Livro|Módulo):/i.test(t)) return false;
    return true;
  }

  async function getPopularPool(signal) {
    if (popularPool?.length) return popularPool;

    const months = previousCompletedMonths(3);
    const results = await Promise.allSettled(
      months.map(m => fetchPopularMonth(m.year, m.month, signal))
    );
    const successful = results.filter(r => r.status === 'fulfilled');
    if (!successful.length) throw new Error('A lista de artigos populares não pôde ser carregada.');

    const aggregate = new Map();
    for (const result of successful) {
      for (const item of result.value) {
        const title = decodeArticleTitle(item.article);
        if (!eligiblePopularTitle(title)) continue;
        const key = title.toLocaleLowerCase('pt-BR');
        const current = aggregate.get(key) || {title, views:0, months:0};
        current.views += Number(item.views || 0);
        current.months += 1;
        aggregate.set(key, current);
      }
    }

    const minMonths = Math.min(2, successful.length);
    popularPool = [...aggregate.values()]
      .filter(x => x.months >= minMonths)
      .sort((a,b) => b.views - a.views)
      .slice(0, 350);

    if (popularPool.length < 30) {
      popularPool = [...aggregate.values()]
        .sort((a,b) => b.views - a.views)
        .slice(0, 350);
    }
    if (!popularPool.length) throw new Error('A lista de artigos populares veio vazia.');
    return popularPool;
  }

  async function getCandidate(signal) {
    if (mode === 'hard') {
      const rnd = await api({
        action:'query', list:'random', rnnamespace:'0', rnlimit:'1'
      }, signal);
      return {pageid:rnd.query.random[0].id, title:rnd.query.random[0].title};
    }

    if (mode === 'paises') {
      for (let attempt = 0; attempt < 30; attempt++) {
        const index = Math.floor(Math.random() * COUNTRIES.length);
        const candidate = COUNTRIES[index];
        const key = candidate.title.toLocaleLowerCase('pt-BR');
        if (!seenPaises.has(key) || seenPaises.size > COUNTRIES.length * .75) {
          seenPaises.add(key);
          return {title:candidate.title, capital:candidate.capital, aliases:candidate.aliases};
        }
      }
      const candidate = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
      return {title:candidate.title, capital:candidate.capital, aliases:candidate.aliases};
    }

    const pool = await getPopularPool(signal);
    for (let attempt = 0; attempt < 30; attempt++) {
      const index = Math.floor(Math.pow(Math.random(), 1.35) * pool.length);
      const candidate = pool[Math.min(index, pool.length - 1)];
      const key = candidate.title.toLocaleLowerCase('pt-BR');
      if (!seenNormal.has(key) || seenNormal.size > pool.length * .75) {
        seenNormal.add(key);
        return {title:candidate.title, popularity:candidate.views};
      }
    }
    return {title:pool[Math.floor(Math.random() * pool.length)].title};
  }

  async function parseCandidate(candidate, signal) {
    const params = {
      action:'parse',
      prop:'text|displaytitle',
      disabletoc:'1',
      disableeditsection:'1'
    };
    if (candidate.pageid) params.pageid = candidate.pageid;
    else params.page = candidate.title;
    return api(params, signal);
  }

  async function loadRound() {
    if (!mode) return;
    if (controller) controller.abort();
    controller = new AbortController();
    const signal = controller.signal;

    finished = false;
    hintStage = 0;
    letterHintOrder = [];
    letterHintLimit = 0;
    letterHintsUsed = 0;
    pronunciationRedactions = 0;
    foreignNameRedactions = 0;
    answerTokens = [];
    revealedTitleIndices = new Set();
    setRoundValue(100);
    answer = '';
    pageId = null;
    roundCapital = [];
    roundAliases = [];
    els.guess.value = '';
    els.guess.disabled = true;
    els.guessBtn.disabled = true;
    els.hintBtn.disabled = true;
    els.hintBtn.textContent = 'Dica';
    els.title.innerHTML = '<span class="title-blank" aria-label="título oculto"></span>';
    els.article.innerHTML = '<div class="loading">Buscando artigo…</div>';
    setMessage(mode === 'normal' ? 'Buscando um artigo conhecido…' : mode === 'paises' ? 'Sorteando um país…' : 'Buscando um artigo aleatório…');

    try {
      let tries = 0;
      let parsed = null;
      while (tries < 10) {
        tries++;
        const candidate = await getCandidate(signal);
        const data = await parseCandidate(candidate, signal);

        const html = data?.parse?.text?.['*'] || '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const paragraphs = [...tmp.querySelectorAll('.mw-parser-output > p')]
          .filter(p => p.textContent.trim().length > 80);

        if (paragraphs.length >= 2) {
          parsed = { candidate, data, tmp };
          break;
        }
      }

      if (!parsed) throw new Error('Não encontrei um artigo adequado.');

      answer = parsed.data.parse.title;
      pageId = parsed.data.parse.pageid;
      roundCapital = mode === 'paises' ? toStringArray(parsed.candidate.capital) : [];
      roundAliases = mode === 'paises' ? (parsed.candidate.aliases || []) : [];
      prepareAnswerModel();
      renderTitleRedaction();
      renderArticle(parsed.tmp);
      prepareHints();
      els.guess.disabled = false;
      els.guessBtn.disabled = false;
      updateHintButton();
      els.guess.focus();
      setMessage(mode === 'normal'
        ? 'Modo Normal: artigo escolhido entre páginas de alta popularidade sustentada.'
        : mode === 'paises'
        ? 'Modo Países: nome do país, capital, negritos e formas locais/oficiais sensíveis estão ocultos no texto.'
        : 'Modo Difícil: qualquer artigo da Wikipédia pode aparecer.');
    } catch (err) {
      if (err.name === 'AbortError') return;
      els.article.innerHTML = `
        <div class="error">
          Não foi possível carregar este modo agora. Verifique sua conexão e tente “Pular” ou troque de modo.
        </div>`;
      setMessage(err.message || 'Falha ao carregar o artigo.', 'bad');
    }
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const prev = Array.from({length:b.length + 1}, (_,i) => i);
    const cur = new Array(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          cur[j-1] + 1,
          prev[j] + 1,
          prev[j-1] + (a[i-1] === b[j-1] ? 0 : 1)
        );
      }
      for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }

  function fuzzyEquivalent(a, b) {
    const x = normalize(a).replace(/\s+/g, '');
    const y = normalize(b).replace(/\s+/g, '');
    if (!x || !y) return false;
    if (x === y) return true;
    const maxLen = Math.max(x.length, y.length);
    const minLen = Math.min(x.length, y.length);
    if (minLen < 4 || Math.abs(x.length - y.length) > 2) return false;
    const maxDistance = maxLen >= 12 ? 2 : 1;
    const d = levenshtein(x, y);
    if (d > maxDistance || d / maxLen > .20) return false;
    return x[0] === y[0] || x.slice(0,2) === y.slice(0,2) || x.at(-1) === y.at(-1);
  }

  function parseAnswerTokens(text) {
    const chars = Array.from(text);
    const out = [];
    let start = -1;
    for (let i = 0; i <= chars.length; i++) {
      const ch = chars[i];
      if (i < chars.length && isAlphaNum(ch)) {
        if (start < 0) start = i;
      } else if (start >= 0) {
        const raw = chars.slice(start, i).join('');
        out.push({raw, norm:normalize(raw), start, end:i, index:out.length});
        start = -1;
      }
    }
    return out;
  }

  function prepareAnswerModel() {
    answerTokens = parseAnswerTokens(baseTitle(answer));
  }

  function makeRedaction(text, options={}) {
    const {isTitle=false, role='answer', tokenIndex=null} = options;
    const box = document.createElement('span');
    box.className = `redaction${isTitle ? ' title-redaction' : ''}`;
    box.dataset.role = role;
    if (tokenIndex !== null) box.dataset.answerToken = String(tokenIndex);
    const aria = role === 'pronunciation' ? 'pronúncia ocultada'
      : role === 'foreign-name' ? 'nome local ou oficial ocultado'
      : role === 'bold' ? 'trecho em negrito ocultado'
      : 'termo oculto';
    box.setAttribute('aria-label', aria);

    Array.from(text).forEach((ch, i) => {
      const c = document.createElement('span');
      c.className = 'redaction-char';
      c.dataset.charIndex = String(i);
      if (isTitle) c.dataset.answerIndex = String(i);
      c.textContent = ch === ' ' ? '\u00a0' : ch;
      box.appendChild(c);
    });
    return box;
  }

  function renderTitleRedaction() {
    els.title.innerHTML = '';
    els.title.appendChild(makeRedaction(answer, {isTitle:true, role:'title'}));
  }

  function revealTitleIndices(indices) {
    for (const index of indices) revealedTitleIndices.add(index);
    const titleBox = els.title.querySelector('.title-redaction');
    if (!titleBox) return;
    titleBox.querySelectorAll('.redaction-char[data-answer-index]').forEach(c => {
      if (revealedTitleIndices.has(Number(c.dataset.answerIndex))) c.classList.add('is-revealed');
    });
  }

  function revealAnswerToken(tokenIndex) {
    const token = answerTokens[tokenIndex];
    if (!token) return false;
    const indices = [];
    for (let i = token.start; i < token.end; i++) indices.push(i);
    const wasNew = indices.some(i => !revealedTitleIndices.has(i));
    revealTitleIndices(indices);
    document.querySelectorAll(`.redaction[data-role="answer-word"][data-answer-token="${tokenIndex}"]`).forEach(b => b.classList.add('revealed'));
    return wasNew;
  }

  function visibleTitleLetterCount() {
    return [...revealedTitleIndices].filter(i => isAlphaNum(Array.from(baseTitle(answer))[i] || '')).length;
  }

  function prepareHints() {
    const chars = Array.from(baseTitle(answer));
    const alphaPositions = chars.map((ch,i) => isAlphaNum(ch) ? i : -1).filter(i => i >= 0);
    const starts = [];
    const ends = [];
    for (let i = 0; i < chars.length; i++) {
      if (!isAlphaNum(chars[i])) continue;
      if (i === 0 || !isAlphaNum(chars[i-1])) starts.push(i);
      if (i === chars.length - 1 || !isAlphaNum(chars[i+1])) ends.push(i);
    }
    const special = [...new Set([...starts, ...ends])];
    const remaining = alphaPositions.filter(i => !special.includes(i));
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    letterHintOrder = [...special, ...remaining];
    letterHintLimit = Math.ceil(alphaPositions.length / 2);
    letterHintsUsed = 0;

    hintStage = roundCapital.length ? 0 : ((pronunciationRedactions || foreignNameRedactions) ? 1 : 2);
  }

  function updateHintButton() {
    if (finished || !answer) {
      els.hintBtn.disabled = true;
      return;
    }
    if (hintStage === 0 && roundCapital.length) {
      els.hintBtn.textContent = 'Dica: capital';
      els.hintBtn.disabled = false;
      return;
    }
    if (hintStage <= 1 && (pronunciationRedactions || foreignNameRedactions || roundCapital.length)) {
      hintStage = 1;
      els.hintBtn.textContent = foreignNameRedactions ? 'Dica: pronúncia + nome local' : 'Dica: pronúncia';
      els.hintBtn.disabled = false;
      return;
    }
    hintStage = 2;
    const canRevealLetter = visibleTitleLetterCount() < letterHintLimit &&
      letterHintOrder.some(i => !revealedTitleIndices.has(i));
    els.hintBtn.textContent = 'Dica: letra';
    els.hintBtn.disabled = !canRevealLetter;
  }

  function disableArticleLinks(root) {
    root.querySelectorAll('a').forEach(a => {
      const span = document.createElement('span');
      span.className = 'wiki-link';
      span.setAttribute('aria-disabled', 'true');
      while (a.firstChild) span.appendChild(a.firstChild);
      a.replaceWith(span);
    });
    root.querySelectorAll('[title]').forEach(el => el.removeAttribute('title'));
  }

  function hideBoldText(root) {
    const bolds = [...root.querySelectorAll('b,strong')];
    bolds.forEach(el => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.parentElement?.closest('.redaction')) nodes.push(node);
      }
      nodes.forEach(node => {
        const text = node.nodeValue || '';
        if (!text.trim()) return;
        const frag = document.createDocumentFragment();
        const lead = text.match(/^\s*/)?.[0] || '';
        const trail = text.match(/\s*$/)?.[0] || '';
        const coreStart = lead.length;
        const coreEnd = Math.max(coreStart, text.length - trail.length);
        if (lead) frag.appendChild(document.createTextNode(lead));
        if (coreEnd > coreStart) frag.appendChild(makeRedaction(text.slice(coreStart, coreEnd), {role:'bold'}));
        if (trail) frag.appendChild(document.createTextNode(trail));
        node.parentNode.replaceChild(frag, node);
      });
    });
  }

  function languageIsPortuguese(el) {
    const lang = (el.getAttribute?.('lang') || el.closest?.('[lang]')?.getAttribute('lang') || '').toLowerCase();
    return lang === 'pt' || lang.startsWith('pt-');
  }

  function textBeforeElement(container, el, maxChars=180) {
    try {
      const range = document.createRange();
      range.selectNodeContents(container);
      range.setEndBefore(el);
      return range.toString().slice(-maxChars);
    } catch {
      return '';
    }
  }

  function looksLikeForeignOfficialName(el) {
    const text = (el.textContent || '').trim();
    if (text.length < 2 || text.length > 220) return false;
    if (el.closest('.redaction')) return false;

    const container = el.closest('p,li,dd,blockquote');
    if (!container) return false;
    const before = textBeforeElement(container, el, 220);

    const explicitLang = el.matches('[lang]') || !!el.closest('[lang]');
    const nearLanguageMarker = /(?:\(|;|^)\s*(?:em|no|na)\s+[\p{L}\p{M}][\p{L}\p{M}\s–—-]{1,70}\s*(?::|,)\s*$/iu.test(before);
    if (explicitLang && !languageIsPortuguese(el) && (nearLanguageMarker || before.length < 120)) return true;

    return nearLanguageMarker ||
      /(?:oficialmente|nome\s+oficial|denomina(?:ção|cao)\s+oficial)\s*(?::|,)?\s*$/iu.test(before);
  }

  function textNodesWithOffsets(container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const out = [];
    let pos = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const len = (node.nodeValue || '').length;
      out.push({node, start:pos, end:pos + len});
      pos += len;
    }
    return out;
  }

  function replaceFlatRange(container, start, end, role) {
    if (!(end > start)) return false;
    const map = textNodesWithOffsets(container);
    const first = map.find(x => start >= x.start && start < x.end);
    const last = [...map].reverse().find(x => end > x.start && end <= x.end);
    if (!first || !last) return false;

    if (first.node.parentElement?.closest('.redaction') || last.node.parentElement?.closest('.redaction')) return false;

    const range = document.createRange();
    range.setStart(first.node, start - first.start);
    range.setEnd(last.node, end - last.start);
    const hiddenText = range.toString();
    if (!hiddenText.trim()) return false;
    range.deleteContents();
    range.insertNode(makeRedaction(hiddenText, {role}));
    return true;
  }

  function collectForeignNameRanges(text) {
    const ranges = [];

    const languageRe = /((?:^|[;(]\s*)\b(?:em|no|na)\s+[\p{L}\p{M}][\p{L}\p{M}\s–—-]{1,70}\s*(?::|,)\s*)([^;)\n]{2,220})/giu;
    for (const m of text.matchAll(languageRe)) {
      let name = m[2];
      let localStart = m.index + m[1].length;

      const stop = name.search(/\s*(?:;|,\s*(?:pronunciad[oa]|literalmente|lit\.|AFI|IPA|aportuguesad[oa]|romanizad[oa]|transliterad[oa])\b)/iu);
      if (stop >= 0) name = name.slice(0, stop);

      const lead = name.match(/^\s*/)?.[0].length || 0;
      const trail = name.match(/\s*$/)?.[0].length || 0;
      const start = localStart + lead;
      const end = localStart + name.length - trail;
      if (end - start >= 2) ranges.push({start, end});
    }

    const officialRe = /((?:oficialmente|nome\s+oficial|denomina(?:ção|cao)\s+oficial)\s*(?::|,)\s*)([^;)\n]{2,220})/giu;
    for (const m of text.matchAll(officialRe)) {
      const lead = m[2].match(/^\s*/)?.[0].length || 0;
      const trail = m[2].match(/\s*$/)?.[0].length || 0;
      const start = m.index + m[1].length + lead;
      const end = m.index + m[0].length - trail;
      if (end - start >= 2) ranges.push({start, end});
    }

    ranges.sort((a,b) => a.start - b.start || (b.end-b.start) - (a.end-a.start));
    const chosen = [];
    for (const r of ranges) {
      if (chosen.some(c => r.start < c.end && r.end > c.start)) continue;
      chosen.push(r);
    }
    return chosen;
  }

  function hideForeignOfficialNames(root) {
    let count = 0;
    const leadBlocks = [...root.querySelectorAll('p')].slice(0, 5);

    leadBlocks.forEach(block => {
      const flat = block.textContent || '';
      const ranges = collectForeignNameRanges(flat);
      [...ranges].sort((a,b) => b.start - a.start).forEach(r => {
        if (replaceFlatRange(block, r.start, r.end, 'foreign-name')) count++;
      });
    });

    const candidates = [];
    leadBlocks.forEach(block => {
      block.querySelectorAll('i,em,[lang]').forEach(el => {
        if (looksLikeForeignOfficialName(el)) candidates.push(el);
      });
    });
    const unique = [...new Set(candidates)].filter(el =>
      !candidates.some(other => other !== el && other.contains(el))
    );
    unique.forEach(el => {
      if (!el.isConnected || el.closest('.redaction')) return;
      const text = (el.textContent || '').trim();
      if (!text) return;
      el.textContent = '';
      el.appendChild(makeRedaction(text, {role:'foreign-name'}));
      count++;
    });

    foreignNameRedactions = count;
  }

  function hidePronunciations(root) {
    let count = 0;
    const selectors = [
      '.IPA', '.ipa', '.pronunciation', '.pron', '.mw-ipa',
      '[class~="IPA"]', '[class*="pronunciation"]',
      '[data-pronunciation]', '[lang][class*="IPA"]'
    ];
    const candidates = [...new Set(root.querySelectorAll(selectors.join(',')))];
    candidates.forEach(el => {
      if (el.closest('.redaction')) return;
      const text = el.textContent.trim();
      if (text.length < 2 || text.length > 160) return;
      el.textContent = '';
      el.appendChild(makeRedaction(text, {role:'pronunciation'}));
      count++;
    });

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest('.redaction')) nodes.push(node);
    }
    const ipaChars = /[ɐ-ʯˈˌ̩̯̃]/u;
    nodes.forEach(node => {
      const text = node.nodeValue || '';
      const re = /(\/[^/\n]{2,80}\/|\[[^\]\n]{2,80}\])/gu;
      const matches = [...text.matchAll(re)].filter(m => ipaChars.test(m[0]));
      if (!matches.length) return;
      const frag = document.createDocumentFragment();
      let last = 0;
      matches.forEach(m => {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        frag.appendChild(makeRedaction(m[0], {role:'pronunciation'}));
        count++;
        last = m.index + m[0].length;
      });
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
    pronunciationRedactions = count;
  }

  function buildFlexiblePhrasePattern(str) {
    const parts = String(str).trim().split(/[\s_–—-]+/).filter(Boolean);
    return parts.map(buildLoosePattern).join('[\\s_–—-]+');
  }

  function isWordContinuation(ch) {
    return !!ch && /[\p{L}\p{M}\p{N}]/u.test(ch);
  }

  function hasWholeTokenBoundaries(text, start, end) {
    const before = start > 0 ? text[start - 1] : '';
    const after = end < text.length ? text[end] : '';
    return !isWordContinuation(before) && !isWordContinuation(after);
  }

  function collectTextMatches(text) {
    const matches = [];

    const titleTargets = [...new Set([answer, baseTitle(answer)].filter(Boolean))]
      .filter(t => t.length >= 3);
    titleTargets.forEach(target => {
      const re = new RegExp(buildFlexiblePhrasePattern(target), 'giu');
      for (const m of text.matchAll(re)) {
        const start = m.index;
        const end = m.index + m[0].length;
        if (!hasWholeTokenBoundaries(text, start, end)) continue;
        matches.push({start, end, text:m[0], role:'answer-phrase', tokenIndex:null, priority:5});
      }
    });

    const exactTargets = [
      ...roundCapital.map(t => ({text:t, role:'capital'})),
      ...roundAliases.map(t => ({text:t, role:'alias'}))
    ].filter(x => x.text && x.text.length >= 3);

    exactTargets.forEach(target => {
      const re = new RegExp(buildFlexiblePhrasePattern(target.text), 'giu');
      for (const m of text.matchAll(re)) {
        const start = m.index;
        const end = m.index + m[0].length;
        if (!hasWholeTokenBoundaries(text, start, end)) continue;
        matches.push({start, end, text:m[0], role:target.role, tokenIndex:null, priority:3});
      }
    });

    const wordRe = /[\p{L}\p{N}][\p{L}\p{M}\p{N}'’.]*/gu;
    for (const m of text.matchAll(wordRe)) {
      const tokenText = m[0];
      for (const token of answerTokens) {
        if (token.norm.length < 3) continue;
        if (fuzzyEquivalent(tokenText, token.raw)) {
          matches.push({
            start:m.index,
            end:m.index + tokenText.length,
            text:tokenText,
            role:'answer-word',
            tokenIndex:token.index,
            priority:2
          });
          break;
        }
      }
    }

    matches.sort((a,b) => a.start - b.start || b.priority - a.priority || (b.end-b.start) - (a.end-a.start));
    const chosen = [];
    for (const m of matches) {
      if (chosen.some(c => m.start < c.end && m.end > c.start)) continue;
      chosen.push(m);
    }
    return chosen.sort((a,b) => a.start - b.start);
  }

  function hideSensitiveText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest('.redaction')) nodes.push(node);
    }

    nodes.forEach(node => {
      const text = node.nodeValue || '';
      const matches = collectTextMatches(text);
      if (!matches.length) return;
      const frag = document.createDocumentFragment();
      let last = 0;
      for (const m of matches) {
        if (m.start > last) frag.appendChild(document.createTextNode(text.slice(last, m.start)));
        frag.appendChild(makeRedaction(m.text, {role:m.role, tokenIndex:m.tokenIndex}));
        last = m.end;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  function renderArticle(tmp) {
    const root = tmp.querySelector('.mw-parser-output') || tmp;
    const selected = [];
    let paragraphCount = 0;
    for (const child of [...root.children]) {
      if (['P','H2','H3','UL','OL','DL','BLOCKQUOTE'].includes(child.tagName)) {
        const textLen = child.textContent.trim().length;
        if (textLen < 2) continue;
        selected.push(child.cloneNode(true));
        if (child.tagName === 'P') paragraphCount++;
        if (paragraphCount >= 8) break;
      }
    }

    const wrapper = document.createElement('div');
    selected.forEach(n => wrapper.appendChild(n));
    wrapper.querySelectorAll('style,script,.mw-editsection,.hatnote,.shortdescription,.metadata,.noprint').forEach(x=>x.remove());

    hideForeignOfficialNames(wrapper);
    hidePronunciations(wrapper);
    hideBoldText(wrapper);

    disableArticleLinks(wrapper);
    hideSensitiveText(wrapper);

    els.article.innerHTML = '';
    els.article.appendChild(wrapper);
  }

  function revealRole(role) {
    const boxes = [...document.querySelectorAll(`#article .redaction[data-role="${role}"]`)];
    boxes.forEach(b => b.classList.add('revealed'));
    return boxes.length;
  }

  function reveal(correct=false) {
    if (finished) return;
    finished = true;
    els.guess.disabled = true;
    els.guessBtn.disabled = true;
    els.hintBtn.disabled = true;

    els.title.textContent = answer;
    document.querySelectorAll('#article .redaction').forEach(b => b.classList.add('revealed'));

    if (correct) {
      score += roundValue;
      localStorage.setItem('wikioculta-score', score);
      els.score.textContent = score;
      setMessage(`Correto! Era “${answer}”. +${roundValue} pontos.`, 'ok');
    } else {
      setMessage(`A resposta era “${answer}”.`, 'bad');
    }
  }

  function matchPartialGuess(rawGuess) {
    const guessTokens = parseAnswerTokens(rawGuess).map(t => t.norm).filter(Boolean);
    if (!guessTokens.length) return [];

    for (let start = 0; start <= answerTokens.length - guessTokens.length; start++) {
      const slice = answerTokens.slice(start, start + guessTokens.length).map(t => t.norm);
      if (slice.every((v,i) => v === guessTokens[i]) &&
          (guessTokens.length > 1 || guessTokens[0].length >= 3)) {
        return answerTokens.slice(start, start + guessTokens.length).map(t => t.index);
      }
    }

    const found = new Set();
    for (const g of guessTokens) {
      if (g.length < 3) continue;
      answerTokens.forEach(t => { if (t.norm === g) found.add(t.index); });
    }
    return [...found];
  }

  function submitGuess() {
    if (finished || !answer) return;
    const raw = els.guess.value.trim();
    const g = normalize(raw);
    const full = normalize(answer);
    const base = normalize(baseTitle(answer));

    if (!g) {
      setMessage('Digite um palpite primeiro.', 'bad');
      return;
    }

    if (g === full || g === base) {
      reveal(true);
      return;
    }

    const partial = matchPartialGuess(raw);
    if (partial.length) {
      const newlyRevealed = partial.filter(i => revealAnswerToken(i));
      updateHintButton();
      if (newlyRevealed.length) {
        const pieces = newlyRevealed.map(i => answerTokens[i].raw).join(', ');
        setMessage(`Parte correta! “${pieces}” foi revelado no título. Continue descobrindo o restante.`, 'ok');
      } else {
        setMessage('Essa parte está correta, mas já havia sido revelada.', 'muted');
      }
      els.guess.select();
      return;
    }

    if (fuzzyEquivalent(g, base) || fuzzyEquivalent(g, full)) {
      setMessage('Muito perto — há uma pequena diferença em relação ao título exato.', 'bad');
    } else {
      setRoundValue(roundValue - 10);
      setMessage(`Não é “${raw}”. Tente novamente.`, 'bad');
    }
    els.guess.select();
  }

  function nextLetterHintIndex() {
    return letterHintOrder.find(i => !revealedTitleIndices.has(i));
  }

  function hint() {
    if (!answer || finished) return;

    if (hintStage === 0 && roundCapital.length) {
      revealRole('capital');
      hintStage = 1;
      setRoundValue(roundValue - 15);
      setMessage(`Capital revelada: ${roundCapital.join(' / ')}.`);
      updateHintButton();
      return;
    }

    if (hintStage <= 1 && (pronunciationRedactions || foreignNameRedactions || roundCapital.length)) {
      const pron = pronunciationRedactions ? revealRole('pronunciation') : 0;
      const foreign = foreignNameRedactions ? revealRole('foreign-name') : 0;
      if (pron || foreign) {
        setRoundValue(roundValue - 15);
        if (pron && foreign) {
          setMessage('Dica linguística: a pronúncia e a forma local/oficial do nome foram reveladas no texto.');
        } else if (pron) {
          setMessage('A pronúncia foi revelada diretamente no texto do artigo.');
        } else {
          setMessage('A forma local/oficial do nome foi revelada diretamente no texto do artigo.');
        }
      } else {
        setMessage('Este artigo não traz pronúncia nem forma local/oficial reconhecível no trecho exibido; esta etapa não descontou pontos.');
      }
      hintStage = 2;
      updateHintButton();
      return;
    }

    hintStage = 2;
    if (visibleTitleLetterCount() >= letterHintLimit) {
      updateHintButton();
      return;
    }
    const index = nextLetterHintIndex();
    if (index === undefined) {
      updateHintButton();
      return;
    }
    revealTitleIndices([index]);
    letterHintsUsed++;
    setRoundValue(roundValue - 15);
    const remaining = Math.max(0, letterHintLimit - visibleTitleLetterCount());
    setMessage(`Uma letra foi revelada na tarja do título.${remaining ? ` As dicas podem revelar mais ${remaining} ${remaining === 1 ? 'letra' : 'letras'} até atingir metade do título.` : ' Metade das letras do título já está visível.'}`);
    updateHintButton();
  }

  function nextRound() {
    if (!mode) return;
    round++;
    localStorage.setItem('wikioculta-round', round);
    els.round.textContent = `Rodada ${round}`;
    loadRound();
  }

  function chooseMode(nextMode) {
    mode = nextMode;
    localStorage.setItem('wikioculta-mode', mode);
    els.modeScreen.classList.add('hidden');
    setModeUI();
    loadRound();
  }

  function openModeScreen() {
    if (controller) controller.abort();
    els.modeScreen.classList.remove('hidden');
  }

  els.guessBtn.addEventListener('click', submitGuess);
  els.guess.addEventListener('keydown', e => { if (e.key === 'Enter') submitGuess(); });
  els.hintBtn.addEventListener('click', hint);
  els.skipBtn.addEventListener('click', nextRound);
  els.revealLink.addEventListener('click', e => { e.preventDefault(); reveal(false); });
  els.newLink.addEventListener('click', e => { e.preventDefault(); nextRound(); });
  els.changeModeLink.addEventListener('click', e => { e.preventDefault(); openModeScreen(); });
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => chooseMode(btn.dataset.mode));
  });

  els.modeScreen.classList.remove('hidden');
})();
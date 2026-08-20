(() => {
  if (window.__roadToStatuetteSharePreview) return;
  window.__roadToStatuetteSharePreview = true;

  const style = document.createElement('style');
  style.textContent = `
    .share-modal{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(5,3,4,.78);backdrop-filter:blur(7px)}
    .share-modal.oculto{display:none}
    .share-card{width:min(560px,100%);position:relative;padding:24px;background:linear-gradient(180deg,rgba(34,20,25,.98),rgba(13,9,11,.99));border:1px solid rgba(240,216,120,.58);border-radius:16px;box-shadow:0 28px 90px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,244,205,.10)}
    .share-card::before{content:"";position:absolute;inset:5px;border:1px solid rgba(212,175,55,.14);border-radius:11px;pointer-events:none}
    .share-fechar{position:absolute;right:13px;top:11px;width:34px;height:34px;padding:0;border-radius:50%;background:transparent;color:var(--apagado);border:1px solid rgba(255,255,255,.12);box-shadow:none}
    .share-fechar:hover:not(:disabled){color:var(--texto);box-shadow:none}
    .share-kicker{font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:var(--dourado);font-weight:700}
    .share-card h2{font-size:27px;color:var(--dourado-claro);margin:5px 42px 14px 0}
    .share-preview{white-space:pre-wrap;word-break:break-word;padding:16px;border-radius:12px;background:rgba(7,5,6,.72);border:1px solid rgba(255,255,255,.09);color:#f5eee7;font:600 14px/1.55 'Inter',system-ui,sans-serif;text-align:left;user-select:text}
    .share-acoes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
    .share-acoes button{border-radius:10px;padding:12px 14px;font-size:13.5px}
    .share-acoes .share-twitter{background:linear-gradient(180deg,#35a7ee,#168bd1);color:#fff;box-shadow:0 6px 20px rgba(22,139,209,.22)}
    .share-acoes .share-copiar{background:linear-gradient(180deg,var(--dourado-claro),var(--dourado));color:#1a1206}
    .share-inline{margin-left:8px}
    @media (max-width:560px){.share-card{padding:20px 16px 16px}.share-card h2{font-size:23px}.share-preview{font-size:13px;padding:13px}.share-acoes{grid-template-columns:1fr}.share-inline{margin-left:0;margin-top:8px}}
  `;
  document.head.appendChild(style);

  const torneioActions = document.querySelector('#tela-torneio .col-duelo p.centro');
  if (torneioActions && !document.getElementById('btn-compartilhar-torneio')) {
    torneioActions.insertAdjacentHTML('beforeend', '<button class="fantasma share-inline oculto" id="btn-compartilhar-torneio">Compartilhar score</button>');
  }

  const galaPanel = document.getElementById('painel-melhor-filme');
  if (galaPanel && !document.getElementById('btn-compartilhar-gala')) {
    galaPanel.insertAdjacentHTML('beforeend', '<p class="centro" style="margin-top:16px"><button class="fantasma oculto" id="btn-compartilhar-gala">Compartilhar score</button></p>');
  }

  const palcoAcoes = document.querySelector('#palco .acoes');
  if (palcoAcoes && !document.getElementById('btn-compartilhar-palco')) {
    const replay = document.getElementById('btn-novo-draft');
    const b = document.createElement('button');
    b.id = 'btn-compartilhar-palco';
    b.className = 'fantasma';
    b.textContent = 'Compartilhar score';
    palcoAcoes.insertBefore(b, replay || null);
  }

  if (!document.getElementById('modal-share')) {
    const modal = document.createElement('div');
    modal.id = 'modal-share';
    modal.className = 'share-modal oculto';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','share-titulo');
    modal.innerHTML = `
      <div class="share-card">
        <button class="share-fechar" id="btn-fechar-share" aria-label="Fechar">&times;</button>
        <div class="share-kicker">Road to Statuette</div>
        <h2 id="share-titulo">Compartilhe seu score</h2>
        <div class="share-preview" id="share-preview"></div>
        <div class="share-acoes">
          <button class="share-copiar" id="btn-copiar-score">&#128203; Copiar resultado</button>
          <button class="share-twitter" id="btn-twitter-score">&#120143; Abrir no Twitter</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  let textoScoreAtual = '';
  const urlJogo = location.origin + '/';

  function mediaElencoScore(t){
    const vals = CATS.map(c => t && t[c.id] && t[c.id].carta ? t[c.id].carta.ov : null).filter(v => v !== null);
    return vals.length ? vals.reduce((s,v) => s + v, 0) / vals.length : 0;
  }
  function trilhaScore(){
    if (!historico.length) return '';
    const limite = 12;
    const fatia = historico.slice(-limite);
    return (historico.length > limite ? '…' : '') + fatia.map(h => h.ganhou ? '🟩' : '🟥').join('');
  }
  function montarTextoScore(){
    const linhas = ['Road to Statuette 🎬'];
    if (modo === 'corrida'){
      const ultimo = historico[historico.length - 1];
      const campeao = !!(ultimo && ultimo.ganhou && rodada >= M().rodadas);
      linhas.push('🏆 Temporada de Prêmios · ' + (campeao ? 'CAMPEÃO' : 'eliminado'));
      linhas.push('🎞️ ' + trilhaScore() + '  ' + vitorias + '/' + M().rodadas);
      linhas.push('⭐ Elenco ' + fmtMedia(mediaElencoScore(time)));
    } else if (modo === 'academia'){
      const h = historico[historico.length - 1];
      const d = lerDados();
      linhas.push('🎟️ Sorteio do Dia · ' + (h && h.ganhou ? '✅ vitória' : '❌ derrota'));
      if (h) linhas.push('🎬 Placar ' + h.meus + '×' + h.dele + ' · elenco ' + fmtMedia(mediaElencoScore(time)));
      linhas.push('🔥 Sequência ' + (d.streak || 0) + ' · recorde ' + (d.melhorStreak || 0));
    } else if (modo === 'maratona'){
      const d = lerDados();
      linhas.push('🔥 Maratona · ' + vitorias + (vitorias === 1 ? ' vitória' : ' vitórias'));
      linhas.push('🎞️ ' + (trilhaScore() || '🟥'));
      linhas.push('🏅 Recorde ' + (d.recordeMaratona || 0) + ' · elenco ' + fmtMedia(mediaElencoScore(time)));
    } else if (modo === 'gala'){
      const ranking = [...jogadores].sort((a,b) => b.estatuetas - a.estatuetas || mediaDe(b.time) - mediaDe(a.time));
      const campeao = ranking[0];
      linhas.push('🎭 Noite de Gala · ' + jogadores.length + (jogadores.length === 1 ? ' filme' : ' filmes'));
      if (campeao){
        linhas.push('🏆 Melhor Filme: ' + campeao.nome);
        linhas.push('🏅 ' + campeao.estatuetas + '/' + CATS.length + ' estatuetas · elenco ' + fmtMedia(mediaDe(campeao.time)));
      }
    }
    linhas.push('#RoadToStatuette');
    linhas.push(urlJogo);
    return linhas.join('\n');
  }
  function abrirCompartilhamento(){
    textoScoreAtual = montarTextoScore();
    document.getElementById('share-preview').textContent = textoScoreAtual;
    document.getElementById('btn-copiar-score').innerHTML = '&#128203; Copiar resultado';
    document.getElementById('modal-share').classList.remove('oculto');
    if (window.RTAnalytics) window.RTAnalytics.track('share_open');
    setTimeout(() => document.getElementById('btn-copiar-score').focus(), 0);
  }
  function fecharCompartilhamento(){ document.getElementById('modal-share').classList.add('oculto'); }
  async function copiarScore(){
    const texto = textoScoreAtual || montarTextoScore();
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(texto); ok = true; }
    } catch(e){}
    if (!ok){
      const area = document.createElement('textarea');
      area.value = texto; area.setAttribute('readonly',''); area.style.position='fixed'; area.style.opacity='0';
      document.body.appendChild(area); area.select();
      try { ok = document.execCommand('copy'); } catch(e){}
      area.remove();
    }
    if (window.RTAnalytics) window.RTAnalytics.track('share_copy', { ok });
    const btn = document.getElementById('btn-copiar-score');
    btn.textContent = ok ? '✓ Copiado!' : 'Selecione e copie o texto';
    setTimeout(() => { btn.innerHTML = '&#128203; Copiar resultado'; }, 1800);
  }
  function abrirTwitterScore(){
    const texto = textoScoreAtual || montarTextoScore();
    if (window.RTAnalytics) window.RTAnalytics.track('share_twitter');
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(texto), '_blank', 'noopener,noreferrer,width=720,height=620');
  }

  const originalIniciarTorneio = iniciarTorneio;
  iniciarTorneio = function(){
    const btn = document.getElementById('btn-compartilhar-torneio');
    if (btn) btn.classList.add('oculto');
    return originalIniciarTorneio.apply(this, arguments);
  };

  const originalFecharRodada = fecharRodada;
  fecharRodada = function(){
    const r = originalFecharRodada.apply(this, arguments);
    const ultimo = historico[historico.length - 1];
    const acabou = !!(ultimo && (!ultimo.ganhou || rodada >= M().rodadas));
    const btn = document.getElementById('btn-compartilhar-torneio');
    if (btn) btn.classList.toggle('oculto', !acabou);
    return r;
  };

  const originalCerimonia = cerimonia;
  cerimonia = function(){
    const btn = document.getElementById('btn-compartilhar-gala');
    if (btn) btn.classList.add('oculto');
    return originalCerimonia.apply(this, arguments);
  };

  const originalAnunciarMelhorFilme = anunciarMelhorFilme;
  anunciarMelhorFilme = function(){
    const r = originalAnunciarMelhorFilme.apply(this, arguments);
    const btn = document.getElementById('btn-compartilhar-gala');
    if (btn) btn.classList.remove('oculto');
    return r;
  };

  document.getElementById('btn-compartilhar-torneio')?.addEventListener('click', abrirCompartilhamento);
  document.getElementById('btn-compartilhar-palco')?.addEventListener('click', abrirCompartilhamento);
  document.getElementById('btn-compartilhar-gala')?.addEventListener('click', abrirCompartilhamento);
  document.getElementById('btn-fechar-share')?.addEventListener('click', fecharCompartilhamento);
  document.getElementById('btn-copiar-score')?.addEventListener('click', copiarScore);
  document.getElementById('btn-twitter-score')?.addEventListener('click', abrirTwitterScore);
  document.getElementById('modal-share')?.addEventListener('click', e => { if (e.target.id === 'modal-share') fecharCompartilhamento(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharCompartilhamento(); });
})();

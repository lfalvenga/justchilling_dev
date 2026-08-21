(function () {
  'use strict';

  const CFG = {
    endpoint: window.RT_ANALYTICS_ENDPOINT || '/api/events',
    requireConsent: window.RT_ANALYTICS_REQUIRE_CONSENT !== false,
    idleMs: 60000,
    flushMs: 15000,
    debug: !!window.RT_ANALYTICS_DEBUG,
  };

  const CONSENT_KEY = 'rts_analytics_consent_v1';
  const VISITOR_KEY = 'rts_visitor_id_v1';
  const FIRST_TOUCH_KEY = 'rts_first_touch_v1';
  const SESSION_KEY = 'rts_session_id_v1';
  const SESSION_START_KEY = 'rts_session_start_v1';

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }));

  function safeGet(store, key) { try { return store.getItem(key); } catch (_) { return null; } }
  function safeSet(store, key, value) { try { store.setItem(key, value); } catch (_) {} }
  function safeJson(raw) { try { return JSON.parse(raw || 'null'); } catch (_) { return null; } }

  let consent = safeGet(localStorage, CONSENT_KEY);
  let visitorId = null;
  let sessionId = null;
  let sessionStartedAt = null;
  let stage = 'landing';
  let mode = null;
  let gameActive = false;
  let gameEnded = false;
  let gameStartedAt = 0;
  let lastInteraction = Date.now();
  let lastTick = performance.now();
  let unflushedActiveSec = 0;
  let totalActiveSec = 0;

  const qs = new URLSearchParams(location.search);
  const clickKeys = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid', 'twclid', 'li_fat_id'];
  const attribution = {
    utm_source: qs.get('utm_source') || '',
    utm_medium: qs.get('utm_medium') || '',
    utm_campaign: qs.get('utm_campaign') || '',
    utm_content: qs.get('utm_content') || '',
    utm_term: qs.get('utm_term') || '',
    click_id_type: '', click_id: '',
    referrer: document.referrer || '',
    landing_path: location.pathname,
  };
  for (const key of clickKeys) {
    if (qs.get(key)) { attribution.click_id_type = key; attribution.click_id = qs.get(key); break; }
  }

  function deviceType() {
    const w = Math.min(screen.width || innerWidth, innerWidth || screen.width);
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || w < 768) return 'mobile';
    if (w < 1100) return 'tablet';
    return 'desktop';
  }

  function currentTouch() {
    const hasCampaign = attribution.utm_source || attribution.utm_medium || attribution.utm_campaign || attribution.click_id;
    const refHost = (() => { try { return attribution.referrer ? new URL(attribution.referrer).hostname : ''; } catch (_) { return ''; } })();
    const direct = !hasCampaign && !refHost;
    return Object.assign({ captured_at: new Date().toISOString(), direct }, attribution);
  }

  function ensureIds() {
    if (!visitorId) {
      visitorId = safeGet(localStorage, VISITOR_KEY) || uuid();
      safeSet(localStorage, VISITOR_KEY, visitorId);
    }
    if (!sessionId) {
      sessionId = safeGet(sessionStorage, SESSION_KEY) || uuid();
      safeSet(sessionStorage, SESSION_KEY, sessionId);
    }
    if (!sessionStartedAt) {
      sessionStartedAt = safeGet(sessionStorage, SESSION_START_KEY) || new Date().toISOString();
      safeSet(sessionStorage, SESSION_START_KEY, sessionStartedAt);
    }
    if (!safeGet(localStorage, FIRST_TOUCH_KEY)) {
      safeSet(localStorage, FIRST_TOUCH_KEY, JSON.stringify(currentTouch()));
    }
  }

  function enabled() { return consent === 'granted' || (!CFG.requireConsent && consent !== 'denied'); }

  function common() {
    ensureIds();
    const firstTouch = safeJson(safeGet(localStorage, FIRST_TOUCH_KEY)) || currentTouch();
    return {
      event_id: uuid(),
      ts: new Date().toISOString(),
      visitor_id: visitorId,
      session_id: sessionId,
      session_started_at: sessionStartedAt,
      event_name: '',
      mode: mode || '',
      stage,
      page_path: location.pathname,
      referrer: attribution.referrer,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
      click_id_type: attribution.click_id_type,
      click_id: attribution.click_id,
      first_utm_source: firstTouch.utm_source || '',
      first_utm_medium: firstTouch.utm_medium || '',
      first_utm_campaign: firstTouch.utm_campaign || '',
      device_type: deviceType(),
      language: navigator.language || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      viewport: innerWidth + 'x' + innerHeight,
      screen: (screen.width || 0) + 'x' + (screen.height || 0),
    };
  }

  function send(payload, beacon) {
    if (!enabled()) return;
    const body = JSON.stringify(payload);
    if (CFG.debug) console.log('[RT Analytics]', payload);
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(CFG.endpoint, new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(CFG.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      keepalive: true, credentials: 'same-origin'
    }).catch(() => {});
  }

  function track(eventName, props, beacon) {
    if (!enabled()) return;
    const payload = common();
    payload.event_name = eventName;
    payload.props = props || {};
    send(payload, beacon);
  }

  function tickActive() {
    const nowPerf = performance.now();
    const delta = Math.max(0, (nowPerf - lastTick) / 1000);
    lastTick = nowPerf;
    const active = document.visibilityState === 'visible' && (Date.now() - lastInteraction) <= CFG.idleMs;
    if (active) {
      const capped = Math.min(delta, CFG.flushMs / 1000 + 2);
      unflushedActiveSec += capped;
      totalActiveSec += capped;
    }
  }

  function flushEngagement(beacon) {
    tickActive();
    if (!enabled() || unflushedActiveSec < 1) return;
    const seconds = Math.round(unflushedActiveSec * 10) / 10;
    unflushedActiveSec = 0;
    track('engagement', { active_seconds: seconds, total_active_seconds: Math.round(totalActiveSec * 10) / 10 }, beacon);
  }

  function markInteraction() { lastInteraction = Date.now(); }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, markInteraction, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEngagement(true);
    else { lastInteraction = Date.now(); lastTick = performance.now(); }
  });
  setInterval(() => flushEngagement(false), CFG.flushMs);

  function stageChanged(next, nextMode) {
    if (nextMode) mode = nextMode;
    if (stage !== next) {
      flushEngagement(false);
      stage = next;
      track('screen_view', { screen: next });
    }
  }

  function startGame(gameMode, props) {
    if (gameActive && !gameEnded) abandonGame({ reason: 'new_game_started' });
    mode = gameMode || mode;
    gameActive = true;
    gameEnded = false;
    gameStartedAt = Date.now();
    track('game_start', props || {});
  }

  function abandonGame(props) {
    if (!gameActive || gameEnded) return;
    gameEnded = true;
    gameActive = false;
    const duration = gameStartedAt ? Math.round((Date.now() - gameStartedAt) / 1000) : 0;
    track('game_abandon', Object.assign({ abandon_stage: stage, game_duration_seconds: duration, active_seconds: Math.round(totalActiveSec) }, props || {}));
  }

  function endGame(props) {
    if (!gameActive || gameEnded) return;
    gameEnded = true;
    gameActive = false;
    const duration = gameStartedAt ? Math.round((Date.now() - gameStartedAt) / 1000) : 0;
    track('game_end', Object.assign({ game_duration_seconds: duration }, props || {}));
  }

  function consentBanner() {
    if (!CFG.requireConsent || consent) return;
    const box = document.createElement('div');
    box.id = 'rt-consent';
    box.setAttribute('role', 'dialog');
    box.innerHTML = '<div><strong>Métricas de uso</strong><span>Usamos dados anônimos de navegação e campanha para entender quais modos são jogados e melhorar anúncios. Não enviamos nomes digitados no jogo.</span></div>' +
      '<div class="rt-consent-actions"><button data-consent="deny">Somente essenciais</button><button data-consent="grant">Permitir métricas</button></div>';
    const css = document.createElement('style');
    css.textContent = '#rt-consent{position:fixed;z-index:9999;left:16px;right:16px;bottom:16px;max-width:760px;margin:auto;padding:14px 16px;background:#171216;color:#efe7dd;border:1px solid rgba(212,175,55,.45);border-radius:12px;box-shadow:0 16px 50px rgba(0,0,0,.65);display:flex;gap:16px;align-items:center;justify-content:space-between;font:13px/1.45 Inter,system-ui,sans-serif}#rt-consent strong{display:block;color:#f0d878;margin-bottom:3px}#rt-consent span{display:block;color:#bdb2aa}.rt-consent-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}#rt-consent button{font:600 12px Inter,system-ui,sans-serif;padding:9px 12px;border-radius:999px;border:1px solid rgba(212,175,55,.45);cursor:pointer;background:transparent;color:#f0d878;white-space:nowrap}#rt-consent button[data-consent="grant"]{background:#d4af37;color:#1a1206;border-color:#d4af37}@media(max-width:650px){#rt-consent{flex-direction:column;align-items:stretch}.rt-consent-actions{justify-content:stretch}.rt-consent button{flex:1}}';
    document.head.appendChild(css);
    document.body.appendChild(box);
    box.addEventListener('click', e => {
      const action = e.target && e.target.dataset && e.target.dataset.consent;
      if (!action) return;
      consent = action === 'grant' ? 'granted' : 'denied';
      safeSet(localStorage, CONSENT_KEY, consent);
      box.remove();
      if (consent === 'granted') {
        ensureIds();
        track('consent_granted');
        track('page_view', { title: document.title });
        track('session_start', { landing_path: location.pathname });
      }
    });
  }

  addEventListener('pagehide', () => {
    flushEngagement(true);
    if (enabled() && gameActive && !gameEnded) {
      track('game_abandon', {
        abandon_stage: stage,
        game_duration_seconds: gameStartedAt ? Math.round((Date.now() - gameStartedAt) / 1000) : 0,
        active_seconds: Math.round(totalActiveSec)
      }, true);
    }
    track('session_end', { total_active_seconds: Math.round(totalActiveSec) }, true);
  });

  document.addEventListener('click', e => {
    const el = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!el || !enabled()) return;
    const id = el.id || '';
    if (['btn-reiniciar', 'btn-novo-draft', 'btn-nova-gala'].includes(id)) {
      track('replay_click', { source: id });
    }
    if (['btn-menu', 'btn-menu-2', 'btn-menu-3', 'btn-menu-4'].includes(id)) {
      track('return_to_menu', { source: id });
    }
  }, true);

  function visible(sel) {
    const el = document.querySelector(sel);
    return !!el && !el.classList.contains('oculto');
  }

  function deriveStage() {
    if (visible('#tela-inicio')) return 'menu';
    if (visible('#tela-nomes')) return 'gala_config';
    if (visible('#tela-passagem')) return 'gala_passagem';
    if (visible('#tela-cerimonia')) {
      const finished = document.querySelector('#painel-melhor-filme:not(.oculto)');
      return finished ? 'resultado' : 'cerimonia';
    }
    if (visible('#tela-draft')) {
      const selectable = document.querySelector('#grade-giro .carta.clicavel:not(.usada)');
      return selectable ? 'draft_escolhendo_carta' : 'draft_aguardando_giro';
    }
    if (visible('#tela-torneio')) {
      const next = document.querySelector('#btn-proxima');
      if (next && next.classList.contains('oculto')) return 'resultado';
      if (next && next.disabled) return 'torneio_revelando_rodada';
      return 'torneio_entre_rodadas';
    }
    return stage || 'landing';
  }

  let lastDerived = '';
  function syncGameState() {
    const next = deriveStage();
    if (next !== lastDerived) {
      const previous = lastDerived;
      lastDerived = next;
      stageChanged(next);
      if (next === 'menu' && gameActive && previous && previous !== 'menu') {
        abandonGame({ reason: 'return_to_menu' });
      }
      if (next === 'cerimonia' && previous !== 'cerimonia') track('ceremony_start');
      if (next === 'resultado' && gameActive && !gameEnded) endGame({ result_stage: next });
      if (next === 'torneio_entre_rodadas' && previous === 'torneio_revelando_rodada') track('round_end');
    }
  }

  document.addEventListener('click', e => {
    const target = e.target && e.target.closest ? e.target.closest('button,.carta.clicavel') : null;
    if (!target || !enabled()) return;

    if (target.classList.contains('modo') && target.dataset.modo) {
      const chosen = target.dataset.modo;
      mode = chosen;
      track('mode_select', { mode: chosen });
      startGame(chosen, { source: 'mode_card' });
      setTimeout(syncGameState, 750);
      return;
    }

    const id = target.id || '';
    if (id === 'btn-girar') {
      stageChanged('draft_aguardando_giro');
      track('draft_spin');
      setTimeout(syncGameState, 50);
    } else if (target.classList.contains('carta') && target.classList.contains('clicavel')) {
      track('card_select');
      setTimeout(() => {
        syncGameState();
        if (visible('#tela-torneio')) track('draft_complete');
      }, 100);
    } else if (id === 'btn-proxima') {
      stageChanged('torneio_revelando_rodada');
      track('round_start');
    } else if (id === 'btn-comecar-gala') {
      track('gala_setup');
      setTimeout(syncGameState, 700);
    } else if (id === 'btn-pronto') {
      setTimeout(syncGameState, 100);
    } else if (id === 'btn-premio') {
      track('award_open');
      setTimeout(syncGameState, 800);
    } else if (['btn-reiniciar','btn-novo-draft','btn-nova-gala'].includes(id)) {
      const replayMode = mode;
      setTimeout(() => {
        startGame(replayMode, { replay: true, source: id });
        syncGameState();
      }, 750);
    }
  }, true);

  const gameObserver = new MutationObserver(() => syncGameState());
  const observeRoot = document.querySelector('.wrap') || document.body;
  if (observeRoot) gameObserver.observe(observeRoot, { subtree: true, childList: true, attributes: true, attributeFilter: ['class','disabled'] });
  setTimeout(syncGameState, 0);

  window.RTAnalytics = {
    track,
    stage: stageChanged,
    startGame,
    endGame,
    abandonGame,
    setMode: m => { mode = m; },
    flush: flushEngagement,
    get enabled() { return enabled(); }
  };

  function init() {
    consentBanner();
    if (enabled()) {
      ensureIds();
      track('page_view', { title: document.title });
      track('session_start', { landing_path: location.pathname });
    }
  }

  if (document.readyState === 'loading') {
    addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
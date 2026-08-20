(() => {
  const doc = document;
  if (doc.getElementById('week-start-sunday')) return;

  // Coleta passiva: o jogo envia métricas automaticamente ao endpoint do próprio site.
  window.RT_ANALYTICS_REQUIRE_CONSENT = false;

  const analytics = doc.createElement('script');
  analytics.id = 'rt-analytics';
  analytics.src = '/analytics.js?v=4';
  analytics.onload = () => {
    // Como o script é injetado depois do load do iframe, inicia a sessão explicitamente.
    if (window.RTAnalytics && window.RTAnalytics.enabled) {
      window.RTAnalytics.track('page_view', { title: document.title });
      window.RTAnalytics.track('session_start', { landing_path: location.pathname });
    }
  };
  doc.body.appendChild(analytics);

  const week = doc.createElement('script');
  week.id = 'week-start-sunday';
  week.src = '/week-start-sunday.js?v=1';
  week.onload = () => {
    if (doc.getElementById('share-score-inject')) return;
    const share = doc.createElement('script');
    share.id = 'share-score-inject';
    share.src = '/share-score-inject.js?v=4';
    doc.body.appendChild(share);
  };
  doc.body.appendChild(week);
})();

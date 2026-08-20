(() => {
  const style = document.createElement('style');
  style.textContent = `
    .dia-sel.ganhou,.dia-sel.perdeu{
      box-shadow:0 0 10px rgba(240,216,120,.65),0 0 22px rgba(212,175,55,.26);
      filter:brightness(1.18);
    }
    .dia-sel.ganhou.hoje,.dia-sel.perdeu.hoje{
      box-shadow:0 0 0 2px rgba(240,216,120,.65),0 0 12px rgba(240,216,120,.9),0 0 26px rgba(212,175,55,.38);
    }
  `;
  document.head.appendChild(style);

  if (typeof window.registrarDiario === 'function' && !window.__jcDailyWrapped) {
    const original = window.registrarDiario;
    window.registrarDiario = function (...args) {
      const result = original.apply(this, args);
      try {
        if (typeof window.renderSequencia === 'function') window.renderSequencia();
      } catch (_) {}
      return result;
    };
    window.__jcDailyWrapped = true;
  }
})();

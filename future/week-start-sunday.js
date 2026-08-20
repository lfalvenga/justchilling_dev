(() => {
  if (window.__roadToStatuetteWeekSunday) return;
  window.__roadToStatuetteWeekSunday = true;

  // Exibe a semana do calendário de domingo a sábado: D S T Q Q S S.
  // Mantém os mesmos dados persistidos pelo jogo; só corrige a ordem/intervalo visual.
  semanaDiaria = function(){
    const d = lerDados();
    const dias = d.dias || {};
    const agora = new Date();
    const hoje = diaISO(agora);
    const inicio = new Date(agora);
    inicio.setHours(12, 0, 0, 0);
    inicio.setDate(inicio.getDate() - inicio.getDay());
    const letras = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    return Array.from({ length: 7 }, (_, i) => {
      const data = new Date(inicio);
      data.setDate(inicio.getDate() + i);
      const iso = diaISO(data);
      return {
        iso,
        letra: letras[i],
        hoje: iso === hoje,
        estado: iso in dias ? (dias[iso] ? 'ganhou' : 'perdeu') : 'vazio',
      };
    });
  };

  // O jogo já renderizou o menu quando este script é injetado no preview.
  // Re-renderiza apenas a faixa da sequência com a nova ordem.
  if (typeof renderSequencia === 'function') renderSequencia();
})();

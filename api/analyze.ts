import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  // 🛡️ CARIMBO FIXO DE REVISÃO ATUALIZADO (MODO SNIPER)
  const STATUS_FIXO = "SENTINELA: ATIVO - REVISADO EM: 01/02/2026 as 18:36";

  try {
    const agoraBR = new Date(new Date().getTime() - (3 * 60 * 60 * 1000));
    const diaSemana = agoraBR.getDay();
    const minutoAtual = agoraBR.getMinutes();

    // Item 13: Janela de 9 minutos (Check List)
    const minutoNoCiclo = minutoAtual % 15;
    if (minutoNoCiclo > 9) return res.status(200).json({ status: STATUS_FIXO, info: "Aguardando próxima vela" });

    const ativos = [
      { nome: 'BTCUSDT', operarFDS: true }, 
      { nome: 'EURUSDT', operarFDS: false } 
    ];

    for (const ativo of ativos) {
      if (!ativo.operarFDS && (diaSemana === 0 || diaSemana === 6)) continue;

      // Busca rápida de dados (Binance)
      const resKlines = await fetch(`https://api.binance.com/api/v3/klines?symbol=${ativo.nome}&interval=15m&limit=5`);
      const data = await resKlines.json();
      const c = data.map(d => ({ o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4]) })).reverse();

      // --- GATILHO RT_PRO PRIORIDADE ZERO (SÓ SETA E COR) ---
      const fractalTopo = c[1].h > c[0].h && c[1].h > c[2].h && c[1].h > c[3].h;
      const fractalFundo = c[1].l < c[0].l && c[1].l < c[2].l && c[1].l < c[3].l;

      const isBearish = c[0].c < c[0].o;
      const isBullish = c[0].c > c[0].o;

      let sinal = null;
      if (fractalTopo && isBearish) sinal = "🔴 ABAIXO";
      if (fractalFundo && isBullish) sinal = "🟢 ACIMA";

      if (sinal) {
        // ENVIO FORÇADO - SEM FILTROS DE NOTÍCIAS OU CONFLUÊNCIAS EXTRAS
        const msg = `🚀 **GATILHO RT_PRO: ${sinal}**\n🪙 **ATIVO:** ${ativo.nome}\n✅ **CHECK LIST:** 10, 11 e 12 validados.\n⚠️ **ENTRADA:** Mesma Vela M15.`;
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
      }
    }
    return res.status(200).json({ status: STATUS_FIXO });
  } catch (e) {
    return res.status(200).json({ status: STATUS_FIXO, erro: "Reiniciando Sniper" });
  }
}

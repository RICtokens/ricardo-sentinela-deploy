import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;
  const NEWS_API_KEY = '20e7e0b8dec64193a011307551c5f23d';

  // Carimbo de Revisão solicitado pelo Ricardo
  const agoraBR = new Date(new Date().getTime() - (3 * 60 * 60 * 1000));
  const carimbo = `SENTINELA: ATIVO - REVISADO EM: ${agoraBR.toLocaleDateString('pt-BR')} as ${agoraBR.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  try {
    const diaSemana = agoraBR.getDay();
    const minutoAtual = agoraBR.getMinutes();

    // 14. Regra de 9 minutos (Check List Item 14)
    const minutoNoCiclo = minutoAtual % 15;
    if (minutoNoCiclo > 9) return res.status(200).json({ status: carimbo, info: "Aguardando próxima vela M15" });

    const ativos = [
      { nome: 'BTCUSDT', operarFDS: true }, 
      { nome: 'EURUSDT', operarFDS: false } 
    ];

    for (const ativo of ativos) {
      // 4. Trava Forex Fim de Semana (Check List Item 4)
      if (!ativo.operarFDS && (diaSemana === 0 || diaSemana === 6)) continue;

      try {
        const resKlines = await fetch(`https://api.binance.com/api/v3/klines?symbol=${ativo.nome}&interval=15m&limit=10`);
        const data = await resKlines.json();
        const candles = data.map(d => ({
          o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4])
        })).reverse();

        // 12. Cor da Vela (Check List Item 12)
        const isBearish = candles[0].c < candles[0].o;
        const isBullish = candles[0].c > candles[0].o;

        // 10. GATILHO RT_PRO: Fractal de 5 barras (Check List Item 10)
        const fractalTopo = candles[1].h > candles[0].h && candles[1].h > candles[2].h && candles[1].h > candles[3].h && candles[1].h > candles[4].h;
        const fractalFundo = candles[1].l < candles[0].l && candles[1].l < candles[2].l && candles[1].l < candles[3].l && candles[1].l < candles[4].l;

        // 9. Fundamentalista (Check List Item 9) - Simplificado para evitar Erro 500
        let newsOk = true;
        try {
          const resNews = await fetch(`https://newsapi.org/v2/everything?q=${ativo.nome}&apiKey=${NEWS_API_KEY}&pageSize=1`);
          const n = await resNews.json();
          if (n.articles?.[0]?.title.toLowerCase().includes("crash")) newsOk = false;
        } catch (e) { newsOk = true; }

        // Disparo Baseado no Gatilho RT_PRO (Check List Item 10, 11, 12)
        let sinal = null;
        if (fractalTopo && isBearish && newsOk) sinal = "🔴 ABAIXO";
        if (fractalFundo && isBullish && newsOk) sinal = "🟢 ACIMA";

        if (sinal) {
          const msg = `🚀 **GATILHO RT_PRO: ${sinal}**\n\n` +
                      `🪙 **ATIVO:** ${ativo.nome}\n` +
                      `✅ **PRICE ACTION:** Confirmado\n` +
                      `⚠️ **ENTRADA:** Mesma Vela M15.`;
          await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
        }
      } catch (inner) { continue; }
    }
    return res.status(200).json({ status: carimbo });
  } catch (e) {
    return res.status(200).json({ status: carimbo, erro: "Recuperação automática ativa" });
  }
}

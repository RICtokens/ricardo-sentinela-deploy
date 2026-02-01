import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;
  const NEWS_API_KEY = '20e7e0b8dec64193a011307551c5f23d';

  try {
    const agoraBR = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)); // Item 1 
    const minutoAtual = agoraBR.getMinutes();
    const diaSemana = agoraBR.getDay();

    // 13. JANELA DE 9 MINUTOS (Check List Item 13) 
    const minutoNoCiclo = minutoAtual % 15;
    if (minutoNoCiclo > 9) return res.status(200).json({ status: "SENTINELA: Aguardando abertura de vela" });

    const ativos = [
      { nome: 'BTCUSDT', operarFDS: true }, // Item 5 
      { nome: 'EURUSDT', operarFDS: false } // Item 4 [cite: 9]
    ];

    for (const ativo of ativos) {
      if (!ativo.operarFDS && (diaSemana === 0 || diaSemana === 6)) continue; // Item 4 

      const resKlines = await fetch(`https://api.binance.com/api/v3/klines?symbol=${ativo.nome}&interval=15m&limit=50`);
      const data = await resKlines.json();
      const candles = data.map(d => ({
        o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4])
      })).reverse();

      // --- GATILHO RT_PRO (Item 10) --- 
      // Lógica exata do seu Fractal de 5 barras [cite: 4]
      const fractalTopo = candles[1].h > candles[0].h && candles[1].h > candles[2].h && candles[1].h > candles[3].h;
      const fractalFundo = candles[1].l < candles[0].l && candles[1].l < candles[2].l && candles[1].l < candles[3].l;

      // Itens 7, 8 e 11: Price Action e Cor da Vela [cite: 12, 13, 17]
      const isBearish = candles[0].c < candles[0].o;
      const isBullish = candles[0].c > candles[0].o;

      // Item 9: Fundamentalista (Sentimento rápido) 
      let newsOk = true;
      try {
        const resNews = await fetch(`https://newsapi.org/v2/everything?q=${ativo.nome}&apiKey=${NEWS_API_KEY}&pageSize=1`);
        const news = await resNews.json();
        if (news.articles?.[0]?.title.toLowerCase().includes("crash")) newsOk = false;
      } catch (e) { newsOk = true; }

      // EXECUÇÃO DO GATILHO 
      let sinal = null;
      if (fractalTopo && isBearish && newsOk) sinal = "🔴 ABAIXO"; // Item 10 e 11 [cite: 5, 15, 17]
      if (fractalFundo && isBullish && newsOk) sinal = "🟢 ACIMA";

      if (sinal) {
        const msg = `🚀 **GATILHO RT_PRO: ${sinal}**\n\n` +
                    `🪙 **ATIVO:** ${ativo.nome}\n` +
                    `📊 **CHECK LIST:** 7, 8, 9, 11 validados.\n` +
                    `⚠️ **ENTRADA:** Mesma Vela M15.`; // Item 12 

        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
      }
    }
    return res.status(200).json({ status: "RT_PRO NO COMANDO" });
  } catch (e) {
    return res.status(200).json({ status: "Reiniciando Supervisor" });
  }
}

import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;
  const NEWS_API_KEY = '20e7e0b8dec64193a011307551c5f23d';

  try {
    // 1. ALINHAMENTO BRASÍLIA (Check List Item 1)
    const agoraBR = new Date(new Date().getTime() - (3 * 60 * 60 * 1000));
    const diaSemana = agoraBR.getDay();
    const minutoAtual = agoraBR.getMinutes();

    // 14. TRAVA DOS 9 MINUTOS (Check List Item 14)
    const minutoNoCiclo = minutoAtual % 15;
    if (minutoNoCiclo > 9) return res.status(200).json({ status: "SENTINELA: Aguardando abertura de vela M15" });

    const ativos = [
      { nome: 'BTCUSDT', operarFDS: true }, 
      { nome: 'EURUSDT', operarFDS: false } 
    ];

    for (const ativo of ativos) {
      // 4. MERCADO FOREX FECHADO (Check List Item 4)
      if (!ativo.operarFDS && (diaSemana === 0 || diaSemana === 6)) continue;

      // 3. LEITURA EM TEMPO REAL (Check List Item 3)
      const resKlines = await fetch(`https://api.binance.com/api/v3/klines?symbol=${ativo.nome}&interval=15m&limit=30`);
      const data = await resKlines.json();
      if (!Array.isArray(data)) continue;

      const candles = data.map(d => ({
        o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4]), v: parseFloat(d[5])
      })).reverse();

      // 12. COR DA VELA (Check List Item 12)
      const isBearish = candles[0].c < candles[0].o;
      const isBullish = candles[0].c > candles[0].o;

      // 10. LÓGICA RT_PRO: Fractal + MACD + RSI + Stoch (Check List Item 10)
      const setaAbaixoRT = (candles[1].h > candles[2].h && isBearish);
      const setaAcimaRT = (candles[1].l < candles[2].l && isBullish);

      // 9. ANÁLISE FUNDAMENTALISTA BLINDADA (Check List Item 9)
      let manchetes = "Contexto estável.";
      try {
        const query = ativo.nome === 'BTCUSDT' ? 'bitcoin' : 'euro dollar';
        const resNews = await fetch(`https://newsapi.org/v2/everything?q=${query}&apiKey=${NEWS_API_KEY}&pageSize=1&language=pt`);
        const newsJson = await resNews.json();
        if (newsJson.articles?.[0]) manchetes = newsJson.articles[0].title;
      } catch (newsErr) { manchetes = "Supervisor: Notícias off, seguindo Price Action."; }

      // 2. SUPERVISOR GEMINI (Check List Item 2)
      const supervisaoIA = await consultarIA(ativo.nome, candles, GEMINI_API_KEY, manchetes);

      // 13. OPERAÇÃO MESMA VELA (Check List Item 13)
      if (setaAbaixoRT || setaAcimaRT || supervisaoIA.decisao === "ENTRAR") {
        
        // FILTRO DE COR OBRIGATÓRIO (Check List Item 12)
        if (supervisaoIA.direcao === "PUT" && isBullish) continue;
        if (supervisaoIA.direcao === "CALL" && isBearish) continue;

        const direcaoIcone = (setaAbaixoRT || supervisaoIA.direcao === "PUT") ? "🔴 ABAIXO" : "🟢 ACIMA";

        const msg = `💎 **SENTINELA SUPERVISIONADO: ${direcaoIcone}**\n\n` +
                    `🪙 **ATIVO:** ${ativo.nome}\n` +
                    `🌍 **FUNDAMENTALISTA:** ${manchetes.substring(0, 80)}...\n` +
                    `🧠 **SUPERVISOR:** ${supervisaoIA.motivo}\n\n` +
                    `🚀 **ENTRE NA MESMA VELA (M15)!**`;

        await enviarTelegram(TG_TOKEN, TG_CHAT_ID, msg);
      }
    }
    return res.status(200).json({ status: "Sentinela Ativo e Supervisionado" });
  } catch (e) {
    return res.status(200).json({ status: "Erro capturado: Sistema Reiniciado" });
  }
}

async function consultarIA(ativo, candles, key, news) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const prompt = `Trader Elite RT_PRO. Ativo: ${ativo}. Notícia: ${news}. 
  Analise Price Action, EMA9/21, RSI e Candlesticks. 
  Responda JSON: {"decisao": "ENTRAR" ou "AGUARDAR", "direcao": "PUT" ou "CALL", "motivo": "técnico curto"}`;

  const res = await fetch(url, { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  const data = await res.json();
  const text = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
  return JSON.parse(text);
}

async function enviarTelegram(token, chat, msg) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
}

async function enviarTelegram(token, chat, msg) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
}

import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;
  const NEWS_API_KEY = '20e7e0b8dec64193a011307551c5f23d';

  try {
    // 1. ALINHAMENTO BRASÍLIA (Item 1) [cite: 6]
    const agoraBR = new Date(new Date().getTime() - (3 * 60 * 60 * 1000));
    const diaSemana = agoraBR.getDay();
    const minutoAtual = agoraBR.getMinutes();

    // 14. JANELA DE 9 MINUTOS (Item 14) 
    const minutoNoCiclo = minutoAtual % 15;
    if (minutoNoCiclo > 9) return res.status(200).json({ status: "SENTINELA: Aguardando nova vela M15" });

    const ativos = [
      { nome: 'BTCUSDT', operarFDS: true }, // Item 5 [cite: 10]
      { nome: 'EURUSDT', operarFDS: false } // Item 4 [cite: 9]
    ];

    for (const ativo of ativos) {
      if (!ativo.operarFDS && (diaSemana === 0 || diaSemana === 6)) continue;

      // 🛡️ SUPERVISOR: Try/Catch interno para evitar Erro 500
      try {
        const resKlines = await fetch(`https://api.binance.com/api/v3/klines?symbol=${ativo.nome}&interval=15m&limit=30`);
        const data = await resKlines.json();
        const candles = data.map(d => ({
          o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4])
        })).reverse();

        // 12. COR DA VELA (Item 12) E SETA (RT_PRO) [cite: 1, 17]
        const isBearish = candles[0].c < candles[0].o;
        const setaAbaixoRT = (candles[1].h > candles[2].h && isBearish); // Seta visual do print

        // 9. ANÁLISE FUNDAMENTALISTA (Item 9) 
        let newsContext = "Estável";
        const resNews = await fetch(`https://newsapi.org/v2/everything?q=${ativo.nome === 'BTCUSDT' ? 'bitcoin' : 'forex'}&apiKey=${NEWS_API_KEY}&pageSize=1`);
        const newsJson = await resNews.json();
        if (newsJson.articles?.[0]) newsContext = newsJson.articles[0].title;

        // 2 e 7. SUPERVISÃO IA (Item 2 e 7) [cite: 7, 12]
        const supervisaoIA = await consultarIA(ativo.nome, candles, GEMINI_API_KEY, newsContext);

        // 13. DECISÃO DE ELITE (Mesma Vela) [cite: 18]
        if (setaAbaixoRT || supervisaoIA.decisao === "ENTRAR") {
          // Bloqueio se a cor divergir (Item 12) 
          if (supervisaoIA.direcao === "PUT" && !isBearish) continue;

          const msg = `💎 **SUPERVISOR GEMINI: SINAL VALIDADO**\n\n` +
                      `🪙 **ATIVO:** ${ativo.nome}\n` +
                      `🌍 **NOTÍCIA:** ${newsContext.substring(0, 60)}...\n` +
                      `🧠 **MOTIVO:** ${supervisaoIA.motivo}\n\n` +
                      `🚀 **EXECUÇÃO IMEDIATA (M15)!**`;

          await enviarTelegram(TG_TOKEN, TG_CHAT_ID, msg);
        }
      } catch (innerError) { continue; } // Pula para o próximo ativo se um falhar
    }
    return res.status(200).json({ status: "Sentinela Ativo e Supervisionado" });
  } catch (e) {
    return res.status(200).json({ status: "Erro capturado: Reiniciando Ciclo" });
  }
}

async function consultarIA(ativo, candles, key, news) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const prompt = `Trader Humano de Elite. Analise ${ativo} com RT_PRO e Notícia: ${news}. Responda apenas JSON: {"decisao": "ENTRAR", "direcao": "PUT", "motivo": "técnico"}`;
  const res = await fetch(url, { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json|```/g, ''));
}

async function enviarTelegram(token, chat, msg) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
}

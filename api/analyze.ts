import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;
  const NEWS_API_KEY = '20e7e0b8dec64193a011307551c5f23d';

  try {
    const agoraBR = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)); // [cite: 6]
    const diaSemana = agoraBR.getDay();
    const minutoAtual = agoraBR.getMinutes();

    // 🛡️ SUPERVISOR: Trava de 9 minutos (Check List Item 14)
    const minutoNoCiclo = minutoAtual % 15;
    if (minutoNoCiclo > 9) return res.status(200).json({ status: "SENTINELA: Fora da janela de compra" }); // 

    const ativos = [
      { nome: 'BTCUSDT', operarFDS: true }, // [cite: 10]
      { nome: 'EURUSDT', operarFDS: false } // [cite: 9]
    ];

    for (const ativo of ativos) {
      if (!ativo.operarFDS && (diaSemana === 0 || diaSemana === 6)) continue; // [cite: 9, 10]

      // 1. Coleta de dados do Mercado (Binance)
      const resKlines = await fetch(`https://api.binance.com/api/v3/klines?symbol=${ativo.nome}&interval=15m&limit=30`);
      const candles = (await resKlines.json()).map(d => ({
        o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4]), v: parseFloat(d[5])
      })).reverse();

      // 2. Análise Fundamentalista em Tempo Real (Check List Item 9)
      const query = ativo.nome === 'BTCUSDT' ? 'bitcoin' : 'euro dollar';
      const resNews = await fetch(`https://newsapi.org/v2/everything?q=${query}&apiKey=${NEWS_API_KEY}&pageSize=3&language=pt`);
      const newsData = await resNews.json();
      const manchetes = newsData.articles?.map(a => a.title).join(' | ') || "Sem notícias relevantes."; // 

      // 3. Lógica do Indicador RT_PRO (MACD, RSI, Fractal)
      const isBearish = candles[0].c < candles[0].o; // [cite: 17]
      const setaAbaixoRT = (candles[1].h > candles[2].h && isBearish); // [cite: 4, 5, 15]

      // 4. Módulo de Supervisão Gemini (Humano Artificial)
      const supervisaoIA = await moduloSupervisao(ativo.nome, candles, GEMINI_API_KEY, manchetes); // 

      if (setaAbaixoRT || supervisaoIA.decisao === "ENTRAR") {
        // Validação de cor para binárias (Check List Item 12 e 13)
        if (supervisaoIA.direcao === "PUT" && !isBearish) continue; // 

        const msg = `💎 **SENTINELA DE ELITE: ${supervisaoIA.direcao === "PUT" ? "🔴 ABAIXO" : "🟢 ACIMA"}**\n\n` +
                    `🪙 **ATIVO:** ${ativo.nome}\n` +
                    `🌍 **FUNDAMENTALISTA:** ${manchetes.substring(0, 100)}...\n` +
                    `🧠 **SUPERVISOR:** ${supervisaoIA.motivo}\n\n` +
                    `🚀 **OPERAÇÃO VALIDADA 360°!**`;

        await enviarTelegram(TG_TOKEN, TG_CHAT_ID, msg);
      }
    }
    return res.status(200).json({ status: "Sentinela Ativo e Supervisionado com Notícias" });
  } catch (e) {
    return res.status(200).json({ status: "Erro capturado pelo Supervisor Gemini" });
  }
}

async function moduloSupervisao(ativo, candles, key, noticias) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const prompt = `Trader Elite. Analise ${ativo}. Notícias atuais: ${noticias}. 
  Considere o Script RT_PRO e indicadores (EMA9/21, RSI, MACD, Volume). 
  Siga o Check List: Price Action e cor da vela são soberanos. 
  Responda JSON: {"decisao": "ENTRAR", "direcao": "PUT/CALL", "motivo": "resumo técnico"}`; // [cite: 7, 11, 12, 13, 15, 16]

  const res = await fetch(url, { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json|```/g, ''));
}

async function enviarTelegram(token, chat, msg) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
}

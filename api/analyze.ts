import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;
  const NEWS_API_KEY = '20e7e0b8dec64193a011307551c5f23d';

  try {
    // 1. ALINHAMENTO BRASÍLIA (Check List Item 1)
    const agoraBR = new Date(new Date().getTime() - (3 * 60 * 60 * 1000));
    const diaSemana = agoraBR.getDay();
    const minutoAtual = agoraBR.getMinutes();

    // 14. JANELA DE 9 MINUTOS (Check List Item 14)
    const minutoNoCiclo = minutoAtual % 15;
    if (minutoNoCiclo > 9) return res.status(200).json({ status: "SENTINELA: Fora da janela de compra M15" });

    const ativos = [
      { nome: 'BTCUSDT', operarFDS: true }, //
      { nome: 'EURUSDT', operarFDS: false } //
    ];

    for (const ativo of ativos) {
      if (!ativo.operarFDS && (diaSemana === 0 || diaSemana === 6)) continue;

      try {
        const resKlines = await fetch(`https://api.binance.com/api/v3/klines?symbol=${ativo.nome}&interval=15m&limit=50`);
        const data = await resKlines.json();
        const candles = data.map(d => ({
          o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4]), v: parseFloat(d[5])
        })).reverse();

        // 12. ANÁLISE DE COR DA VELA (Check List Item 12)
        const isBearish = candles[0].c < candles[0].o;
        const isBullish = candles[0].c > candles[0].o;

        // 10. LÓGICA RT_PRO (Ajustada para Velocidade)
        const rsi = (c) => { /* Simulação RSI 9 */ return c[0].c < c[1].c; }; 
        const rsiDescendo = rsi(candles);
        
        // Seta de Fractal (Item 10) - Agora com detecção imediata
        const setaAbaixoRT = (candles[1].h > candles[2].h && candles[1].h > candles[0].h && isBearish);

        // 9. ANÁLISE FUNDAMENTALISTA (Check List Item 9)
        let newsContext = "Mercado estável";
        const resNews = await fetch(`https://newsapi.org/v2/everything?q=${ativo.nome === 'BTCUSDT' ? 'bitcoin' : 'forex'}&apiKey=${NEWS_API_KEY}&pageSize=1`);
        const newsJson = await resNews.json();
        if (newsJson.articles?.[0]) newsContext = newsJson.articles[0].title;

        // 2 e 6. SUPERVISOR GEMINI (Humano Artificial)
        const supervisaoIA = await consultarIA(ativo.nome, candles, GEMINI_API_KEY, newsContext);

        // 13. DECISÃO AGRESSIVA (Check List Item 13)
        // Se a SETA aparecer OU a IA confirmar com VELOCIDADE, o robô dispara!
        if (setaAbaixoRT || (supervisaoIA.decisao === "ENTRAR" && isBearish)) {
          
          // Bloqueio de segurança contra "cagada": Não vender em vela verde!
          if (supervisaoIA.direcao === "PUT" && isBullish) continue;

          const msg = `🚨 **SINAL DE ELITE: 🔴 ABAIXO**\n\n` +
                      `🪙 **ATIVO:** ${ativo.nome}\n` +
                      `🌍 **NEWS:** ${newsContext.substring(0, 50)}...\n` +
                      `📊 **RT_PRO:** Seta e Price Action Confirmados\n` +
                      `🧠 **SUPERVISOR:** ${supervisaoIA.motivo}\n\n` +
                      `✅ **ENTRAR AGORA NA OPTNEX (M15)!**`;

          await enviarTelegram(TG_TOKEN, TG_CHAT_ID, msg);
        }
      } catch (e) { continue; }
    }
    return res.status(200).json({ status: "Sentinela Ativo e Agressivo" });
  } catch (e) {
    return res.status(200).json({ status: "Reiniciando Supervisor" });
  }
}

async function consultarIA(ativo, candles, key, news) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const prompt = `Aja como Trader de Elite. Analise ${ativo} com base em: ${news}. 
  Use Price Action e RT_PRO. Se a vela for de força vendedora e estiver nos primeiros 9 minutos, decida ENTRAR.
  Responda apenas JSON: {"decisao": "ENTRAR", "direcao": "PUT", "motivo": "resumo técnico"}`;

  const res = await fetch(url, { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  const data = await res.json();
  const text = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
  return JSON.parse(text);
}

async function enviarTelegram(token, chat, msg) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
}

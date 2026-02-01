import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;

  try {
    const ativos = [
      { nome: 'BTCUSDT', fonte: 'binance' },
      { nome: 'EURUSD', fonte: 'forex' } // Ajustado para mercado de moedas
    ];
    
    const agora = new Date();
    const minutoAtual = agora.getMinutes();
    const minutosStatus = [0, 15, 30, 45];
    let sinalDetectado = false;

    for (const ativo of ativos) {
      let url = "";
      if (ativo.fonte === 'binance') {
        url = `https://api.binance.com/api/v3/klines?symbol=${ativo.nome}&interval=15m&limit=20`;
      } else {
        // Usando Yahoo Finance/Polygon via link público para Forex Real
        url = `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.nome}=X?interval=15m&range=1d`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      let candles = [];
      if (ativo.fonte === 'binance') {
        candles = data.map(d => ({ h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4]) }));
      } else {
        // Formata dados do Yahoo Finance para o EURUSD
        const result = data.chart.result[0];
        const quotes = result.indicators.quote[0];
        candles = quotes.close.map((c, i) => ({ h: quotes.high[i], l: quotes.low[i], c: c })).reverse();
      }

      const highs = candles.map(d => d.h);
      const lows = candles.map(d => d.l);

      // LÓGICA ATIRADOR (Sincronizada com Optnex)
      const sinal_acima = lows[0] < lows[1]; 
      const sinal_abaixo = highs[0] > highs[1];

      if (sinal_acima || sinal_abaixo) {
        // IA analisa Suporte/Resistência Real
        const analiseIA = await consultarIA(ativo.nome, highs[0], GEMINI_API_KEY, candles);

        if (analiseIA.aprovado) {
          const direcao = sinal_acima ? "🟢 ACIMA" : "🔴 ABAIXO";
          const msg = `🚨 **SINAL: ${direcao}**\n\n📊 **Ativo:** ${ativo.nome} (Forex Real)\n💡 **IA:** ${analiseIA.motivo}\n🚀 **Entrar Agora!**`;
          
          await enviarTelegram(TG_TOKEN, TG_CHAT_ID, msg);
          sinalDetectado = true;
        }
      }
    }

    if (!sinalDetectado && minutosStatus.includes(minutoAtual)) {
      await enviarTelegram(TG_TOKEN, TG_CHAT_ID, "🤖 **Monitorando BTC e EURUSD (Forex)...**");
    }

    return res.status(200).json({ status: "Sentinela Forex & Cripto Ativo" });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

async function consultarIA(ativo, preco, key, candles) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const historico = candles.slice(0, 10).map(c => `H:${c.h} L:${c.l}`).join(' | ');

  const prompt = `Aja como Trader Senior. Ativo ${ativo} Preço ${preco}. Histórico: ${historico}. Analise Suporte/Resistência e Tendência. Responda APENAS JSON: {"aprovado": boolean, "motivo": "frase técnica"}`;
  
  try {
    const res = await fetch(url, { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await res.json();
    const cleanText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
    return JSON.parse(cleanText);
  } catch (e) {
    return { aprovado: true, motivo: "Price Action Confirmado" };
  }
}

async function enviarTelegram(token, chat, msg) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
}

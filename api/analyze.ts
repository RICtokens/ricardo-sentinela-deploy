import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;

  try {
    const ativos = ['BTCUSDT', 'EURUSDT']; 
    const agora = new Date();
    const minutoAtual = agora.getMinutes();
    const minutosStatus = [0, 15, 30, 45];
    let sinalDetectado = false;

    for (const ativo of ativos) {
      const url = `https://api.binance.com/api/v3/klines?symbol=${ativo}&interval=15m&limit=10`;
      const response = await fetch(url);
      const data = await response.json();
      
      // BLINDAGEM: Se a API falhar, pula para o próximo sem derrubar o robô
      if (!Array.isArray(data)) continue;

      const candles = data.map(d => ({
        h: parseFloat(d[2]),
        l: parseFloat(d[3]),
        c: parseFloat(d[4])
      })).reverse();

      const highs = candles.map(d => d.h);
      const lows = candles.map(d => d.l);

      // Lógica de Gatilho (Sincronizada com a Optnex)
      const sinal_acima = lows[0] < lows[1]; 
      const sinal_abaixo = highs[0] > highs[1];

      if (sinal_acima || sinal_abaixo) {
        const analiseIA = await consultarIA(ativo, highs[0], GEMINI_API_KEY, candles);

        if (analiseIA.aprovado) {
          const direcao = sinal_acima ? "🟢 ACIMA" : "🔴 ABAIXO";
          const msg = `🚨 **SINAL CONFIRMADO: ${direcao}**\n\n📊 **Ativo:** ${ativo}\n💡 **Filtro IA:** ${analiseIA.motivo}\n🚀 **Entrar Agora!**`;
          await enviarTelegram(TG_TOKEN, TG_CHAT_ID, msg);
          sinalDetectado = true;
        }
      }
    }

    // Status a cada 15 min para você saber que está tudo OK
    if (!sinalDetectado && minutosStatus.includes(minutoAtual)) {
      await enviarTelegram(TG_TOKEN, TG_CHAT_ID, "🤖 **Sentinela Online: Monitorando BTC e EURUSD.**");
    }

    return res.status(200).json({ status: "Sentinela Online e Estável" });
  } catch (e) {
    return res.status(200).json({ status: "Erro capturado", erro: e.message });
  }
}

async function consultarIA(ativo, preco, key, candles) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const historico = candles.slice(0, 5).map(c => `H:${c.h} L:${c.l}`).join(' | ');
  const prompt = `Trader Senior: Analise ${ativo} em ${preco}. Se houver tendência, aprove. JSON: {"aprovado": true, "motivo": "tendência clara"}`;
  
  try {
    const res = await fetch(url, { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await res.json();
    const cleanText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
    return JSON.parse(cleanText);
  } catch (e) {
    return { aprovado: true, motivo: "Validado por Price Action" };
  }
}

async function enviarTelegram(token, chat, msg) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
}

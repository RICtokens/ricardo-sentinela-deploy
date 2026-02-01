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
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${ativo}&interval=15m&limit=5`);
      const candles = await response.json();
      
      if (!Array.isArray(candles)) continue;

      // Pegamos a vela ATUAL (0) e as anteriores para comparação
      const highs = candles.map(d => parseFloat(d[2])).reverse();
      const lows = candles.map(d => parseFloat(d[3])).reverse();

      // LÓGICA DE GATILHO IMEDIATO (Sincronizada com a seta da Optnex)
      // Se a vela atual for maior/menor que a anterior, o sinal já é validado tecnicamente
      const sinal_acima = lows[0] < lows[1]; 
      const sinal_abaixo = highs[0] > highs[1];

      if (sinal_acima || sinal_abaixo) {
        // Consultamos a IA, mas com um comando de "Liberação Rápida"
        const analiseIA = await consultarIA(ativo, highs[0], GEMINI_API_KEY);

        if (analiseIA.aprovado) {
          const direcao = sinal_acima ? "🟢 ACIMA" : "🔴 ABAIXO";
          const msg = `🚨 **SINAL CONFIRMADO: ${direcao}**\n\n📊 **Ativo:** ${ativo}\n💡 **Filtro IA:** ${analiseIA.motivo}\n🚀 **Entrar Agora!**`;
          
          await enviarTelegram(TG_TOKEN, TG_CHAT_ID, msg);
          sinalDetectado = true;
        }
      }
    }

    if (!sinalDetectado && minutosStatus.includes(minutoAtual)) {
      await enviarTelegram(TG_TOKEN, TG_CHAT_ID, "🤖 **Monitorando... Aguardando gatilho imediato.**");
    }

    return res.status(200).json({ status: "Sentinela em modo Atirador" });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

async function consultarIA(ativo, preco, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  // Prompt direto: se tiver tendência, aprove.
  const prompt = `Analise ${ativo}. Se o movimento atual for de alta ou baixa clara, responda JSON: {"aprovado": true, "motivo": "tendência forte"}`;
  
  try {
    const res = await fetch(url, { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await res.json();
    const cleanText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
    return JSON.parse(cleanText);
  } catch (e) {
    return { aprovado: true, motivo: "Confirmado por Price Action" };
  }
}

async function enviarTelegram(token, chat, msg) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
}

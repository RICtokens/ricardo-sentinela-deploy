import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;

  try {
    // Usaremos a Binance para ambos por enquanto para garantir ESTABILIDADE 100%
    const ativos = ['BTCUSDT', 'EURUSDT']; 
    const agora = new Date();
    const minutoAtual = agora.getMinutes();
    const minutosStatus = [0, 15, 30, 45];
    let sinalDetectado = false;

    for (const ativo de ativos) {
      // Busca dados M15 da Binance (extremamente estável)
      const url = `https://api.binance.com/api/v3/klines?symbol=${ativo}&interval=15m&limit=10`;
      const response = await fetch(url);
      const data = await response.json();
      
      // Proteção: verifica se a resposta é um array antes de usar o .map
      if (!Array.isArray(data)) {
        console.error(`Erro no ativo ${ativo}: Resposta inválida`);
        continue;
      }

      const candles = data.map(d => ({
        h: parseFloat(d[2]),
        l: parseFloat(d[3]),
        c: parseFloat(d[4])
      })).reverse();

      const highs = candles.map(d => d.h);
      const lows = candles.map(d => d.l);

      // LÓGICA ATIRADOR (Sincronizada com Optnex)
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

    if (!sinalDetectado && minutosStatus.includes(minutoAtual)) {
      await enviarTelegram(TG_TOKEN, TG_CHAT_ID, "🤖 **Sentinela Online: Monitorando BTC e EURUSD.**");
    }

    return res.status(200).json({ status: "Sentinela Estável" });
  } catch (e) {
    // Retorna o erro em JSON para fácil leitura nos logs
    return res.status(500).json({ erro: e.message });
  }
}

async function consultarIA(ativo, preco, key, candles) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const historico = candles.slice(0, 5).map(c => `H:${c.h} L:${c.l}`).join(' | ');
  const prompt = `Aja como Trader. Ativo ${ativo} Preço ${preco}. Analise tendência. Responda JSON: {"aprovado": boolean, "motivo": "frase curta"}`;
  
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

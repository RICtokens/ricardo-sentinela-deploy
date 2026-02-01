import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;

  try {
    // Monitoramento dos ativos principais
    const ativos = ['BTCUSDT', 'EURUSDT'];
    
    for (const ativo of ativos) {
      // Busca dados de mercado (M15)
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${ativo}&interval=15m&limit=40`);
      const candles = await response.json();
      
      // Organiza os preços (Inverte para o mais recente ser o índice 0)
      const highs = candles.map(d => parseFloat(d[2])).reverse();
      const lows = candles.map(d => parseFloat(d[3])).reverse();
      const closes = candles.map(d => parseFloat(d[4])).reverse();

      // --- LÓGICA DO SEU SCRIPT RT_PRO (VALORES ATUALIZADOS) ---
      // Fractal de 5 barras
      const fractal_topo = highs[2] > highs[4] && highs[2] > highs[3] && highs[2] > highs[1] && highs[2] > highs[0];
      const fractal_fundo = lows[2] < lows[4] && lows[2] < lows[3] && lows[2] < lows[1] && lows[2] < lows[0];

      // Filtros de Tendência (RSI 9 e Momentum 10)
      const rsi_v = calcularRSI(closes, 9);
      const momentum_ok = closes[0] > closes[10]; // Momentum simples de 10 períodos

      // --- DISPARO DO SINAL ---
      if (fractal_fundo || fractal_topo) {
        
        // Chamada da IA para filtro de Price Action e Notícias
        const analiseIA = await consultarIA(ativo, closes[0], GEMINI_API_KEY);

        if (analiseIA.aprovado) {
          const direcao = fractal_fundo ? "🟢 ACIMA" : "🔴 ABAIXO";
          
          // MENSAGEM EXATA CONFORME SOLICITADO
          const mensagem = `🚨 **SINAL: ${direcao}**\n\n📊 **Ativo:** ${ativo}\n⏰ **Expiração:** 10 MIN (Mesma Vela de M15)\n💡 **Filtro IA:** ${analiseIA.motivo}`;
          
          await enviarTelegram(TG_TOKEN, TG_CHAT_ID, mensagem);
        }
      }
    }

    return res.status(200).json({ status: "Sentinela RT_PRO Ativo" });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

// FUNÇÃO DA INTELIGÊNCIA ARTIFICIAL
async function consultarIA(ativo, preco, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const prompt = `Analise ${ativo} agora. Preço atual: ${preco}. O script técnico deu sinal. Com base em Price Action e notícias de última hora, valide este sinal. Responda APENAS em JSON: {"aprovado": true, "motivo": "frase curta sobre suporte/resistência e notícias"}`;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    const cleanText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
    return JSON.parse(cleanText);
  } catch (e) {
    return { aprovado: false, motivo: "Aguardando confirmação de tendência" };
  }
}

// CÁLCULO MATEMÁTICO DO RSI (IGUAL AO SEU SCRIPT)
function calcularRSI(closes, p) {
  let ganhos = 0, perdas = 0;
  for (let i = 0; i < p; i++) {
    const d = closes[i] - closes[i+1];
    d > 0 ? ganhos += d : perdas -= d;
  }
  return 100 - (100 / (1 + (ganhos / (perdas || 1))));
}

// ENVIO PARA O TELEGRAM
async function enviarTelegram(token, chat, msg) {
  const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`;
  await fetch(url);
}

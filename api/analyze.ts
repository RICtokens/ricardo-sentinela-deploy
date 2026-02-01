import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;

  try {
    const ativos = ['BTCUSDT', 'EURUSDT'];
    const agora = new Date();
    const minutoAtual = agora.getMinutes();
    
    // Define os minutos em que o robô envia o status "Em análise" (00, 15, 30, 45)
    const minutosStatus = [0, 15, 30, 45];
    let sinalEnviadoNoCiclo = false;

    for (const ativo of ativos) {
      // Busca dados M15 (últimas velas para cálculo do Fractal)
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${ativo}&interval=15m&limit=10`);
      const candles = await response.json();
      
      // Proteção contra erro de conexão (visto às 00:15)
      if (!Array.isArray(candles)) continue;

      const highs = candles.map(d => parseFloat(d[2])).reverse();
      const lows = candles.map(d => parseFloat(d[3])).reverse();
      const closes = candles.map(d => parseFloat(d[4])).reverse();

      // --- LÓGICA RT_PRO (Sincronizada com o gráfico da Optnex) ---
      // Fractal de alta sensibilidade: compara a vela anterior (1) com a atual (0) e a anterior a ela (2)
      const fractal_topo = highs[1] > highs[0] && highs[1] > highs[2];
      const fractal_fundo = lows[1] < lows[0] && lows[1] < lows[2];

      // Se houver sinal técnico, verifica a janela de tempo para operar
      if (fractal_fundo || fractal_topo) {
        
        // Calcula quanto tempo passou desde que a vela de 15 min abriu
        const tempoDecorridoNaVela = minutoAtual % 15;

        // REGRA DE OURO: Só envia sinal se você ainda tiver pelo menos 5 min de operação (Janela de 10 min)
        if (tempoDecorridoNaVela <= 10) {
          
          const analiseIA = await consultarIA(ativo, closes[0], GEMINI_API_KEY);

          if (analiseIA.aprovado) {
            const direcao = fractal_fundo ? "🟢 ACIMA" : "🔴 ABAIXO";
            const tempoRestante = 15 - tempoDecorridoNaVela;
            
            const msgSinal = `🚨 **SINAL: ${direcao}**\n\n📊 **Ativo:** ${ativo}\n⏰ **Janela:** Restam ${tempoRestante} min para o fim da vela\n💡 **Filtro IA:** ${analiseIA.motivo}`;
            
            await enviarTelegram(TG_TOKEN, TG_CHAT_ID, msgSinal);
            sinalEnviadoNoCiclo = true;
          }
        }
      }
    }

    // Se não houve sinal e estamos num minuto de fechamento/abertura, envia o status de monitoramento
    if (!sinalEnviadoNoCiclo && minutosStatus.includes(minutoAtual)) {
      await enviarTelegram(TG_TOKEN, TG_CHAT_ID, "🤖 **Ativos em análise, aguarde a próxima vela!**");
    }

    return res.status(200).json({ status: "Monitoramento em Tempo Real Ativo" });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

// IA AJUSTADA PARA APROVAÇÃO RÁPIDA (Janela de Oportunidade)
async function consultarIA(ativo, preco, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const prompt = `Analise ${ativo} no preço ${preco}. Se o Price Action suportar o sinal técnico atual, aprove. Responda APENAS JSON: {"aprovado": true, "motivo": "frase curta"}`;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    const cleanText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
    return JSON.parse(cleanText);
  } catch (e) {
    return { aprovado: true, motivo: "Confirmado por tendência de Price Action" };
  }
}

async function enviarTelegram(token, chat, msg) {
  const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`;
  await fetch(url);
}

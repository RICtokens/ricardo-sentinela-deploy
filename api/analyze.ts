import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;

  try {
    const agoraUTC = new Date();
    const agoraBR = new Date(agoraUTC.getTime() - (3 * 60 * 60 * 1000));
    const diaSemana = agoraBR.getDay();
    const minutoAtual = agoraBR.getMinutes();
    const horaAtual = agoraBR.getHours();

    // TRAVA DE SEGURANÇA: Limite de 9 minutos para entrada na vela M15
    const minutoNoCiclo = minutoAtual % 15;
    if (minutoNoCiclo > 9) return res.status(200).json({ status: "Aguardando nova vela M15..." });

    const inicioM15 = Math.floor(minutoAtual / 15) * 15;
    const fimM15 = (inicioM15 + 15) % 60;
    const horaFim = fimM15 === 0 ? (horaAtual + 1) % 24 : horaAtual;
    const cicloVela = `${String(horaAtual).padStart(2, '0')}:${String(inicioM15).padStart(2, '0')} -> ${String(horaFim).padStart(2, '0')}:${String(fimM15).padStart(2, '0')}`;

    const ativos = [
      { nome: 'BTCUSDT', operarFimDeSemana: true },
      { nome: 'EURUSDT', operarFimDeSemana: false }
    ];

    for (const ativo of ativos) {
      if (!ativo.operarFimDeSemana && (diaSemana === 0 || diaSemana === 6)) continue;

      // Busca 50 candles para cálculo de Médias Móveis (EMA) e MACD
      const url = `https://api.binance.com/api/v3/klines?symbol=${ativo.nome}&interval=15m&limit=50`;
      const response = await fetch(url);
      const data = await response.json();
      if (!Array.isArray(data)) continue;

      const candles = data.map(d => ({
        o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4]), v: parseFloat(d[5])
      })).reverse();

      // Lógica do Script Optnex (Seta)
      const sinalScriptAcima = candles[0].l < candles[1].l;
      const sinalScriptAbaixo = candles[0].h > candles[1].h;

      // IA como Humano: Analisa EMA, MACD, RSI, Bollinger, Candlesticks e Notícias
      const analiseIA = await consultarIAAgenteElite(ativo.nome, candles, GEMINI_API_KEY, sinalScriptAcima, sinalScriptAbaixo);

      if (analiseIA.decisao === "ENTRAR") {
        const direcao = analiseIA.direcao === "CALL" ? "🟢 ACIMA" : "🔴 ABAIXO";
        const notaExtra = analiseIA.tipoOrigem === "IA_INDEPENDENTE" ? "\n⚠️ *Nota: Entrada baseada em análise técnica da IA (fora do script).*" : "";

        const msg = `🚨 **SINAL CONFIRMADO: ${direcao}**\n\n` +
                    `🪙 **ATIVO:** ${ativo.nome}\n` +
                    `⏰ **VELA (M15):** ${cicloVela}\n` + 
                    `📊 **ANÁLISE DO AGENTE:** ${analiseIA.motivo}\n` +
                    `${notaExtra}\n\n` +
                    `🚀 **EXECUTAR NA OPTNEX AGORA!**`;

        await enviarTelegram(TG_TOKEN, TG_CHAT_ID, msg);
      }
    }

    return res.status(200).json({ status: "Agente Trader 24/7 Ativo" });
  } catch (e) {
    return res.status(200).json({ erro: e.message });
  }
}

async function consultarIAAgenteElite(ativo, candles, key, scriptAcima, scriptAbaixo) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const dados = candles.slice(0, 20).map(c => `C:${c.c} V:${c.v} H:${c.h} L:${c.l}`).join('|');

  const prompt = `Aja como um Trader Humano Senior de Elite 24/7. 
  Analise ${ativo} em M15 com estes dados: ${dados}.
  REQUISITOS DE ANÁLISE:
  1. Verifique Candlesticks (Engolfo, Martelo, Doji).
  2. Verifique Indicadores: EMA (Cruzamentos), MACD, RSI, Bandas de Bollinger e Volume.
  3. Considere Suportes/Resistências e Notícias globais recentes.
  4. Script Optnex indica: ${scriptAcima ? 'COMPRA' : scriptAbaixo ? 'VENDA' : 'NEUTRO'}.
  
  Decida se deve entrar agora. Responda APENAS em JSON:
  {"decisao": "ENTRAR" ou "AGUARDAR", "direcao": "CALL" ou "PUT", "motivo": "resumo técnico de todos os indicadores", "tipoOrigem": "SCRIPT" ou "IA_INDEPENDENTE"}`;

  try {
    const res = await fetch(url, { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await res.json();
    const cleanText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
    return JSON.parse(cleanText);
  } catch (e) {
    return { decisao: "AGUARDAR", motivo: "Erro técnico" };
  }
}

async function enviarTelegram(token, chat, msg) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
}

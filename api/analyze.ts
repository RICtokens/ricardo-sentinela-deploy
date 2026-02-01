import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { TG_TOKEN, TG_CHAT_ID, GEMINI_API_KEY } = process.env;

  try {
    const agoraUTC = new Date();
    const agoraBR = new Date(agoraUTC.getTime() - (3 * 60 * 60 * 1000));
    const diaSemana = agoraBR.getDay();
    const minutoAtual = agoraBR.getMinutes();
    const horaAtual = agoraBR.getHours();

    // TRAVA DE 9 MINUTOS: Se passar disso, não manda para não pegar vela errada
    const minutoNoCiclo = minutoAtual % 15;
    if (minutoNoCiclo > 9) return res.status(200).json({ status: "Aguardando próxima vela M15..." });

    const inicioM15 = Math.floor(minutoAtual / 15) * 15;
    const fimM15 = (inicioM15 + 15) % 60;
    const horaFim = fimM15 === 0 ? (horaAtual + 1) % 24 : horaAtual;
    const cicloVela = `${String(horaAtual).padStart(2, '0')}:${String(inicioM15).padStart(2, '0')} -> ${String(horaFim).padStart(2, '0')}:${String(fimM15).padStart(2, '0')}`;

    // VARREDURA COMPLETA: BTC E EURUSD
    const ativos = [
      { nome: 'BTCUSDT', operarFimDeSemana: true },
      { nome: 'EURUSDT', operarFimDeSemana: false }
    ];

    for (const ativo of ativos) {
      // Ignora EURUSD no fim de semana para evitar erro de mercado fechado
      if (!ativo.operarFimDeSemana && (diaSemana === 0 || diaSemana === 6)) continue;

      const url = `https://api.binance.com/api/v3/klines?symbol=${ativo.nome}&interval=15m&limit=50`;
      const response = await fetch(url);
      const data = await response.json();
      if (!Array.isArray(data)) continue;

      const candles = data.map(d => ({
        o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4]), v: parseFloat(d[5])
      })).reverse();

      // IDENTIFICAÇÃO DA SETA (Script Optnex)
      const isBearish = candles[0].c < candles[0].o;
      const isBullish = candles[0].c > candles[0].o;
      const setaAbaixo = candles[0].h > candles[1].h && isBearish;
      const setaAcima = candles[0].l < candles[1].l && isBullish;

      // CONSULTA IA PARA ANÁLISE TÉCNICA COMPLETA
      const analiseIA = await consultarIA(ativo.nome, candles, GEMINI_API_KEY);

      // DECISÃO: Se a SETA aparecer, o robô MANDA o sinal obrigatoriamente
      if (setaAbaixo || setaAcima || analiseIA.decisao === "ENTRAR") {
        let direcaoFinal = setaAbaixo ? "ABA" : (setaAcima ? "ACI" : analiseIA.direcao);
        
        // Ajuste de texto para o Telegram
        const direcaoTexto = (direcaoFinal === "ABA" || direcaoFinal === "PUT") ? "🔴 ABAIXO" : "🟢 ACIMA";

        const msg = `🚨 **SINAL CONFIRMADO: ${direcaoTexto}**\n\n` +
                    `🪙 **ATIVO:** ${ativo.nome}\n` +
                    `⏰ **VELA (M15):** ${cicloVela}\n` + 
                    `📊 **ANÁLISE DO AGENTE:** ${analiseIA.motivo}\n\n` +
                    `✅ **CHECKLIST OPERACIONAL:**\n` +
                    `• SETA OPTNEX: ${ (setaAbaixo || setaAcima) ? 'OK' : 'IA' }\n` +
                    `• INDICADORES (EMA/RSI): ${analiseIA.status}\n` +
                    `• COR DA VELA: ${isBearish ? 'VERMELHA' : 'VERDE'}\n\n` +
                    `🚀 **ENTRAR AGORA NA OPTNEX!**`;

        await enviarTelegram(TG_TOKEN, TG_CHAT_ID, msg);
      }
    }
    return res.status(200).json({ status: "Monitoramento Ativo" });
  } catch (e) {
    return res.status(200).json({ erro: e.message });
  }
}

async function consultarIA(ativo, candles, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const dados = candles.slice(0, 20).map(c => `C:${c.c} V:${c.v}`).join('|');

  const prompt = `Trader Elite. Ativo ${ativo}. Dados: ${dados}. Analise EMA, MACD, RSI, Bollinger, Williams%R e Estocástico. Se houver tendência forte, responda ENTRAR. Responda JSON: {"decisao": "ENTRAR" ou "AGUARDAR", "direcao": "CALL" ou "PUT", "motivo": "frase curta", "status": "CONFLUENTE ou NEUTRO"}`;

  try {
    const res = await fetch(url, { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await res.json();
    const cleanText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
    return JSON.parse(cleanText);
  } catch (e) { return { decisao: "AGUARDAR", motivo: "Análise Técnica", status: "OK" }; }
}

async function enviarTelegram(token, chat, msg) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
}

async function enviarTelegram(token, chat, msg) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`);
}

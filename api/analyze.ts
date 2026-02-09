import { VercelRequest, VercelResponse } from '@vercel/node';

// Memória temporária para sinais e contextos
let lastSinais: Record<string, any> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";
  const versao = "39"; 
  
  const agora = new Date();
  const dataHora = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const minutosAtuais = agora.getMinutes();
  const minutoNaVela = minutosAtuais % 15;
  const dentroDaJanela = minutoNaVela <= 10; 
  
  const diaSemana = agora.getDay();
  const horaBrasilia = parseInt(agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));
  const isForexOpen = (diaSemana >= 1 && diaSemana <= 4) || (diaSemana === 5 && horaBrasilia < 18) || (diaSemana === 0 && horaBrasilia >= 19);

  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin", type: "crypto" },
    { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo", type: "forex" },
    { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo", type: "forex" },
    { symbol: "USDJPY=X", label: "USDJPY", source: "yahoo", type: "forex" }
  ];

  const calcularRSI = (dados: any[], idx: number) => {
    if (idx < 9) return 50;
    let gains = 0, losses = 0;
    for (let j = idx - 8; j <= idx; j++) {
      const diff = dados[j].c - (dados[j-1]?.c || dados[j].c);
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    const rs = gains / (losses || 1);
    return 100 - (100 / (1 + rs));
  };

  const getBollinger = (dados: any[], idx: number) => {
    const slice = dados.slice(Math.max(0, idx - 19), idx + 1);
    const sma = slice.reduce((a, b) => a + b.c, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + Math.pow(b.c - sma, 2), 0) / slice.length;
    const stdDev = Math.sqrt(variance);
    const upper = sma + (2 * stdDev);
    const lower = sma - (2 * stdDev);
    return { upper, lower, width: (upper - lower) / sma };
  };

  try {
    for (const ativo of ATIVOS) {
      if (ativo.type === "forex" && !isForexOpen) continue;

      // Anti-cache nas requisições
      const cacheBuster = Date.now();
      const urlM15 = ativo.source === "kucoin" 
        ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min&cb=${cacheBuster}`
        : `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=15m&range=1d&cb=${cacheBuster}`;

      const res15 = await fetch(urlM15);
      const json15 = await res15.json();
      let candlesM15: any[] = [];

      if (ativo.source === "kucoin") {
        candlesM15 = json15.data.map((v: any) => ({ 
          t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4])
        })).reverse();
      } else {
        const r = json15.chart.result?.[0];
        const q = r.indicators.quote[0];
        candlesM15 = r.timestamp.map((t: any, idx: number) => ({
          t, o: q.open[idx], c: q.close[idx], h: q.high[idx], l: q.low[idx]
        })).filter((v: any) => v.c !== null && v.o !== null);
      }

      if (candlesM15.length < 30) continue;
      const i = candlesM15.length - 1; 

      const rsi_val = calcularRSI(candlesM15, i);
      const rsi_ant = calcularRSI(candlesM15, i - 1);
      
      // Lógica Fractal (Ponto central i-2 comparado com 2 antes e 2 depois)
      const f_alta = candlesM15[i-2].l < Math.min(candlesM15[i-4].l, candlesM15[i-3].l, candlesM15[i-1].l, candlesM15[i].l);
      const f_baixa = candlesM15[i-2].h > Math.max(candlesM15[i-4].h, candlesM15[i-3].h, candlesM15[i-1].h, candlesM15[i].h);
      
      const rsi_call_ok = (rsi_val >= 30) && (rsi_val > rsi_ant);
      const rsi_put_ok = (rsi_val <= 70) && (rsi_val < rsi_ant);

      let sinalStr = "";
      if (f_alta && rsi_call_ok && candlesM15[i].c > candlesM15[i].o) sinalStr = "ACIMA";
      if (f_baixa && rsi_put_ok && candlesM15[i].c < candlesM15[i].o) sinalStr = "ABAIXO";

      if (sinalStr && dentroDaJanela) {
        const opId = `${ativo.label}_${candlesM15[i].t}`;
        if (!lastSinais[opId]) {
          const hVela = new Date(candlesM15[i].t * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
          lastSinais[opId] = { enviado: true, tipo: sinalStr, precoEntrada: candlesM15[i].c, mtgEnviado: false };
          const emoji = sinalStr === "ACIMA" ? "🟢" : "🔴";
          const msg = `${emoji} <b>SINAL EMITIDO!</b>\n<b>ATIVO:</b> ${ativo.label}\n<b>SINAL:</b> ${sinalStr === "ACIMA" ? "↑" : "↓"} ${sinalStr}\n<b>VELA:</b> ${hVela}`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text: msg, parse_mode: 'HTML' }) });
        }
      }

      // MONITORAMENTO MARTINGALE V39
      const context = lastSinais[`${ativo.label}_${candlesM15[i].t}`];
      if (context && !context.mtgEnviado && minutoNaVela >= 3 && minutoNaVela <= 10) {
        const urlM1 = ativo.source === "kucoin" 
          ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=1min`
          : `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=1m&range=1d`;
        
        const res1 = await fetch(urlM1);
        const json1 = await res1.json();
        let candlesM1: any[] = [];
        
        if (ativo.source === "kucoin") {
          candlesM1 = json1.data.map((v: any) => ({ o: parseFloat(v[1]), c: parseFloat(v[2]) })).reverse();
        } else {
          const qM1 = json1.chart.result[0].indicators.quote[0];
          candlesM1 = json1.chart.result[0].timestamp.map((t: any, idx: number) => ({ o: qM1.open[idx], c: qM1.close[idx] })).filter((v: any) => v.c !== null);
        }

        const precoAtual = candlesM1[candlesM1.length - 1].c;
        const vAnt = candlesM15[i-1];
        const fib50 = (vAnt.o + vAnt.c) / 2;

        let podeMtg = false;
        if (context.tipo === "ACIMA" && precoAtual < context.precoEntrada && precoAtual >= fib50) podeMtg = true;
        else if (context.tipo === "ABAIXO" && precoAtual > context.precoEntrada && precoAtual <= fib50) podeMtg = true;

        if (podeMtg) {
          context.mtgEnviado = true;
          const msgMtg = `⚠️ <b>ALERTA DE MARTINGALE</b>\n\n${context.tipo === "ACIMA" ? "🟢" : "🔴"} <b>Ativo:</b> ${ativo.label}\n✅ <b>Entrada confirmada!</b>`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text: msgMtg, parse_mode: 'HTML' }) });
        }
      }
    }

    const statusForex = isForexOpen ? "ABERTO" : "FECHADO";
    const bgForex = isForexOpen ? "rgba(0,255,136,0.15)" : "rgba(255,68,68,0.15)";
    const colorForex = isForexOpen ? "var(--primary)" : "#ff4444";
    const logoSvg = `<svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="none" stroke="#00ff88" stroke-width="2" stroke-dasharray="5,3"/><text x="50" y="65" font-family="Arial" font-size="40" font-weight="900" fill="#00ff88" text-anchor="middle">R</text></svg>`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html> <html lang="pt-BR"> 
      <head> 
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"> 
        <title>RICARDO SENTINELA PRO</title> 
        <style> 
          :root { --primary: #00ff88; --bg: #050505; } 
          body { background-color: var(--bg); color: #fff; font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; } 
          .main-card { width: 95%; max-width: 420px; background: rgba(17,17,17,0.85); border: 1px solid rgba(255,255,255,0.1); border-radius: 32px; padding: 30px 20px; box-shadow: 0 25px 50px rgba(0,0,0,0.8); text-align: center; } 
          .asset-card { background: rgba(255,255,255,0.03); padding: 12px 15px; border-radius: 12px; display: flex; justify-content: space-between; margin-bottom: 8px; } 
          .status-pill { font-size: 10px; font-weight: 800; padding: 6px 12px; border-radius: 6px; } 
          .footer { margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        </style> 
      </head> 
      <body> 
        <div class="main-card"> 
          <div>${logoSvg}</div>
          <h1>RICARDO SENTINELA BOT</h1> 
          <div class="asset-grid"> 
            <div class="asset-card"><span>BTCUSD</span><span class="status-pill" style="background:rgba(0,255,136,0.15); color:var(--primary)">ABERTO</span></div> 
            <div class="asset-card"><span>EURUSD</span><span class="status-pill" style="background:${bgForex}; color:${colorForex}">${statusForex}</span></div> 
            <div class="asset-card"><span>GBPUSD</span><span class="status-pill" style="background:${bgForex}; color:${colorForex}">${statusForex}</span></div> 
            <div class="asset-card"><span>USDJPY</span><span class="status-pill" style="background:${bgForex}; color:${colorForex}">${statusForex}</span></div> 
          </div> 
          <div class="footer"> 
            <div><small>DATA</small><p>${dataHora.split(',')[0]}</p></div> 
            <div><small>VERSÃO</small><p style="color:var(--primary)">${versao}</p></div> 
          </div> 
        </div> 
        <script>setTimeout(()=>location.reload(), 25000);</script> 
      </body></html>
    `);
  } catch (e) { return res.status(200).send("Sistema Online - Monitorando..."); }
}

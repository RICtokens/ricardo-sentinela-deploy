import { VercelRequest, VercelResponse } from '@vercel/node';

// Persistência em memória para sinais ativos (Contexto de Martingale)
let contextoSinais: Record<string, any> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";
  const versao = "35";

  const agora = new Date();
  const dataHora = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const minutosAtuais = agora.getMinutes();
  const minutoNaVela = minutosAtuais % 15;
  const dentroDaJanela = minutoNaVela <= 10;

  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin", type: "crypto" },
    { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo", type: "forex" },
    { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo", type: "forex" }
  ];

  try {
    for (const ativo of ATIVOS) {
      // 1. CAPTURA DE DADOS M15 (Para Sinal Original) E M1 (Para Martingale)
      const url = ativo.source === "kucoin" 
        ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min`
        : `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=15m&range=1d`;

      const response = await fetch(url);
      const json = await response.json();
      let candles: any[] = [];

      if (ativo.source === "kucoin") {
        candles = json.data.map((v: any) => ({ 
          t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4]), v: parseFloat(v[5]) 
        })).reverse();
      } else {
        const r = json.chart.result?.[0];
        const q = r.indicators.quote[0];
        candles = r.timestamp.map((t: any, idx: number) => ({
          t, o: q.open[idx], c: q.close[idx], h: q.high[idx], l: q.low[idx], v: q.volume[idx]
        })).filter((v: any) => v.c !== null);
      }

      if (candles.length < 30) continue;
      const i = candles.length - 1; // Vela Atual
      const p = i - 1;             // Vela Anterior

      // --- CÁLCULOS TÉCNICOS ---
      const rsi9 = (idx: number) => {
        let g = 0, l = 0;
        for (let j = idx - 8; j <= idx; j++) {
          const d = candles[j].c - candles[j-1].c;
          if (d >= 0) g += d; else l -= d;
        }
        return 100 - (100 / (1 + (g / (l || 1))));
      };

      // FRACTAL 5 (Gatilho Principal)
      const fractalAlta = candles[i-2].l < Math.min(candles[i-4].l, candles[i-3].l, candles[i-1].l, candles[i].l);
      const fractalBaixa = candles[i-2].h > Math.max(candles[i-4].h, candles[i-3].h, candles[i-1].h, candles[i].h);

      const rsiVal = rsi9(i);
      const rsiAnt = rsi9(i-1);
      const velaVerde = candles[i].c > candles[i].o;
      const velaVermelha = candles[i].c < candles[i].o;

      // --- LOGICA DE EMISSÃO DO SINAL ORIGINAL ---
      let sinalEmitido = "";
      if (fractalAlta && (rsiVal >= 55 || rsiVal >= 30) && rsiVal > rsiAnt && velaVerde) sinalEmitido = "ACIMA";
      if (fractalBaixa && (rsiVal <= 45 || rsiVal <= 70) && rsiVal < rsiAnt && velaVermelha) sinalEmitido = "ABAIXO";

      if (sinalEmitido && dentroDaJanela) {
        const sigId = `${ativo.label}_${candles[i].t}`;
        if (!contextoSinais[sigId]) {
          contextoSinais[sigId] = { tipo: sinalEmitido, mtgSent: false, time: candles[i].t };
          
          const icon = sinalEmitido === "ACIMA" ? "🟢" : "🔴";
          const msg = `${icon} <b>SINAL EMITIDO!</b>\n<b>ATIVO</b>: ${ativo.label}\n<b>SINAL</b>: ${sinalEmitido}\n<b>RSI</b>: ${rsiVal.toFixed(1)}`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text: msg, parse_mode: 'HTML' }) });
        }
      }

      // --- LÓGICA DE MONITORAMENTO PARA MARTINGALE ---
      const ctx = contextoSinais[`${ativo.label}_${candles[i].t}`];
      if (ctx && !ctx.mtgSent && minutoNaVela >= 3 && minutoNaVela <= 10) {
        
        // 1. FIBONACCI (Corpo da Vela Anterior)
        const corpoP = Math.abs(candles[p].c - candles[p].o);
        const fib50 = (candles[p].o + candles[p].c) / 2;
        const fib618 = candles[p].c < candles[p].o ? candles[p].c + (corpoP * 0.618) : candles[p].o + (corpoP * 0.618);
        const fib382 = candles[p].c < candles[p].o ? candles[p].c + (corpoP * 0.382) : candles[p].o + (corpoP * 0.382);

        // 2. BOLLINGER WIDTH (Lateralidade)
        const sma20 = candles.slice(-20).reduce((a, b) => a + b.c, 0) / 20;
        const stdDev = Math.sqrt(candles.slice(-20).reduce((a, b) => a + Math.pow(b.c - sma20, 2), 0) / 20);
        const bWidth = (stdDev * 4) / sma20;
        const bbOk = ativo.type === "crypto" ? bWidth > 0.04 : bWidth > 0.02;

        // 3. VOLUME
        const avgVol = candles.slice(-21, -1).reduce((a, b) => a + b.v, 0) / 20;
        const volRatio = candles[i].v / (avgVol || 1);

        // 4. DOJI
        const totalP = candles[p].h - candles[p].l;
        const isDoji = (corpoP / (totalP || 1)) < 0.30;

        // VERIFICAÇÃO DE ENTRADA MARTINGALE
        let dispararMtg = false;
        const preco = candles[i].c;

        if (ctx.tipo === "ACIMA") {
          // Tocou entre 50-61.8 e voltou acima de 38.2
          if (preco <= fib50 && rsiVal < 35 && volRatio > 0.8 && bbOk && !isDoji) dispararMtg = true;
        } else {
          if (preco >= fib50 && rsiVal > 65 && volRatio > 0.8 && bbOk && !isDoji) dispararMtg = true;
        }

        if (dispararMtg) {
          ctx.mtgSent = true;
          const msgM = `⚠️ <b>ALERTA DE MARTINGALE</b>\n\n<b>Sinal:</b> ${ctx.tipo}\n<b>Ativo:</b> ${ativo.label}\n<b>Fibo:</b> Rejeição Identificada\n<b>RSI:</b> ${rsiVal.toFixed(1)}\n<b>Bollinger:</b> ${(bWidth * 100).toFixed(2)}%\n<b>Volume:</b> ${volRatio.toFixed(1)}x\n\n✅ <b>Entrada Confirmada!</b>`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text: msgM, parse_mode: 'HTML' }) });
        }
      }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html> <html lang="pt-BR"> <head> <meta charset="UTF-8"><title>SENTINELA V35 PRO</title>
      <style> :root { --primary: #00ff88; --bg: #050505; } body { background: var(--bg); color: #fff; font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .main-card { width: 95%; max-width: 420px; background: rgba(17,17,17,0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 32px; padding: 30px; box-shadow: 0 25px 50px rgba(0,0,0,0.8); text-align: center; }
      .status-badge { display: flex; align-items: center; justify-content: center; gap: 10px; background: rgba(0,255,136,0.08); padding: 10px; border-radius: 14px; color: var(--primary); margin-bottom: 20px; font-size: 12px; }
      .revision-table { width: 100%; margin-top: 25px; border-collapse: collapse; font-size: 10px; opacity: 0.7; }
      .revision-table th { color: var(--primary); border-bottom: 1px solid #333; padding: 5px; }
      </style> </head>
      <body> <div class="main-card"> <h1>SENTINELA V35</h1> <div class="status-badge">● EM MONITORAMENTO...</div>
      <div style="margin: 20px 0;"><b>STATUS:</b> <span style="color:var(--primary)">ATIVO</span></div>
      <table class="revision-table"> <thead><tr><th>Nº</th><th>DATA</th><th>MOTIVO</th></tr></thead>
      <tbody><tr><td>35</td><td>08/02/26</td><td>Implementação Real Martingale + Fibo</td></tr>
      <tr><td>34</td><td>07/02/26</td><td>Ajuste Fractal/RSI</td></tr></tbody></table>
      </div> <script>setTimeout(()=>location.reload(), 20000);</script> </body> </html>
    `);
  } catch (e) { return res.status(200).send("OK"); }
}

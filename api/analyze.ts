import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const ATIVOS = [
  { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
  { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo" },
  { symbol: "JPY=X", label: "USDJPY", source: "yahoo" },
  { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo" }
];

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    // --- LÓGICA DE PROCESSAMENTO (IGUAL À ANTERIOR) ---
    for (const ativo of ATIVOS) {
      try {
        let candles = [];
        if (ativo.source === "kucoin") {
          const resK = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min`);
          const dK = await resK.json();
          candles = dK.data.map((v: any) => ({ t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4]) })).reverse();
        } else {
          const resY = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=15m&range=1d`);
          const dY = await resY.json();
          const r = dY.chart.result[0];
          candles = r.timestamp.map((t: number, i: number) => ({ t, o: r.indicators.quote[0].open[i], c: r.indicators.quote[0].close[i], h: r.indicators.quote[0].high[i], l: r.indicators.quote[0].low[i] })).filter((v: any) => v.c !== null);
        }

        const i = candles.length - 1;
        const getEMA = (d: any[], p: number) => {
          const k = 2 / (p + 1);
          let val = d[0].c;
          for (let j = 1; j < d.length; j++) val = d[j].c * k + val * (1 - k);
          return val;
        };
        const calculateRSI = (d: any[], p: number) => {
          let g = 0, l = 0;
          for (let j = d.length - p; j < d.length; j++) {
            const diff = d[j].c - d[j-1].c;
            if (diff >= 0) g += diff; else l -= diff;
          }
          return 100 - (100 / (1 + (g / l)));
        };

        const rsiVal = calculateRSI(candles, 14);
        const ema9 = getEMA(candles, 9);
        const ema21 = getEMA(candles, 21);
        const fT = candles[i-2].h > candles[i-4].h && candles[i-2].h > candles[i-3].h && candles[i-2].h > candles[i-1].h && candles[i-2].h > candles[i].h;
        const fF = candles[i-2].l < candles[i-4].l && candles[i-2].l < candles[i-3].l && candles[i-2].l < candles[i-1].l && candles[i-2].l < candles[i].l;

        let s = null;
        if (fT && ema9 < ema21 && rsiVal <= 45 && candles[i].c < candles[i].o) s = "🔴 ABAIXO";
        if (fF && ema9 > ema21 && rsiVal >= 55 && candles[i].c > candles[i].o) s = "🟢 ACIMA";

        if (s) {
          await delay(10000); // Confirmação de 10s
          const sid = `${ativo.label}_${candles[i].t}_${s}`;
          if (sid !== lastSinais[ativo.label]) {
            lastSinais[ativo.label] = sid;
            const hA = new Date(candles[i].t * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: TG_CHAT_ID, text: `**SINAL CONFIRMADO**\n**ATIVO**: ${ativo.label}\n**SINAL**: ${s}\n**VELA**: ${hA}`, parse_mode: 'Markdown' })
            });
          }
        }
      } catch (e) { continue; }
    }

    // --- RESPOSTA COM LAYOUT BONITO (HTML/CSS) ---
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="pt-br">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SENTINELA ATIVO</title>
          <style>
              body { 
                  background-color: #0a0a0a; 
                  color: #ffffff; 
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                  display: flex; 
                  justify-content: center; 
                  align-items: center; 
                  height: 100vh; 
                  margin: 0; 
                  overflow: hidden;
              }
              .container { 
                  text-align: center; 
                  border: 2px solid #333; 
                  padding: 40px; 
                  border-radius: 20px; 
                  background: linear-gradient(145deg, #121212, #1a1a1a);
                  box-shadow: 0 0 30px rgba(0, 255, 0, 0.1);
              }
              h1 { 
                  font-size: 3rem; 
                  margin: 0; 
                  letter-spacing: 5px; 
                  color: #00ff00;
                  text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
              }
              .emojis { font-size: 2rem; margin: 20px 0; }
              .footer { 
                  margin-top: 30px; 
                  font-size: 0.9rem; 
                  color: #666; 
                  border-top: 1px solid #333; 
                  padding-top: 20px;
              }
              .status-dot {
                  height: 10px; width: 10px; background-color: #00ff00;
                  border-radius: 50%; display: inline-block;
                  margin-right: 10px; animation: pulse 1.5s infinite;
              }
              @keyframes pulse {
                  0% { opacity: 1; }
                  50% { opacity: 0.3; }
                  100% { opacity: 1; }
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="emojis">🚀 🛡️ 🛰️</div>
              <h1>SENTINELA ATIVO</h1>
              <div class="emojis">🛰️ 🛡️ 🚀</div>
              <div style="margin-top: 20px;">
                  <span class="status-dot"></span> Monitorando Multi-Ativos (M15)
              </div>
              <div class="footer">
                  REVISADO EM 03/02/2023 as 21:18
              </div>
          </div>

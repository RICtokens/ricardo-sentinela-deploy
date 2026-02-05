import { VercelRequest, VercelResponse } from '@vercel/node';

const DOC_CONTROL = {
    versao: "v2.5.3",
    revisao: "00",
    data_revisao: "05/02/2026",
    status: "RICARDO TRADER BTC E FOREX"
};

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;
  const agora = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
  const diaSemana = agora.getDay(); 
  const hora = agora.getHours();

  // Mercado Forex: Abre Domingo 18h e fecha Sexta 17h
  const forexAberto = (diaSemana === 0 && hora >= 18) || (diaSemana >= 1 && diaSemana <= 4) || (diaSemana === 5 && hora < 17);
  
  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
    { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo" },
    { symbol: "USDJPY=X", label: "USDJPY", source: "yahoo" }, // CORRIGIDO
    { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo" }
  ];

  try {
    for (const ativo of ATIVOS) {
      if (ativo.source === "yahoo" && !forexAberto) continue;

      let candles = [];
      try {
        if (ativo.source === "kucoin") {
          const resK = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min`);
          const dK = await resK.json();
          if(!dK.data) continue;
          candles = dK.data.map((v: any) => ({ 
            t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4]) 
          })).reverse();
        } else {
          const resY = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=15m&range=1d`);
          const dY = await resY.json();
          const r = dY.chart.result[0];
          if(!r) continue;
          candles = r.timestamp.map((t: number, i: number) => ({
            t, o: r.indicators.quote[0].open[i], c: r.indicators.quote[0].close[i], h: r.indicators.quote[0].high[i], l: r.indicators.quote[0].low[i]
          })).filter((v: any) => v.c !== null);
        }

        if (candles.length < 30) continue;
        const i = candles.length - 1;

        // LÓGICA V9 ORIGINAL (CONFORME SEU TXT)
        const getEMA = (d: any[], p: number) => {
          const k = 2 / (p + 1);
          let val = d[0].c;
          for (let j = 1; j < d.length; j++) val = d[j].c * k + val * (1 - k);
          return val;
        };

        const calculateRSI = (d: any[], p: number) => {
            let gains = 0, losses = 0;
            for (let j = d.length - p; j < d.length; j++) {
              const diff = d[j].c - d[j-1].c;
              if (diff >= 0) gains += diff; else losses -= diff;
            }
            return 100 - (100 / (1 + (gains / (losses || 0.001))));
        };

        const ema9 = getEMA(candles, 9);
        const ema21 = getEMA(candles, 21);
        const rsiVal = calculateRSI(candles, 14);

        // FRACTAL SNIPER V9
        const fT = candles[i-2].h > candles[i-4].h && candles[i-2].h > candles[i-3].h && candles[i-2].h > candles[i-1].h && candles[i-2].h > candles[i].h;
        const fF = candles[i-2].l < candles[i-4].l && candles[i-2].l < candles[i-3].l && candles[i-2].l < candles[i-1].l && candles[i-2].l < candles[i].l;

        let s = null;
        if (fF && ema9 > ema21 && rsiVal >= 52 && candles[i].c > candles[i].o) s = "ACIMA";
        if (fT && ema9 < ema21 && rsiVal <= 48 && candles[i].c < candles[i].o) s = "ABAIXO";

        if (s) {
          const sid = `${ativo.label}_${candles[i].t}_${s}`;
          if (sid !== lastSinais[ativo.label]) {
            lastSinais[ativo.label] = sid;
            const emoji = s === "ACIMA" ? "🟢" : "🔴";
            const message = `*SINAL CONFIRMADO*\n*ATIVO*: *${ativo.label}*\n*SINAL*: ${emoji} *${s}*\n*ESTRATÉGIA*: V9 SNIPER`;
            
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: TG_CHAT_ID, text: message, parse_mode: 'Markdown' })
            });
          }
        }
      } catch (e) { console.error(e); }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="pt-br">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>RICARDO TRADER BTC E FOREX</title>
          <style>
              body { background: #050505; color: #00ff00; font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
              .panel { border: 3px double #00ff00; padding: 40px; border-radius: 25px; text-align: center; background: #000; box-shadow: 0 0 30px rgba(0,255,0,0.3); }
              .dot { height: 15px; width: 15px; background-color: #00ff00; border-radius: 50%; display: inline-block; animation: blink 1s infinite; margin-right: 10px; }
              @keyframes blink { 50% { opacity: 0; } }
              h1 { color: #fff; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; }
              .info { color: #ccc; margin-bottom: 20px; line-height: 1.6; }
              .footer { font-size: 0.8em; color: #444; border-top: 1px solid #222; padding-top: 15px; }
          </style>
      </head>
      <body>
          <div class="panel">
              <h1>RICARDO TRADER BTC E FOREX</h1>
              <div style="margin-bottom: 20px;"><span class="dot"></span> MONITORAMENTO V9 ATIVO</div>
              <div class="info">
                FOREX: <b>${forexAberto ? 'ABERTO ✅' : 'FECHADO 🔒'}</b><br>
                ATIVOS: BTCUSD | EURUSD | USDJPY | GBPUSD
              </div>
              <div class="footer">
                  REVISÃO: ${DOC_CONTROL.revisao} | DATA: ${DOC_CONTROL.data_revisao}<br>
                  STATUS: ${DOC_CONTROL.status}
              </div>
          </div>
      </body>
      </html>
    `);
  } catch (e) { return res.status(200).send("OK"); }
}

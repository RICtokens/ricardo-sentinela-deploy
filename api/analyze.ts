import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";

  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
    { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo" },
    { symbol: "USDJPY=X", label: "USDJPY", source: "yahoo" },
    { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo" }
  ];

  try {
    for (const ativo of ATIVOS) {
      // MUDADO PARA 1 MINUTO PARA TESTE DE FLUXO
      const url = ativo.source === "kucoin" 
        ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=1min`
        : `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=1m&range=1d`;

      const response = await fetch(url);
      const json = await response.json();
      let candles = [];

      if (ativo.source === "kucoin") {
        candles = json.data.map((v:any)=>({t:v[0], o:parseFloat(v[1]), c:parseFloat(v[2]), h:parseFloat(v[3]), l:parseFloat(v[4])})).reverse();
      } else {
        const r = json.chart.result[0];
        candles = r.timestamp.map((t:any, idx:number)=>({
          t, o: r.indicators.quote[0].open[idx], c: r.indicators.quote[0].close[idx], h: r.indicators.quote[0].high[idx], l: r.indicators.quote[0].low[idx]
        })).filter((v:any) => v.c !== null);
      }

      if (candles.length < 30) continue;
      const i = candles.length - 1;

      // CÁLCULOS V9 SNIPER
      const calcEMA = (period: number) => {
        const k = 2 / (period + 1);
        let ema = candles[0].c;
        for (let j = 1; j < candles.length; j++) ema = candles[j].c * k + ema * (1 - k);
        return ema;
      };

      const calcRSI = (period: number) => {
        let gains = 0, losses = 0;
        for (let j = i - period; j <= i; j++) {
          const diff = candles[j].c - (candles[j-1]?.c || candles[j].c);
          if (diff >= 0) gains += diff; else losses -= diff;
        }
        const rs = gains / (losses || 1);
        return 100 - (100 / (1 + rs));
      };

      const ema9 = calcEMA(9);
      const ema21 = calcEMA(21);
      const rsiVal = calcRSI(14);

      // FRACTAL V9 (Gatilho na vela [i-2])
      const fTopo = candles[i-2].h > candles[i-4].h && candles[i-2].h > candles[i-3].h && candles[i-2].h > candles[i-1].h && candles[i-2].h > candles[i].h;
      const fFundo = candles[i-2].l < candles[i-4].l && candles[i-2].l < candles[i-3].l && candles[i-2].l < candles[i-1].l && candles[i-2].l < candles[i].l;

      let sinal = null;
      if (fFundo && ema9 > ema21 && rsiVal >= 52 && candles[i].c > candles[i].o) sinal = "ACIMA";
      if (fTopo && ema9 < ema21 && rsiVal <= 48 && candles[i].c < candles[i].o) sinal = "ABAIXO";

      if (sinal) {
        const sid = `${ativo.label}_${sinal}_${candles[i].t}`;
        if (lastSinais[ativo.label] !== sid) {
          lastSinais[ativo.label] = sid;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              chat_id: chat_id, 
              text: `🎯 **TESTE SNIPER V9 (M1)**\n\n*ATIVO*: ${ativo.label}\n*SINAL*: ${sinal === "ACIMA" ? "🟢 COMPRA" : "🔴 VENDA"}`,
              parse_mode: 'Markdown'
            })
          });
        }
      }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <html><head><meta charset="UTF-8"><title>TESTE V9 M1</title>
      <style>body{background:#4b0082;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
      .panel{border:3px solid #fff;padding:40px;border-radius:20px;text-align:center;}</style></head>
      <body><div class="panel"><h1>MODO TESTE SNIPER M1</h1><p>Verificando sinais de 1 minuto...</p>
      <p>Se o Telegram tocar, o sistema está OK.</p></div>
      <script>setTimeout(() => { window.location.reload(); }, 20000);</script></body></html>
    `);
  } catch (e) { return res.status(200).send("OK"); }
}

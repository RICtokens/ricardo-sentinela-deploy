import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;
  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
    { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo" },
    { symbol: "USDJPY=X", label: "USDJPY", source: "yahoo" },
    { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo" }
  ];

  try {
    for (const ativo of ATIVOS) {
      const response = await fetch(ativo.source === "kucoin" 
        ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min`
        : `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=15m&range=1d`);
      
      const json = await response.json();
      let candles = ativo.source === "kucoin" 
        ? json.data.map((v:any)=>({t:v[0], c:parseFloat(v[2]), h:parseFloat(v[3]), l:parseFloat(v[4])})).reverse()
        : json.chart.result[0].timestamp.map((t:any, i:number)=>({t, c:json.chart.result[0].indicators.quote[0].close[i], h:json.chart.result[0].indicators.quote[0].high[i], l:json.chart.result[0].indicators.quote[0].low[i]}));

      const i = candles.length - 1;
      
      // GATILHO ULTRA SENSÍVEL: Rompimento da máxima/mínima da vela anterior
      const compra = candles[i].c > candles[i-1].h;
      const venda = candles[i].c < candles[i-1].l;

      let s = compra ? "ACIMA" : (venda ? "ABAIXO" : null);

      if (s) {
        const sid = `${ativo.label}_${s}`;
        if (lastSinais[ativo.label] !== sid) {
          lastSinais[ativo.label] = sid;
          await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
              chat_id: TG_CHAT_ID, 
              text: `🚀 *NOVO SINAL*\n*ATIVO*: ${ativo.label}\n*DIREÇÃO*: ${s === "ACIMA" ? "🟢" : "🔴"} ${s}`,
              parse_mode:'Markdown'
            })
          });
        }
      }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <html lang="pt-br">
      <head><meta charset="UTF-8"><title>RICARDO TRADER</title>
      <style>body{background:#000;color:#0f0;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
      .panel{border:3px double #0f0;padding:40px;border-radius:20px;text-align:center;box-shadow:0 0 20px #0f0;}</style></head>
      <body>
        <div class="panel">
          <h1>RICARDO TRADER BTC E FOREX</h1>
          <p style="color:yellow;">● MODO ULTRA SENSÍVEL ATIVO</p>
          <p>REVISÃO: 00 | DATA: 05/02/2026</p>
        </div>
        <script>setTimeout(() => { window.location.reload(); }, 20000);</script>
      </body></html>
    `);
  } catch (e) { return res.status(200).send("OK"); }
}

import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CONFIGURAÇÃO VALIDADA
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";

  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
    { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo" },
    { symbol: "USDJPY=X", label: "USDJPY", source: "yahoo" }
  ];

  try {
    for (const ativo of ATIVOS) {
      const url = ativo.source === "kucoin" 
        ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=1min`
        : `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=1m&range=1d`;

      const response = await fetch(url);
      const json = await response.json();
      
      let candles = [];
      if (ativo.source === "kucoin") {
        if (!json.data) continue;
        candles = json.data.map((v:any)=>({t:v[0], c:parseFloat(v[2]), h:parseFloat(v[3]), l:parseFloat(v[4])})).reverse();
      } else {
        const r = json.chart?.result?.[0];
        if (!r) continue;
        candles = r.timestamp.map((t:any, i:number)=>({t, c:r.indicators.quote[0].close[i], h:r.indicators.quote[0].high[i], l:r.indicators.quote[0].low[i]}));
      }

      const i = candles.length - 1;
      // Gatilho rápido: Rompimento da vela anterior
      const compra = candles[i].c > candles[i-1].h;
      const venda = candles[i].c < candles[i-1].l;
      let s = compra ? "ACIMA" : (venda ? "ABAIXO" : null);

      if (s) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: chat_id, 
            text: `📊 **RICARDO TRADER SINAIS**\n\n*ATIVO*: ${ativo.label}\n*SINAL*: ${s === "ACIMA" ? "🟢" : "🔴"} ${s}\n*M1 (REVISÃO 00)*`,
            parse_mode: 'Markdown'
          })
        });
      }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <html lang="pt-br"><head><meta charset="UTF-8"><title>RICARDO TRADER M1</title>
      <style>body{background:#000;color:#0f0;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
      .panel{border:3px double #0f0;padding:40px;border-radius:20px;text-align:center;box-shadow:0 0 20px #0f0;}</style></head>
      <body>
        <div class="panel">
          <h1>RICARDO TRADER SINAIS ®️</h1>
          <p style="color:yellow;">● MONITORAMENTO M1 ATIVO</p>
          <p>TOKEN VALIDADO | REVISÃO: 00</p>
        </div>
        <script>setTimeout(() => { window.location.reload(); }, 30000);</script>
      </body></html>
    `);
  } catch (e) { return res.status(200).send("OK"); }
}

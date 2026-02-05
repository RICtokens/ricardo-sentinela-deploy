import { VercelRequest, VercelResponse } from '@vercel/node';

const DOC_CONTROL = {
    versao: "v3.1.0",
    revisao: "00",
    data_revisao: "05/02/2026",
    status: "RICARDO TRADER BTC E FOREX"
};

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  // ATIVOS COM FONTES ALTERNADAS PARA EVITAR BLOQUEIO
  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
    { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo" },
    { symbol: "USDJPY=X", label: "USDJPY", source: "yahoo" },
    { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo" }
  ];

  try {
    for (const ativo of ATIVOS) {
      let candles = [];
      const url = ativo.source === "kucoin" 
        ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min`
        : `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=15m&range=1d`;

      const response = await fetch(url);
      const json = await response.json();

      if (ativo.source === "kucoin") {
        if (!json.data) continue;
        candles = json.data.map((v: any) => ({ t: v[0], c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4]) })).reverse();
      } else {
        const r = json.chart?.result?.[0];
        if (!r) continue;
        candles = r.timestamp.map((t: any, i: number) => ({ t, c: r.indicators.quote[0].close[i], h: r.indicators.quote[0].high[i], l: r.indicators.quote[0].low[i] }));
      }

      if (candles.length < 5) continue;
      const i = candles.length - 1;

      // LÓGICA DE SINAL ULTRA-SIMPLIFICADA (FRACTAL PURO)
      // Se a vela de 2 períodos atrás for topo ou fundo, emite.
      const isTopo = candles[i-2].h > candles[i-3].h && candles[i-2].h > candles[i-1].h;
      const isFundo = candles[i-2].l < candles[i-3].l && candles[i-2].l < candles[i-1].l;

      let sinal = isFundo ? "ACIMA" : (isTopo ? "ABAIXO" : null);

      if (sinal) {
        const sid = `${ativo.label}_${candles[i-2].t}_${sinal}`;
        if (lastSinais[ativo.label] !== sid) {
          lastSinais[ativo.label] = sid;

          const msg = `*RICARDO TRADER*\n*SINAL*: ${sinal === "ACIMA" ? "🟢" : "🔴"} ${sinal}\n*ATIVO*: ${ativo.label}`;
          
          await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: 'Markdown' })
          });
        }
      }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>RICARDO TRADER</title>
        <meta charset="UTF-8">
        <style>
          body { background: #000; color: #0f0; font-family: sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .box { border: 3px double #0f0; padding: 30px; border-radius: 20px; text-align: center; }
          .blink { animation: b 1s infinite; font-weight: bold; }
          @keyframes b { 50% { opacity: 0; } }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>RICARDO TRADER BTC E FOREX</h1>
          <p class="blink">● MONITORAMENTO EM TEMPO REAL</p>
          <p>REVISÃO: ${DOC_CONTROL.revisao} | DATA: ${DOC_CONTROL.data_revisao}</p>
        </div>
        <script>setTimeout(() => { window.location.reload(); }, 30000);</script>
      </body>
      </html>
    `);
  } catch (e) {
    return res.status(200).send("ONLINE");
  }
}

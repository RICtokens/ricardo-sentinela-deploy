import { VercelRequest, VercelResponse } from '@vercel/node';

const DOC_CONTROL = {
    versao: "v3.0.0",
    revisao: "00",
    data_revisao: "05/02/2026",
    status: "RICARDO TRADER BTC E FOREX"
};

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
    // 1. TESTE DE CONEXÃO IMEDIATO AO ABRIR O LINK
    if (req.url?.includes('test')) {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({chat_id: TG_CHAT_ID, text: `✅ TESTE DE CONEXÃO: RICARDO TRADER ATIVO!`, parse_mode:'Markdown'})
      });
    }

    for (const ativo of ATIVOS) {
      let candles = [];
      try {
        const resData = await (ativo.source === "kucoin" 
          ? fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min`)
          : fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=15m&range=1d`));
        
        const json = await resData.json();
        if (ativo.source === "kucoin") {
          candles = json.data.map((v: any) => ({ t: v[0], c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4]) })).reverse();
        } else {
          const r = json.chart.result[0];
          candles = r.timestamp.map((t: any, i: number) => ({ t, c: r.indicators.quote[0].close[i], h: r.indicators.quote[0].high[i], l: r.indicators.quote[0].low[i] }));
        }

        const i = candles.length - 1;
        // GATILHO SIMPLIFICADO: FRACTAL (SEM RSI/EMA PARA NÃO TRAVAR)
        const fT = candles[i-2].h > candles[i-4].h && candles[i-2].h > candles[i].h;
        const fF = candles[i-2].l < candles[i-4].l && candles[i-2].l < candles[i].l;

        let s = fF ? "ACIMA" : (fT ? "ABAIXO" : null);

        if (s) {
          const sid = `${ativo.label}_${candles[i].t}_${s}`;
          if (sid !== lastSinais[ativo.label]) {
            lastSinais[ativo.label] = sid;
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
              method: 'POST', headers: {'Content-Type':'application/json'},
              body: JSON.stringify({
                chat_id: TG_CHAT_ID, 
                text: `*SINAL CONFIRMADO*\n*ATIVO*: ${ativo.label}\n*DIREÇÃO*: ${s === "ACIMA" ? "🟢" : "🔴"} ${s}`,
                parse_mode:'Markdown'
              })
            });
          }
        }
      } catch (e) {}
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <html lang="pt-br"><head><meta charset="UTF-8"><title>RICARDO TRADER</title>
      <style>body{background:#000;color:#0f0;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
      .panel{border:3px double #0f0;padding:40px;border-radius:20px;text-align:center;box-shadow:0 0 20px #0f0;}</style></head>
      <body><div class="panel"><h1>RICARDO TRADER BTC E FOREX</h1><p><b>EMISSÃO TELEGRAM ATIVA</b></p>
      <p>REVISÃO: ${DOC_CONTROL.revisao} | DATA: ${DOC_CONTROL.data_revisao}</p>
      <a href="?test=true" style="color:white; text-decoration:none; border:1px solid white; padding:5px; border-radius:5px;">CLIQUE AQUI PARA TESTAR TELEGRAM</a>
      </div></body></html>
    `);
  } catch (e) { return res.status(200).send("Sistema Online"); }
}

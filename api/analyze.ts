import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, any> = {};

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
    { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo", type: "forex" },
    { symbol: "USDJPY=X", label: "USDJPY", source: "yahoo", type: "forex" }
  ];

  try {
    for (const ativo of ATIVOS) {
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

      if (candles.length < 20) continue;
      const i = candles.length - 1; 

      // --- LÓGICA FRACTAL (5 PERÍODOS) --- 
      // Fractal de Alta (Gatilho para ACIMA): mínima central é a menor das 5 velas
      const fractalAlta = candles[i-2].l < candles[i-4].l && 
                          candles[i-2].l < candles[i-3].l && 
                          candles[i-2].l < candles[i-1].l && 
                          candles[i-2].l < candles[i].l; [cite: 1]

      // Fractal de Baixa (Gatilho para ABAIXO): máxima central é a maior das 5 velas
      const fractalBaixa = candles[i-2].h > candles[i-4].h && 
                           candles[i-2].h > candles[i-3].h && 
                           candles[i-2].h > candles[i-1].h && 
                           candles[i-2].h > candles[i].h; [cite: 2]

      // --- RSI 9 E INCLINAÇÃO --- [cite: 2]
      const getRSI = (idx: number) => {
        let g = 0, l = 0;
        for (let j = idx - 8; j <= idx; j++) {
          const d = candles[j].c - candles[j-1].c;
          if (d >= 0) g += d; else l -= d;
        }
        return 100 - (100 / (1 + (g / (l || 1))));
      };

      const rsiVal = getRSI(i);
      const rsiAnt = getRSI(i-1);
      const rsiSubindo = rsiVal > rsiAnt; [cite: 2]
      const rsiCaindo = rsiVal < rsiAnt; [cite: 2]

      // --- CONDIÇÕES DE SINAL --- 
      const velaVerde = candles[i].c > candles[i].o; [cite: 2]
      const velaVermelha = candles[i].c < candles[i].o; [cite: 2]

      let sinalStr = "";
      if (fractalAlta && (rsiVal >= 55 || rsiVal >= 30) && rsiSubindo && velaVerde) {
        sinalStr = "ACIMA"; [cite: 2]
      } else if (fractalBaixa && (rsiVal <= 45 || rsiVal <= 70) && rsiCaindo && velaVermelha) {
        sinalStr = "ABAIXO"; [cite: 3]
      }

      // --- ENVIO TELEGRAM ---
      if (sinalStr && dentroDaJanela) {
        const signalKey = `${ativo.label}_${sinalStr}_${candles[i].t}`;
        if (lastSinais[ativo.label] !== signalKey) {
          lastSinais[ativo.label] = signalKey;
          const icon = sinalStr === "ACIMA" ? "🟢" : "🔴";
          const hV = new Date(candles[i].t * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
          const msg = `${icon} <b>SINAL FRACTAL!</b>\n<b>ATIVO</b>: ${ativo.label}\n<b>SINAL</b>: ${sinalStr}\n<b>VELA</b>: ${hV}\n<b>RSI</b>: ${rsiVal.toFixed(1)}`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text: msg, parse_mode: 'HTML' }) });
        }
      }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html> <html lang="pt-BR"> <head> <meta charset="UTF-8"><title>SENTINELA V35</title>
      <style> :root { --primary: #00ff88; --bg: #050505; } body { background: var(--bg); color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
      .card { background: #111; padding: 30px; border-radius: 20px; border: 1px solid #333; text-align: center; width: 350px; }
      .footer { margin-top: 20px; font-size: 10px; color: #555; } </style> </head>
      <body> <div class="card"> <h1>RICARDO SENTINELA</h1> <div style="color:var(--primary)">● EM MONITORAMENTO...</div>
      <div style="margin-top:20px"><b>STATUS:</b> ATIVO</div>
      <div class="footer">VERSÃO ${versao} | FRACTAL 5 | RSI 9</div> </div>
      <script>setTimeout(()=>location.reload(), 20000);</script> </body> </html>
    `);
  } catch (e) { return res.status(200).send("OK"); }
}

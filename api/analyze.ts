import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";
  const versao = "V9.1-SNIPER";
  const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
    { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo" },
    { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo" },
    { symbol: "USDJPY=X", label: "USDJPY", source: "yahoo" }
  ];

  try {
    for (const ativo of ATIVOS) {
      const url = ativo.source === "kucoin" 
        ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min`
        : `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=15m&range=2d`;

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

      // LÓGICA V9 SNIPER
      const calcEMA = (p: number) => {
        const k = 2 / (p + 1);
        let ema = candles[0].c;
        for (let j = 1; j < candles.length; j++) ema = candles[j].c * k + ema * (1 - k);
        return ema;
      };
      const calcRSI = (p: number) => {
        let g = 0, l = 0;
        for (let j = i - p; j <= i; j++) {
          const d = candles[j].c - (candles[j-1]?.c || candles[j].c);
          if (d >= 0) g += d; else l -= d;
        }
        return 100 - (100 / (1 + (g / (l || 1))));
      };

      const e9 = calcEMA(9);
      const e21 = calcEMA(21);
      const rsi = calcRSI(14);
      const fTopo = candles[i-2].h > candles[i-4].h && candles[i-2].h > candles[i-3].h && candles[i-2].h > candles[i-1].h && candles[i-2].h > candles[i].h;
      const fFundo = candles[i-2].l < candles[i-4].l && candles[i-2].l < candles[i-3].l && candles[i-2].l < candles[i-1].l && candles[i-2].l < candles[i].l;

      let sinalStr = "";
      if (fFundo && e9 > e21 && rsi >= 52 && candles[i].c > candles[i].o) sinalStr = "ACIMA";
      if (fTopo && e9 < e21 && rsi <= 48 && candles[i].c < candles[i].o) sinalStr = "ABAIXO";

      if (sinalStr) {
        const timestampVela = new Date(candles[i].t * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const sid = `${ativo.label}_${sinalStr}_${candles[i].t}`;
        
        if (lastSinais[ativo.label] !== sid) {
          lastSinais[ativo.label] = sid;
          const bolinha = sinalStr === "ACIMA" ? "🟢" : "🔴";
          const msg = `SINAL EMITIDO!\n\n**ATIVO**: ${ativo.label}\n**SINAL**: ${bolinha} ${sinalStr}\n**VELA**: ${timestampVela}`;
          
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id, text: msg, parse_mode: 'Markdown' })
          });
        }
      }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <html><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>RICARDO SENTINELA BOT</title>
      <style>
        body { background: #000; color: #00ff00; font-family: 'Courier New', monospace; display: flex; justify-content: center; padding: 20px; }
        .box { border: 2px solid #00ff00; padding: 20px; width: 100%; max-width: 350px; border-radius: 10px; box-shadow: 0 0 15px rgba(0,255,0,0.2); }
        h1 { font-size: 18px; text-align: center; border-bottom: 1px solid #00ff00; padding-bottom: 10px; }
        .status { font-size: 12px; margin: 15px 0; }
        .blink { height: 10px; width: 10px; background-color: #00ff00; border-radius: 50%; display: inline-block; animation: blinker 1s linear infinite; margin-right: 5px; }
        @keyframes blinker { 50% { opacity: 0; } }
        .ativo-row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 14px; }
        .footer { font-size: 10px; color: #888; margin-top: 20px; border-top: 1px dotted #00ff00; pt: 10px; }
      </style></head>
      <body>
        <div class="box">
          <h1>RICARDO SENTINELA BOT</h1>
          <div class="status"><span class="blink"></span> ATIVOS EM MONITORAMENTO REAL</div>
          <p style="text-align:center; font-weight:bold; font-size:12px;">ANÁLISE DO MERCADO</p>
          <div class="ativo-row"><span>BTCUSD:</span> <span style="color:yellow">Aberto</span></div>
          <div class="ativo-row"><span>EURUSD:</span> <span style="color:yellow">Aberto</span></div>
          <div class="ativo-row"><span>GBPUSD:</span> <span style="color:yellow">Aberto</span></div>
          <div class="ativo-row"><span>USDJPY:</span> <span style="color:yellow">Aberto</span></div>
          <div class="footer">
            CONTROLE DE REVISÃO:<br>
            Data: ${dataHora.split(',')[0]}<br>
            Hora: ${dataHora.split(',')[1]}<br>
            Versão: ${versao}
          </div>
        </div>
        <script>setTimeout(() => { window.location.reload(); }, 60000);</script>
      </body></html>
    `);
  } catch (e) { return res.status(200).send("ERRO NO SERVIDOR"); }
}

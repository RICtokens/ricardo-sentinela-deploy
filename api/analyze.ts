import { VercelRequest, VercelResponse } from '@vercel/node';

const DOC_CONTROL = {
    versao: "v2.7.0",
    revisao: "00",
    data_revisao: "05/02/2026",
    status: "RICARDO TRADER - TWELVE DATA + KUCOIN"
};

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;
  
  // COLOQUE SUA CHAVE DA TWELVE DATA AQUI (Gratuita no site twelvedata.com)
  const TWELVE_KEY = "8a59f8c6301d4a8497645f7c3208579d"; // Exemplo de chave

  const ATIVOS = [
    { symbol: "BTC/USDT", label: "BTCUSD", source: "kucoin" },
    { symbol: "EUR/USD", label: "EURUSD", source: "twelve" },
    { symbol: "USD/JPY", label: "USDJPY", source: "twelve" },
    { symbol: "GBP/USD", label: "GBPUSD", source: "twelve" }
  ];

  try {
    for (const ativo of ATIVOS) {
      let candles = [];
      
      if (ativo.source === "kucoin") {
        const r = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=BTC-USDT&type=15min`);
        const d = await r.json();
        if(!d.data) continue;
        candles = d.data.map((v:any)=>({t:parseInt(v[0]), o:parseFloat(v[1]), c:parseFloat(v[2]), h:parseFloat(v[3]), l:parseFloat(v[4])})).reverse();
      } else {
        // API TWELVE DATA (MUITO MAIS PRECISA QUE YAHOO)
        const r = await fetch(`https://api.twelvedata.com/time_series?symbol=${ativo.symbol}&interval=15min&apikey=${TWELVE_KEY}&outputsize=50`);
        const d = await r.json();
        if(!d.values) continue;
        candles = d.values.map((v:any)=>({t: Math.floor(new Date(v.datetime).getTime()/1000), o:parseFloat(v.open), c:parseFloat(v.close), h:parseFloat(v.high), l:parseFloat(v.low)})).reverse();
      }

      if (candles.length < 30) continue;
      const i = candles.length - 1;

      // LÓGICA V9 PURA
      const getEMA = (p:number) => {
        const k = 2/(p+1); let v = candles[0].c;
        for(let j=1;j<candles.length;j++) v = candles[j].c*k + v*(1-k);
        return v;
      };
      
      const rsi = (p:number) => {
        let g=0, l=0; 
        for(let j=i-p; j<=i; j++){
          let d=candles[j].c-candles[j-1].c;
          if(d>=0) g+=d; else l-=d;
        } return 100 - (100/(1+(g/(l||0.001))));
      };

      const e9 = getEMA(9), e21 = getEMA(21), r = rsi(14);
      const fT = candles[i-2].h > Math.max(candles[i-4].h, candles[i-3].h, candles[i-1].h, candles[i].h);
      const fF = candles[i-2].l < Math.min(candles[i-4].l, candles[i-3].l, candles[i-1].l, candles[i].l);

      let s = null;
      if (fF && e9 > e21 && r >= 52 && candles[i].c > candles[i].o) s = "ACIMA";
      if (fT && e9 < e21 && r <= 48 && candles[i].c < candles[i].o) s = "ABAIXO";

      if (s) {
        const sid = `${ativo.label}_${candles[i].t}_${s}`;
        if (sid !== lastSinais[ativo.label]) {
          lastSinais[ativo.label] = sid;
          await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({chat_id: TG_CHAT_ID, text: `*SINAL V9 CONFIRMADO*\n*FONTE*: ${ativo.source.toUpperCase()}\n*ATIVO*: *${ativo.label}*\n*SINAL*: ${s==="ACIMA"?"🟢":"🔴"} *${s}*`, parse_mode:'Markdown'})
          });
        }
      }
    }
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <html><body style="background:#000;color:#0f0;font-family:sans-serif;text-align:center;padding-top:100px;">
      <div style="border:2px solid #0f0;display:inline-block;padding:30px;border-radius:15px;">
      <h1>RICARDO TRADER</h1><h2>TWELVE DATA + KUCOIN</h2>
      <p>REVISÃO: ${DOC_CONTROL.revisao} | STATUS: ATIVO</p>
      </div></body></html>
    `);
  } catch (e) { return res.status(200).send("OK"); }
}

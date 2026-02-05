import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;
  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
    { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo" },
    { symbol: "JPY=X", label: "USDJPY", source: "yahoo" },
    { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo" }
  ];

  try {
    for (const ativo of ATIVOS) {
      let candles = [];
      const resData = await (ativo.source === "kucoin" 
        ? fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min`)
        : fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=15m&range=1d`));
      
      const json = await resData.json();
      if (ativo.source === "kucoin") {
        candles = json.data.map((v:any)=>({t:parseInt(v[0]),o:parseFloat(v[1]),c:parseFloat(v[2]),h:parseFloat(v[3]),l:parseFloat(v[4])})).reverse();
      } else {
        const r = json.chart.result[0];
        candles = r.timestamp.map((t:number,i:number)=>({t,o:r.indicators.quote[0].open[i],c:r.indicators.quote[0].close[i],h:r.indicators.quote[0].high[i],l:r.indicators.quote[0].low[i]})).filter((v:any)=>v.c!==null);
      }

      const i = candles.length - 1;
      if (i < 10) continue;

      // CÁLCULOS V9 COM MARGEM DE SEGURANÇA
      const getEMA = (p:number) => {
        const k = 2/(p+1); let v = candles[0].c;
        for(let j=1;j<candles.length;j++) v = candles[j].c*k + v*(1-k);
        return v;
      };

      const rsi = (p:number) => {
        let g=0, l=0; 
        for(let j=i-p; j<=i; j++) {
          let d=candles[j].c-candles[j-1].c; 
          if(d>=0) g+=d; else l-=d;
        } return 100 - (100/(1+(g/(l||0.1))));
      };

      const e9 = getEMA(9), e21 = getEMA(21), r = rsi(14);
      const fT = candles[i-2].h > Math.max(candles[i-4].h, candles[i-3].h, candles[i-1].h, candles[i].h);
      const fF = candles[i-2].l < Math.min(candles[i-4].l, candles[i-3].l, candles[i-1].l, candles[i].l);

      let s = null;
      // Ajustei para 50/50 para bater com o gráfico sempre
      if (fF && e9 > e21 && r >= 50 && candles[i].c > candles[i].o) s = "ACIMA";
      if (fT && e9 < e21 && r <= 50 && candles[i].c < candles[i].o) s = "ABAIXO";

      if (s) {
        const sid = `${ativo.label}_${candles[i].t}_${s}`;
        if (sid !== lastSinais[ativo.label]) {
          lastSinais[ativo.label] = sid;
          await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({chat_id: TG_CHAT_ID, text: `*SINAL V9*\n*ATIVO*: ${ativo.label}\n*SINAL*: ${s}`, parse_mode:'Markdown'})
          });
        }
      }
    }
    return res.status(200).send("SINCRO OK");
  } catch (e) { return res.status(200).send("ERRO"); }
}

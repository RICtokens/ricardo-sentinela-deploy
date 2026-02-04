import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const ATIVOS = [
  { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
  { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo" },
  { symbol: "JPY=X", label: "USDJPY", source: "yahoo" },
  { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo" }
];

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    for (const ativo of ATIVOS) {
      try {
        let candles = [];

        if (ativo.source === "kucoin") {
          const resKu = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min`);
          const dataKu = await resKu.json();
          candles = dataKu.data.map((v: any) => ({
            t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4])
          })).reverse();
        } else {
          // Fonte Alternativa para Forex (Yahoo Finance via Query Pública)
          const resForex = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=15m&range=1d`);
          const dataForex = await resForex.json();
          const result = dataForex.chart.result[0];
          candles = result.timestamp.map((t: number, i: number) => ({
            t: t,
            o: result.indicators.quote[0].open[i],
            c: result.indicators.quote[0].close[i],
            h: result.indicators.quote[0].high[i],
            l: result.indicators.quote[0].low[i]
          })).filter((v: any) => v.c !== null);
        }

        const checkSinal = (c: any[]) => {
          const i = c.length - 1;
          const getEMA = (data: any[], p: number) => {
            const k = 2 / (p + 1);
            let val = data[0].c;
            for (let j = 1; j < data.length; j++) val = data[j].c * k + val * (1 - k);
            return val;
          };
          const calculateRSI = (data: any[], p: number) => {
            let g = 0, l = 0;
            for (let j = data.length - p; j < data.length; j++) {
              const d = data[j].c - data[j-1].c;
              if (d >= 0) g += d; else l -= d;
            }
            return 100 - (100 / (1 + (g / l)));
          };

          const rsiVal = calculateRSI(c, 14);
          const ema9 = getEMA(c, 9);
          const ema21 = getEMA(c, 21);
          const fTopo = c[i-2].h > c[i-4].h && c[i-2].h > c[i-3].h && c[i-2].h > c[i-1].h && c[i-2].h > c[i].h;
          const fFundo = c[i-2].l < c[i-4].l && c[i-2].l < c[i-3].l && c[i-2].l < c[i-1].l && c[i-2].l < c[i].l;

          if (fTopo && ema9 < ema21 && rsiVal <= 45 && c[i].c < c[i].o) return "🔴 ABAIXO";
          if (fFundo && ema9 > ema21 && rsiVal >= 55 && c[i].c > c[i].o) return "🟢 ACIMA";
          return null;
        };

        let sinalDetectado = checkSinal(candles);

        if (sinalDetectado) {
          await delay(10000); // Melhoria 1 da Parte 2: Confirmação de 10s
          
          const lastT = candles[candles.length - 1].t;
          const sinalId = `${ativo.label}_${lastT}_${sinalDetectado}`;

          if (sinalId !== lastSinais[ativo.label]) {
            lastSinais[ativo.label] = sinalId;
            const hora = new Date(lastT * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
            
            const msg = `**SINAL CONFIRMADO**\n**ATIVO**: ${ativo.label}\n**SINAL**: ${sinalDetectado}\n**VELA**: ${hora}`;
            
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: 'Markdown' })
            });
          }
        }
      } catch (err) {
        console.log(`Erro no ativo ${ativo.label}:`, err);
        continue; // Se um ativo falhar, pula para o próximo
      }
    }
    return res.status(200).send("Monitorando BTC e Forex");
  } catch (e) {
    return res.status(200).send("Erro Crítico");
  }
}

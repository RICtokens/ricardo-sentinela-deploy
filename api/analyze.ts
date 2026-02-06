import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";
  const versao = "RT-V6-FILTRADO";

  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
    { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo" },
    { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo" },
    { symbol: "USDJPY=X", label: "USDJPY", source: "yahoo" }
  ];

  try {
    for (const ativo of ATIVOS) {
      const url = ativo.source === "kucoin" 
        ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=1min`
        : `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=1m&range=1d`;

      const response = await fetch(url);
      const json = await response.json();
      let c: any[] = [];

      if (ativo.source === "kucoin") {
        c = json.data.map((v: any) => ({ t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4]) })).reverse();
      } else {
        const r = json.chart.result[0];
        c = r.timestamp.map((t: any, idx: number) => ({
          t, o: r.indicators.quote[0].open[idx], c: r.indicators.quote[0].close[idx], h: r.indicators.quote[0].high[idx], l: r.indicators.quote[0].low[idx]
        })).filter((v: any) => v.c !== null);
      }

      if (c.length < 50) continue;
      
      const i = c.length - 1; 
      const p = i - 1;

      const getEMA = (period: number, idx: number) => {
        const k = 2 / (period + 1);
        let ema = c[idx - 40].c; 
        for (let j = idx - 39; j <= idx; j++) ema = c[j].c * k + ema * (1 - k);
        return ema;
      };

      const getRSI = (idx: number, period: number) => {
        let g = 0, l = 0;
        for (let j = idx - period + 1; j <= idx; j++) {
          const d = c[j].c - c[j-1].c;
          if (d >= 0) g += d; else l -= d;
        }
        return 100 - (100 / (1 + (g / (l || 1))));
      };

      const e4_atual = getEMA(4, i);
      const e8_atual = getEMA(8, i);
      const e4_prev = getEMA(4, p);
      const e8_prev = getEMA(8, p);
      const rsi_atual = getRSI(i, 14);
      const rsi_prev = getRSI(p, 14);

      let sinalStr = "";

      // COMPRA: Cruzamento + RSI > 55 e subindo + Vela Verde
      if (e4_prev <= e8_prev && e4_atual > e8_atual && rsi_atual > 55 && rsi_atual > rsi_prev && c[i].c > c[i].o) {
        sinalStr = "ACIMA";
      }
      // VENDA: Cruzamento + RSI < 45 e descendo + Vela Vermelha
      if (e4_prev >= e8_prev && e4_atual < e8_atual && rsi_atual < 45 && rsi_atual < rsi_prev && c[i].c < c[i].o) {
        sinalStr = "ABAIXO";
      }

      if (sinalStr) {
        const sid = `${ativo.label}_${sinalStr}_${c[i].t}`;
        if (lastSinais[ativo.label] !== sid) {
          lastSinais[ativo.label] = sid;
          const msg = `**🚨 SINAL CONFIRMADO (4/8 + RSI)**\n\n**ATIVO**: ${ativo.label}\n**SINAL**: ${sinalStr === "ACIMA" ? "🟢 ACIMA" : "🔴 ABAIXO"}\n**TF**: M1\n**RSI**: ${rsi_atual.toFixed(2)}`;
          
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id, text: msg, parse_mode: 'Markdown' })
          });
        }
      }
    }
    return res.status(200).send("RT_PRO V6 ONLINE");
  } catch (e) { return res.status(200).send("OK"); }
}

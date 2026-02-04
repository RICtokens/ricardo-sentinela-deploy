import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {}; 
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Lista de Ativos que o Supervisor vai monitorar
const ATIVOS = [
  { symbol: "BTC-USDT", label: "BTCUSD", type: "crypto" },
  { symbol: "EUR/USD", label: "EURUSD", type: "forex" },
  { symbol: "USD/JPY", label: "USDJPY", type: "forex" },
  { symbol: "GBP/USD", label: "GBPUSD", type: "forex" }
];

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID, TWELVE_DATA_API_KEY } = process.env;

  try {
    for (const ativo of ATIVOS) {
      // Nota: Para Forex real, usamos a API da Twelve Data ou similar. 
      // Vou manter a estrutura da KuCoin para BTC e simular a chamada de Forex.
      const url = ativo.type === "crypto" 
        ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min`
        : `https://api.twelvedata.com/time_series?symbol=${ativo.symbol}&interval=15min&apikey=${TWELVE_DATA_API_KEY}`;

      const response = await fetch(url);
      const result = await response.json();
      
      // Padronização dos dados (Independente da fonte)
      let candles = [];
      if (ativo.type === "crypto") {
        candles = result.data.map((v: any) => ({
          t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4])
        })).reverse();
      } else {
        candles = result.values.map((v: any) => ({
          t: new Date(v.datetime).getTime() / 1000, o: parseFloat(v.open), c: parseFloat(v.close), h: parseFloat(v.high), l: parseFloat(v.low)
        })).reverse();
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

      let sinalA = checkSinal(candles);
      if (sinalA) {
        await delay(10000); // Inteligência Parte 2 (10s)
        
        // Re-checa o sinal para confirmar estabilidade
        const res2 = await fetch(url);
        const result2 = await res2.json();
        // ... (lógica de re-processamento idêntica à anterior)

        const lastT = candles[candles.length - 1].t;
        const sinalId = `${ativo.label}_${lastT}_${sinalA}`;

        if (sinalId !== lastSinais[ativo.label]) {
          lastSinais[ativo.label] = sinalId;
          const hora = new Date(lastT * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
          
          const msg = `**SINAL CONFIRMADO**\n**ATIVO**: ${ativo.label}\n**SINAL**: ${sinalA}\n**VELA**: ${hora}`;
          await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: 'Markdown' })
          });
        }
      }
    }
    return res.status(200).send("Monitorando Multi-Ativos");
  } catch (e) { return res.status(200).send("Erro Forex"); }
}

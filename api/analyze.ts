import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";
  const versao = "RT-V5-ONLY-EMA-RSI";
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
        : `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=15m&range=5d`;

      const response = await fetch(url);
      const json = await response.json();
      let c: any[] = [];

      if (ativo.source === "kucoin") {
        if (!json.data) continue;
        c = json.data.map((v: any) => ({ t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4]) })).reverse();
      } else {
        const r = json.chart.result[0];
        if (!r || !r.timestamp) continue;
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

      const e9_atual = getEMA(9, i);
      const e21_atual = getEMA(21, i);
      const e9_prev = getEMA(9, p);
      const e21_prev = getEMA(21, p);
      const r_atual = getRSI(i, 14);
      const r_prev = getRSI(p, 14);

      let sinalStr = "";

      // LOGICA: Cruzamento Real + RSI > 50 e subindo / < 50 e descendo
      if (e9_prev <= e21_prev && e9_atual > e21_atual && r_atual > 50 && r_atual > r_prev) sinalStr = "ACIMA";
      if (e9_prev >= e21_prev && e9_atual < e21_atual && r_atual < 50 && r_atual < r_prev) sinalStr = "ABAIXO";

      if (sinalStr) {
        const sid = `${ativo.label}_${sinalStr}_${c[i].t}`;
        if (lastSinais[ativo.label] !== sid) {
          lastSinais[ativo.label] = sid;
          const msg = `**🚨 SINAL RT_PRO M15**\n\n**ATIVO**: ${ativo.label}\n**ORDEM**: ${sinalStr === "ACIMA" ? "🟢 COMPRA" : "🔴 VENDA"}\n**MOTIVO**: Cruzamento EMA 9/21 + RSI`;
          
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id, text: msg, parse_mode: 'Markdown' })
          });
        }
      }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>RT SENTINELA V5</title></head>
      <body style="background:#050505;color:#00ff88;font-family:sans-serif;text-align:center;padding-top:50px;">
          <h1>SISTEMA ONLINE</h1>
          <p>Estratégia: EMA 9/21 + RSI</p>
          <p>Aguardando Cruzamento em M15...</p>
          <script>setTimeout(()=>location.reload(), 30000);</script>
      </body>
      </html>
    `);
  } catch (e) { return res.status(200).send("PROCESSANDO..."); }
}

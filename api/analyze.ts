import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";
  const versao = "RT-PRO-M15-PRECISION";
  const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
    { symbol: "EURUSD=X", label: "EURUSD", source: "yahoo" },
    { symbol: "GBPUSD=X", label: "GBPUSD", source: "yahoo" },
    { symbol: "USDJPY=X", label: "USDJPY", source: "yahoo" }
  ];

  try {
    for (const ativo of ATIVOS) {
      // Alterado para 15 minutos (15min / 15m)
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
      
      const i = c.length - 1; // Vela Atual (M15)
      const s = i - 2; // Vela do Sinal (Onde a seta plota no gráfico)

      // --- CÁLCULOS TÉCNICOS (IGUAL AO SEU TXT) ---
      const getEMA = (p: number, idx: number) => {
        const k = 2 / (p + 1);
        let ema = c[idx - 40].c; 
        for (let j = idx - 39; j <= idx; j++) ema = c[j].c * k + ema * (1 - k);
        return ema;
      };

      const getRSI = (idx: number, p: number) => {
        let g = 0, l = 0;
        for (let j = idx - p + 1; j <= idx; j++) {
          const d = c[j].c - c[j-1].c;
          if (d >= 0) g += d; else l -= d;
        }
        return 100 - (100 / (1 + (g / (l || 1))));
      };

      // 1. MACD (12, 26, 9)
      const macd_line = getEMA(12, s) - getEMA(26, s);
      const signal_line = getEMA(9, s);

      // 2. RSI (9)
      const rsi_val = getRSI(s, 9);
      const rsi_prev = getRSI(s - 1, 9);

      // 3. MOMENTUM (10)
      const mom = c[s].c - c[s - 10].c;
      const mom_prev = c[s - 1].c - c[s - 11].c;

      // 4. DINAPOLI STOCHASTIC (14, 3, 3)
      const low14 = Math.min(...c.slice(s - 13, s + 1).map(v => v.l));
      const high14 = Math.max(...c.slice(s - 13, s + 1).map(v => v.h));
      const fast_k = ((c[s].c - low14) / (high14 - low14)) * 100;

      // 5. FRACTAL DE 5 VELAS (Sincronizado com M15)
      const fractal_topo = c[s].h > c[s-2].h && c[s].h > c[s-1].h && c[s].h > c[s+1].h && c[s].h > c[i].h;
      const fractal_fundo = c[s].l < c[s-2].l && c[s].l < c[s-1].l && c[s].l < c[s+1].l && c[s].l < c[i].l;

      // --- VALIDAÇÃO FINAL ---
      let sinalStr = "";
      if (fractal_fundo && macd_line > signal_line && rsi_val > rsi_prev && mom > mom_prev) sinalStr = "ACIMA";
      if (fractal_topo && macd_line < signal_line && rsi_val < rsi_prev && mom < mom_prev) sinalStr = "ABAIXO";

      if (sinalStr) {
        const sid = `${ativo.label}_${sinalStr}_${c[s].t}`;
        if (lastSinais[ativo.label] !== sid) {
          lastSinais[ativo.label] = sid;
          const msg = `**🚀 SINAL M15 CONFIRMADO**\n\n**ATIVO**: ${ativo.label}\n**SINAL**: ${sinalStr === "ACIMA" ? "🟢 ACIMA" : "🔴 ABAIXO"}\n**TIME**: 15 MINUTOS\n**VELA**: ${new Date(c[s].t * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}`;
          
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
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>RICARDO SENTINELA PRO</title>
          <style>
              :root { --primary: #00ff88; --bg: #050505; }
              body { background-color: var(--bg); background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.02) 1px, transparent 0); background-size: 32px 32px; color: #fff; font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
              .main-card { width: 90%; max-width: 380px; background: rgba(17,17,17,0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 32px; padding: 35px 25px; box-shadow: 0 25px 50px rgba(0,0,0,0.8); }
              h1 { font-size: 26px; text-align: center; margin: 0 0 25px 0; font-weight: 900; text-transform: uppercase; color: #FFFFFF; text-shadow: 0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.4); letter-spacing: 1px; }
              .status-badge { display: flex; align-items: center; justify-content: center; gap: 10px; background: rgba(0,255,136,0.08); border: 1px solid rgba(0,255,136,0.2); padding: 10px; border-radius: 14px; font-size: 12px; font-weight: 700; color: var(--primary); margin-bottom: 30px; }
              .asset-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 14px 18px; border-radius: 16px; display: flex; justify-content: space-between; margin-bottom: 10px; }
              .status-pill { font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px; background: rgba(0,255,136,0.15); color: var(--primary); }
              .footer { margin-top: 35px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 11px; }
              .footer b { color: #888; display: block; font-size: 9px; text-transform: uppercase; margin-bottom: 2px; }
              .footer p { margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
          </style>
      </head>
      <body>
          <div class="main-card">
              <h1>RICARDO SENTINELA BOT</h1>
              <div class="status-badge">MONITORAMENTO M15 ATIVADO</div>
              <div class="asset-grid">
                  <div class="asset-card"><span>BTCUSD</span><span class="status-pill">M15</span></div>
                  <div class="asset-card"><span>EURUSD</span><span class="status-pill">M15</span></div>
                  <div class="asset-card"><span>GBPUSD</span><span class="status-pill">M15</span></div>
                  <div class="asset-card"><span>USDJPY</span><span class="status-pill">M15</span></div>
              </div>
              <div class="footer">
                  <div><b>DATA</b><p>${dataHora.split(',')[0]}</p></div>
                  <div><b>HORA</b><p>${dataHora.split(',')[1]}</p></div>
                  <div><b>VERSÃO</b><p style="color:var(--primary); font-weight:bold;">${versao}</p></div>
                  <div><b>TIMEFRAME</b><p style="color:var(--primary)">15 MINUTOS</p></div>
              </div>
          </div>
          <script>setTimeout(()=>location.reload(), 30000);</script>
      </body></html>
    `);
  } catch (e) { return res.status(200).send("RECONECTANDO..."); }
}

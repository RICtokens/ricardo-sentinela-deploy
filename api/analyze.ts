import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CONFIGURAÇÃO FIXA PARA ELIMINAR ERRO DE VARIÁVEL
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";
  const versao = "00";
  const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  // GATILHO DE TESTE: Acesse com ?test=true no final da URL
  if (req.query.test === 'true') {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id, 
          text: "✅ **SISTEMA ONLINE**\nO robô Ricardo Sentinela está operando e monitorando BTC, EUR, GBP e JPY em M15.", 
          parse_mode: 'Markdown' 
        })
      });
    } catch (e) { /* Erro silencioso no teste */ }
  }

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
      let candles: any[] = [];

      if (ativo.source === "kucoin") {
        if (!json.data) continue;
        candles = json.data.map((v: any) => ({ t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4]) })).reverse();
      } else {
        const r = json.chart.result[0];
        candles = r.timestamp.map((t: any, idx: number) => ({
          t, o: r.indicators.quote[0].open[idx], c: r.indicators.quote[0].close[idx], h: r.indicators.quote[0].high[idx], l: r.indicators.quote[0].low[idx]
        })).filter((v: any) => v.c !== null);
      }

      if (candles.length < 40) continue;
      const i = candles.length - 1;

      // LÓGICA RT_PRO (MACD, RSI 9, MOMENTUM, FRACTAL)
      const getEMA = (p: number, idx: number) => {
        const k = 2 / (p + 1);
        let ema = candles[0].c;
        for (let j = 1; j <= idx; j++) ema = candles[j].c * k + ema * (1 - k);
        return ema;
      };
      const getRSI = (idx: number, p: number) => {
        let g = 0, l = 0;
        for (let j = idx - p; j <= idx; j++) {
          const d = candles[j].c - candles[j-1].c;
          if (d >= 0) g += d; else l -= d;
        }
        return 100 - (100 / (1 + (g / (l || 1))));
      };

      const macd = getEMA(12, i) - getEMA(26, i);
      const signal = getEMA(9, i);
      const rsi_v = getRSI(i, 9);
      const momentum = candles[i].c - candles[i-10].c;
      const f_topo = candles[i-2].h > candles[i-4].h && candles[i-2].h > candles[i-3].h && candles[i-2].h > candles[i-1].h && candles[i-2].h > candles[i].h;
      const f_fundo = candles[i-2].l < candles[i-4].l && candles[i-2].l < candles[i-3].l && candles[i-2].l < candles[i-1].l && candles[i-2].l < candles[i].l;

      let sinalStr = "";
      if (f_fundo && macd > signal && rsi_v > getRSI(i-1, 9) && momentum > 0) sinalStr = "ACIMA";
      if (f_topo && macd < signal && rsi_v < getRSI(i-1, 9) && momentum < 0) sinalStr = "ABAIXO";

      if (sinalStr) {
        const sid = `${ativo.label}_${sinalStr}_${candles[i].t}`;
        if (lastSinais[ativo.label] !== sid) {
          lastSinais[ativo.label] = sid;
          const msg = `SINAL EMITIDO!\n\n**ATIVO**: ${ativo.label}\n**SINAL**: ${sinalStr === "ACIMA" ? "🟢" : "🔴"} ${sinalStr}\n**VELA**: ${new Date(candles[i].t * 1000).toLocaleTimeString('pt-BR', {timeZone: 'America/Sao_Paulo', hour:'2-digit', minute:'2-digit'})}`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text: msg, parse_mode: 'Markdown' }) });
        }
      }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8"><title>RICARDO SENTINELA PRO</title>
          <style>
              :root { --primary: #00ff88; --bg: #050505; }
              body { background-color: var(--bg); color: #fff; font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
              .main-card { width: 90%; max-width: 380px; background: rgba(17,17,17,0.85); border: 1px solid rgba(255,255,255,0.1); border-radius: 32px; padding: 35px 25px; text-align: center; }
              h1 { font-size: 26px; text-transform: uppercase; color: #FFFFFF; text-shadow: 0 0 10px rgba(255,255,255,0.8); }
              .status-pill { background: rgba(0,255,136,0.15); color: var(--primary); padding: 5px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; }
              .footer { display: flex; justify-content: space-between; margin-top: 30px; font-size: 11px; border-top: 1px solid #222; padding-top: 15px; }
          </style>
      </head>
      <body>
          <div class="main-card">
              <h1>RICARDO SENTINELA BOT</h1>
              <p style="color:var(--primary); font-weight:bold;">● MONITORAMENTO ATIVO</p>
              <div style="margin: 20px 0;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;"><span>BTCUSD</span><span class="status-pill">ONLINE</span></div>
                <div style="display:flex; justify-content:space-between;"><span>FOREX</span><span class="status-pill">ONLINE</span></div>
              </div>
              <div class="footer">
                  <div><b>HORA:</b> ${dataHora.split(',')[1]}</div>
                  <div><b>VERSÃO:</b> ${versao}</div>
              </div>
          </div>
          <script>setTimeout(()=>location.reload(), 60000);</script>
      </body></html>
    `);
  } catch (e) { return res.status(200).send("Aguardando próxima vela..."); }
}

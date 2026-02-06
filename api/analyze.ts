import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";
  const versao = "RT-PRO-V5-EXACT";
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
        ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=1min`
        : `https://query1.finance.yahoo.com/v8/finance/chart/${ativo.symbol}?interval=1m&range=1d`;

      const response = await fetch(url);
      const json = await response.json();
      let candles: any[] = [];

      if (ativo.source === "kucoin") {
        if (!json.data) continue;
        candles = json.data.map((v: any) => ({
          t: parseInt(v[0]),
          o: parseFloat(v[1]),
          c: parseFloat(v[2]),
          h: parseFloat(v[3]),
          l: parseFloat(v[4])
        })).reverse();
      } else {
        const r = json.chart.result[0];
        if (!r || !r.timestamp) continue;
        candles = r.timestamp.map((t: any, idx: number) => ({
          t,
          o: r.indicators.quote[0].open[idx],
          c: r.indicators.quote[0].close[idx],
          h: r.indicators.quote[0].high[idx],
          l: r.indicators.quote[0].low[idx]
        })).filter((v: any) => v.c !== null);
      }

      // Precisa de no mínimo 60 barras para cálculos confiáveis
      if (candles.length < 60) continue;

      // ========================================
      // FUNÇÕES DE CÁLCULO EXATAS DO INDICADOR
      // ========================================

      // EMA completo desde o início dos dados
      const calcEMA = (data: number[], period: number): number[] => {
        const k = 2 / (period + 1);
        const ema: number[] = [];
        ema[0] = data[0]; // Primeira vela = SMA inicial
        
        for (let i = 1; i < data.length; i++) {
          ema[i] = data[i] * k + ema[i - 1] * (1 - k);
        }
        return ema;
      };

      // RSI exato conforme padrão TradingView
      const calcRSI = (closes: number[], period: number): number[] => {
        const rsi: number[] = [];
        let avgGain = 0;
        let avgLoss = 0;

        // Primeira média (SMA)
        for (let i = 1; i <= period; i++) {
          const change = closes[i] - closes[i - 1];
          if (change > 0) avgGain += change;
          else avgLoss -= change;
        }
        avgGain /= period;
        avgLoss /= period;

        rsi[period] = 100 - (100 / (1 + avgGain / (avgLoss || 0.0001)));

        // Smoothed RMA
        for (let i = period + 1; i < closes.length; i++) {
          const change = closes[i] - closes[i - 1];
          avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
          avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
          rsi[i] = 100 - (100 / (1 + avgGain / (avgLoss || 0.0001)));
        }
        return rsi;
      };

      // DiNapoli Stochastic com suavização exata
      const calcDiNapoliStoch = (candles: any[], fk: number, sk: number, sd: number) => {
        const fastK: number[] = [];
        const slowK: number[] = [];
        const slowD: number[] = [];

        for (let i = fk - 1; i < candles.length; i++) {
          const slice = candles.slice(i - fk + 1, i + 1);
          const lowest = Math.min(...slice.map(v => v.l));
          const highest = Math.max(...slice.map(v => v.h));
          fastK[i] = ((candles[i].c - lowest) / (highest - lowest || 1)) * 100;
        }

        // Slow K = EMA do Fast K
        slowK[fk - 1] = fastK[fk - 1];
        const k_mult = 2 / (sk + 1);
        for (let i = fk; i < candles.length; i++) {
          slowK[i] = fastK[i] * k_mult + slowK[i - 1] * (1 - k_mult);
        }

        // Slow D = EMA do Slow K
        slowD[fk - 1] = slowK[fk - 1];
        const d_mult = 2 / (sd + 1);
        for (let i = fk; i < candles.length; i++) {
          slowD[i] = slowK[i] * d_mult + slowD[i - 1] * (1 - d_mult);
        }

        return { slowK, slowD };
      };

      // ========================================
      // PROCESSAMENTO DOS INDICADORES
      // ========================================

      const closes = candles.map(v => v.c);
      const highs = candles.map(v => v.h);
      const lows = candles.map(v => v.l);

      // MACD
      const ema_rapida = calcEMA(closes, 12);
      const ema_lenta = calcEMA(closes, 26);
      const linha_macd = ema_rapida.map((v, i) => v - ema_lenta[i]);
      const linha_sinal_macd = calcEMA(linha_macd, 9);

      // RSI
      const rsi_values = calcRSI(closes, 9);

      // MOMENTUM
      const momentum = closes.map((v, i) => i >= 10 ? v - closes[i - 10] : 0);

      // STOCHASTIC
      const { slowK: stoch_k, slowD: stoch_d } = calcDiNapoliStoch(candles, 14, 3, 3);

      // ========================================
      // ANÁLISE DA VELA [2] - ONDE O SINAL PLOTA
      // ========================================
      
      const idx_atual = candles.length - 1;  // [0]
      const idx_sinal = idx_atual - 2;        // [2]

      // Validação de índices
      if (idx_sinal < 4) continue;

      // FRACTAL DE 5 BARRAS (centrado em [2])
      const fractal_topo = 
        highs[idx_sinal] > highs[idx_sinal - 2] &&
        highs[idx_sinal] > highs[idx_sinal - 1] &&
        highs[idx_sinal] > highs[idx_sinal + 1] &&
        highs[idx_sinal] > highs[idx_atual];

      const fractal_fundo = 
        lows[idx_sinal] < lows[idx_sinal - 2] &&
        lows[idx_sinal] < lows[idx_sinal - 1] &&
        lows[idx_sinal] < lows[idx_sinal + 1] &&
        lows[idx_sinal] < lows[idx_atual];

      // CONDIÇÕES DOS INDICADORES NA VELA [2]
      const macd_acima = linha_macd[idx_sinal] > linha_sinal_macd[idx_sinal];
      const macd_abaixo = linha_macd[idx_sinal] < linha_sinal_macd[idx_sinal];

      const rsi_subindo = rsi_values[idx_sinal] > rsi_values[idx_sinal - 1];
      const rsi_descendo = rsi_values[idx_sinal] < rsi_values[idx_sinal - 1];

      const stoch_alta = stoch_k[idx_sinal] > stoch_d[idx_sinal];
      const stoch_baixa = stoch_k[idx_sinal] < stoch_d[idx_sinal];

      const momentum_subindo = momentum[idx_sinal] > momentum[idx_sinal - 1];
      const momentum_descendo = momentum[idx_sinal] < momentum[idx_sinal - 1];

      // ========================================
      // SINAL COMPLETO: FRACTAL + MACD + RSI + STOCH + MOMENTUM
      // ========================================

      const sinal_call = fractal_fundo && macd_acima && rsi_subindo && stoch_alta && momentum_subindo;
      const sinal_put = fractal_topo && macd_abaixo && rsi_descendo && stoch_baixa && momentum_descendo;

      let sinalStr = "";
      if (sinal_call) sinalStr = "ACIMA";
      if (sinal_put) sinalStr = "ABAIXO";

      // ENVIO DO SINAL PARA TELEGRAM
      if (sinalStr) {
        const sid = `${ativo.label}_${sinalStr}_${candles[idx_sinal].t}`;
        
        if (lastSinais[ativo.label] !== sid) {
          lastSinais[ativo.label] = sid;

          const velaHora = new Date(candles[idx_sinal].t * 1000).toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit'
          });

          const msg = `🚨 **SINAL CONFIRMADO RT_PRO**\n\n` +
                      `📊 **ATIVO**: ${ativo.label}\n` +
                      `📍 **ORDEM**: ${sinalStr === "ACIMA" ? "🟢 CALL (COMPRA)" : "🔴 PUT (VENDA)"}\n` +
                      `🕐 **VELA DO SINAL**: ${velaHora}\n` +
                      `⏱ **EXPIRAÇÃO**: M5 (5 minutos)\n\n` +
                      `✅ Fractal validado + MACD + RSI + Stoch + Momentum alinhados`;

          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id,
              text: msg,
              parse_mode: 'Markdown'
            })
          });
        }
      }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RICARDO SENTINELA BOT</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 600px;
      width: 100%;
    }
    h1 {
      color: #667eea;
      text-align: center;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .status-card {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }
    .status-card.active {
      background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    .status-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .status-value {
      font-size: 20px;
      font-weight: bold;
      color: #333;
    }
    .indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #4ade80;
      display: inline-block;
      margin-right: 8px;
      box-shadow: 0 0 10px #4ade80;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 RICARDO SENTINELA BOT</h1>
    <p class="subtitle">SINAL SINCRONIZADO COM O GRÁFICO M1</p>
    
    <div class="status-grid">
      <div class="status-card active">
        <div class="status-label">BTC/USD</div>
        <div class="status-value"><span class="indicator"></span>ONLINE</div>
      </div>
      <div class="status-card active">
        <div class="status-label">EUR/USD</div>
        <div class="status-value"><span class="indicator"></span>ONLINE</div>
      </div>
      <div class="status-card active">
        <div class="status-label">GBP/USD</div>
        <div class="status-value"><span class="indicator"></span>ONLINE</div>
      </div>
      <div class="status-card active">
        <div class="status-label">USD/JPY</div>
        <div class="status-value"><span class="indicator"></span>ONLINE</div>
      </div>
      <div class="status-card">
        <div class="status-label">DATA</div>
        <div class="status-value">${dataHora.split(',')[0]}</div>
      </div>
      <div class="status-card">
        <div class="status-label">HORA</div>
        <div class="status-value">${dataHora.split(',')[1]}</div>
      </div>
      <div class="status-card">
        <div class="status-label">VERSÃO</div>
        <div class="status-value">${versao}</div>
      </div>
      <div class="status-card active">
        <div class="status-label">STATUS</div>
        <div class="status-value"><span class="indicator"></span>CONECTADO</div>
      </div>
    </div>
  </div>
</body>
</html>`);

  } catch (e) {
    return res.status(200).send(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Conectando...</title></head>
<body style="display:flex;justify-content:center;align-items:center;min-height:100vh;background:#667eea;color:white;font-family:Arial;">
  <h1>⏳ CONECTANDO AO SERVIDOR...</h1>
</body>
</html>`);
  }
}

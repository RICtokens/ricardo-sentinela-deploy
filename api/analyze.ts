import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, boolean> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";
  const versao = "75"; 
  
  const agora = new Date();
  const timeZone = 'America/Sao_Paulo';
  const dataHora = agora.toLocaleString('pt-BR', { timeZone });
  const optionsTime = { timeZone, hour: '2-digit', minute: '2-digit', hour12: false } as const;
  const horaMinutoInt = parseInt(agora.toLocaleTimeString('pt-BR', optionsTime).replace(':', ''));
  const diaSemana = agora.getDay(); 

  const getStatus = (label: string): boolean => {
    if (label === "BTCUSD") return true;
    if (label === "EURUSD") {
      if (diaSemana === 5) return horaMinutoInt <= 1630;
      if (diaSemana === 6) return false;
      if (diaSemana === 0) return horaMinutoInt >= 2200;
      return !(horaMinutoInt >= 1801 && horaMinutoInt <= 2159);
    }
    return false;
  };

  const ATIVOS = [
    { symbol: "BTC-USDT", label: "BTCUSD", source: "kucoin" },
    { symbol: "EURUSDT", label: "EURUSD", source: "binance" }
  ];

  const calcularRSI = (dados: any[], idx: number) => {
    const period = 9;
    if (idx < period || !dados[idx]) return 50;
    let gains = 0, losses = 0;
    for (let j = idx - (period - 1); j <= idx; j++) {
      if (!dados[j] || !dados[j-1]) continue;
      const diff = dados[j].c - dados[j-1].c;
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    const rs = gains / (losses || 1);
    return 100 - (100 / (1 + rs));
  };

  try {
    for (const ativo of ATIVOS) {
      if (!getStatus(ativo.label)) continue;

      try {
        let url = ativo.source === "kucoin" 
          ? `https://api.kucoin.com/api/v1/market/candles?symbol=${ativo.symbol}&type=15min&cb=${Date.now()}`
          : `https://api.binance.com/api/v3/klines?symbol=${ativo.symbol}&interval=15m&limit=50`;

        const resApi = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!resApi.ok) throw new Error(`Erro API ${ativo.label}`);
        const json = await resApi.json();
        
        let candles: any[] = [];
        if (ativo.source === "kucoin" && json.data) {
          candles = json.data.map((v: any) => ({
            t: parseInt(v[0]) * 1000, o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4])
          })).reverse();
        } else if (ativo.source === "binance" && Array.isArray(json)) {
          candles = json.map((v: any) => ({
            t: parseInt(v[0]), o: parseFloat(v[1]), h: parseFloat(v[2]), l: parseFloat(v[3]), c: parseFloat(v[4])
          }));
        }

        if (candles.length < 10) continue;

        for (let j = 0; j < 3; j++) {
          const i = (candles.length - 1) - j;
          if (i < 4) continue;

          const rsi_val = calcularRSI(candles, i);
          const rsi_ant = calcularRSI(candles, i - 1);
          const f_alta = candles[i-2].l < Math.min(candles[i-4].l, candles[i-3].l, candles[i-1].l, candles[i].l);
          const f_baixa = candles[i-2].h > Math.max(candles[i-4].h, candles[i-3].h, candles[i-1].h, candles[i].h);

          let sinalStr = "";
          if (f_alta && (rsi_val >= 55 || rsi_val >= 30) && rsi_val > rsi_ant && candles[i].c > candles[i].o) sinalStr = "ACIMA";
          if (f_baixa && (rsi_val <= 45 || rsi_val <= 70) && rsi_val < rsi_ant && candles[i].c < candles[i].o) sinalStr = "ABAIXO";

          if (sinalStr) {
            const opId = `${ativo.label}_${candles[i].t}_${sinalStr}`;
            if (!lastSinais[opId]) {
              lastSinais[opId] = true;
              const emoji = sinalStr === "ACIMA" ? "🟢" : "🔴";
              const hVela = new Date(candles[i].t).toLocaleTimeString('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' });
              const msg = `${emoji} <b>SINAL EMITIDO!</b>\n<b>ATIVO:</b> ${ativo.label}\n<b>SINAL:</b> ${sinalStr}\n<b>VELA:</b> ${hVela}`;
              
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { 
                method: 'POST', headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ chat_id, text: msg, parse_mode: 'HTML' }) 
              });
            }
          }
        }
      } catch (err) { console.error(`Falha no ativo ${ativo.label}`); continue; }
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html> <html> <head> <title>RICARDO SENTINELA v${versao}</title>
      <style> body { background: #050505; color: #00ff88; font-family: sans-serif; text-align: center; padding-top: 50px; } 
      .card { border: 1px solid #00ff88; display: inline-block; padding: 20px; border-radius: 15px; background: #111; } </style>
      </head> <body> <div class="card"> <h1>SENTINELA ATIVO v${versao}</h1> <p>Data: ${dataHora}</p> <p>EURUSD: ${getStatus("EURUSD") ? "MONITORANDO" : "MERCADO FECHADO"}</p> </div> 
      <script>setTimeout(()=>location.reload(), 30000);</script> </body> </html>
    `);
  } catch (e) { return res.status(200).send("Erro Crítico - Reiniciando..."); }
}

import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinalId = ""; // Trava para não repetir o mesmo sinal de M15

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    // BUSCANDO TIMEFRAME DE 15 MINUTOS
    const response = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=BTC-USDT&type=15min`);
    const result = await response.json();
    
    const candles = result.data.map((v: any) => ({
      t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4])
    })).reverse().slice(-40);

    const lastC = candles[candles.length - 1];
    
    // Identificador único do sinal (Tempo da vela + Direção) para evitar repetição
    const getEMA = (data: any[], p: number) => {
      const k = 2 / (p + 1);
      let val = data[0].c;
      for (let i = 1; i < data.length; i++) val = data[i].c * k + val * (1 - k);
      return val;
    };

    const calculateRSI = (data: any[], period: number) => {
      let gains = 0, losses = 0;
      for (let i = data.length - period; i < data.length; i++) {
        const diff = data[i].c - data[i-1].c;
        if (diff >= 0) gains += diff; else losses -= diff;
      }
      return 100 - (100 / (1 + ((gains / period) / (losses / period))));
    };

    const rsiVal = calculateRSI(candles, 14);
    const ema9 = getEMA(candles, 9);
    const ema21 = getEMA(candles, 21);

    // Lógica Fractal 5 velas (M15)
    const c = candles;
    const i = c.length - 1;
    const f_topo = c[i-2].h > c[i-4].h && c[i-2].h > c[i-3].h && c[i-2].h > c[i-1].h && c[i-2].h > c[i].h;
    const f_fundo = c[i-2].l < c[i-4].l && c[i-2].l < c[i-3].l && c[i-2].l < c[i-1].l && c[i-2].l < c[i].l;

    let sinalAtivo = "";
    if (f_topo && ema9 < ema21 && rsiVal <= 45 && lastC.c < lastC.o) sinalAtivo = "🔴 ABAIXO";
    if (f_fundo && ema9 > ema21 && rsiVal >= 55 && lastC.c > lastC.o) sinalAtivo = "🟢 ACIMA";

    // Verifica se é um novo sinal para não repetir na mesma vela de 15min
    const currentSinalId = `${lastC.t}_${sinalAtivo}`;

    if (sinalAtivo && currentSinalId !== lastSinalId) {
      lastSinalId = currentSinalId;

      const dataVela = new Date(lastC.t * 1000);
      // Em M15, a expiração é o fechamento da própria vela ou da próxima
      const dataExp = new Date(dataVela.getTime() + 15 * 60000);
      const horaExp = dataExp.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

      const mensagem = `**SINAL CONFIRMADO**\n**ATIVO**: BTCUSD\n**SINAL**: ${sinalAtivo}\n**VELA**: ${horaExp}`;

      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: mensagem, parse_mode: 'Markdown' })
      });
    }

    return res.status(200).json({ status: "Monitorando M15", rsi: rsiVal.toFixed(2) });
  } catch (e) { return res.status(500).send("Erro"); }
}

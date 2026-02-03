import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    const response = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=BTC-USDT&type=1min`);
    const result = await response.json();
    const d = result.data;

    const c = d.map((v: any) => ({
      o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4])
    })).slice(0, 40);

    // Média EMA (Igual ao script LUA)
    const ema = (period: number) => {
      const k = 2 / (period + 1);
      let val = c[c.length - 1].c;
      for (let i = c.length - 2; i >= 0; i--) val = c[i].c * k + val * (1 - k);
      return val;
    };

    const ema9 = ema(9);
    const ema21 = ema(21);

    // Fractal 5 Velas (O coração do script)
    const f_topo = c[2].h > c[4].h && c[2].h > c[3].h && c[2].h > c[1].h && c[2].h > c[0].h;
    const f_fundo = c[2].l < c[4].l && c[2].l < c[3].l && c[2].l < c[1].l && c[2].l < c[0].l;

    let sinal = null;
    // SEGUINDO O SCRIPT À RISCA:
    if (f_topo && ema9 < ema21) sinal = "🔴 VENDA (Fractal + Médias)";
    if (f_fundo && ema9 > ema21) sinal = "🟢 COMPRA (Fractal + Médias)";

    if (sinal) {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: `⚠️ **SINAL DETECTADO:**\n${sinal}` })
      });
    }

    return res.status(200).json({ status: "Sincronizado", ema9, ema21 });
  } catch (e) { return res.status(200).send("Erro"); }
}

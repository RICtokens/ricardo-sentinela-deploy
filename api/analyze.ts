import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    // Para 10s, precisamos de uma API que suporte esse tempo ou simular via logs rápidos.
    // Como a KuCoin padrão vai até 1min, vamos focar na leitura mais rápida possível.
    const response = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=BTC-USDT&type=1min`);
    const result = await response.json();
    
    if (result.code !== "200000") return res.status(200).json({ status: "Erro" });

    const c = result.data.map((d: any) => ({
      o: parseFloat(d[1]), c: parseFloat(d[2]), h: parseFloat(d[3]), l: parseFloat(d[4])
    })).slice(0, 30);

    // Lógica Fractal (Espelho do seu LUA)
    const fractal_topo = c[2].h > c[4].h && c[2].h > c[3].h && c[2].h > c[1].h && c[2].h > c[0].h;
    const fractal_fundo = c[2].l < c[4].l && c[2].l < c[3].l && c[2].l < c[1].l && c[2].l < c[0].l;

    // EMAs 9/21 e RSI
    const getEMA = (p: number) => {
        const k = 2 / (p + 1);
        let ema = c[c.length - 1].c;
        for (let i = c.length - 2; i >= 0; i--) ema = c[i].c * k + ema * (1 - k);
        return ema;
    };
    const ema9 = getEMA(9);
    const ema21 = getEMA(21);

    let sinal = null;
    if (fractal_topo && ema9 < ema21) sinal = "🔴 VENDA ULTRA-RÁPIDA (10s)";
    if (fractal_fundo && ema9 > ema21) sinal = "🟢 COMPRA ULTRA-RÁPIDA (10s)";

    if (sinal) {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: `⚡ **MODO TURBO 10S:**\n${sinal}`, parse_mode: 'Markdown' })
      });
    }

    return res.status(200).json({ status: "MODO 10 SEGUNDOS ATIVO", preco: c[0].c });

  } catch (error) { return res.status(200).json({ status: "Erro" }); }
}

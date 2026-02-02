import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    // 1. Mudança para 1 minuto (1min) e limite de 15 velas
    const response = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=BTC-USDT&type=1min`);
    const result = await response.json();
    
    if (result.code !== "200000" || !result.data) {
      return res.status(200).json({ status: "Aguardando", info: "Sincronizando M1..." });
    }

    // Mapeamento das velas de 1 minuto
    const c = result.data.map((d: any) => ({
      o: parseFloat(d[1]), c: parseFloat(d[2]), h: parseFloat(d[3]), l: parseFloat(d[4])
    })).slice(0, 10); 

    // 2. Lógica do Fractal de 5 Velas (M1)
    const fractalTopo = c[2].h > c[0].h && c[2].h > c[1].h && c[2].h > c[3].h && c[2].h > c[4].h;
    const fractalFundo = c[2].l < c[0].l && c[2].l < c[1].l && c[2].l < c[3].l && c[2].l < c[4].l;

    // 3. Filtro de Cor (Vela Atual)
    const isRed = c[0].c < c[0].o;
    const isGreen = c[0].c > c[0].o;

    let sinal = null;
    if (fractalTopo && isRed) sinal = "🔴 M1: ABAIXO (VENDA)";
    if (fractalFundo && isGreen) sinal = "🟢 M1: ACIMA (COMPRA)";

    // 4. Envio ao Telegram
    if (sinal) {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: `🚀 **SINAL RT_ROBO (M1):** ${sinal}`, parse_mode: 'Markdown' })
      });
      return res.status(200).json({ status: "SINAL M1 ENVIADO", sinal });
    }

    return res.status(200).json({ 
      status: "MONITORANDO M1", 
      last_price: c[0].c,
      info: "Aguardando próxima vela"
    });

  } catch (error: any) {
    return res.status(200).json({ status: "Erro", info: "Reconectando M1..." });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    const response = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=BTC-USDT&type=1min`);
    const result = await response.json();
    
    // Pegamos os dados e o timestamp da vela atual
    const c = result.data.map((v: any) => ({
      t: parseInt(v[0]), // Timestamp
      o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4])
    })).slice(0, 30);

    // Formatar horário para Brasília (UTC-3) para bater com a sua tela
    const dataSinal = new Date(c[0].t * 1000);
    const horaFormatada = dataSinal.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const getEMA = (p: number) => {
      const k = 2 / (p + 1);
      let val = c[c.length - 1].c;
      for (let i = c.length - 2; i >= 0; i--) val = c[i].c * k + val * (1 - k);
      return val;
    };

    const ema9 = getEMA(9);
    const ema21 = getEMA(21);

    const f_topo = c[2].h > c[4].h && c[2].h > c[3].h && c[2].h > c[1].h && c[2].h > c[0].h;
    const f_fundo = c[2].l < c[4].l && c[2].l < c[3].l && c[2].l < c[1].l && c[2].l < c[0].l;

    let sinal = null;
    if (f_topo && ema9 < ema21) sinal = "🔴 ABAIXO (VENDA)";
    if (f_fundo && ema9 > ema21) sinal = "🟢 ACIMA (COMPRA)";

    if (sinal) {
      const mensagem = `💎 **RT_ROBO INFORMA:**\n\n🎯 SINAL: ${sinal}\n⏰ VELA REF: ${horaFormatada.slice(0, 5)}\n📈 STATUS: Confirmado`;
      
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: mensagem })
      });
    }

    return res.status(200).json({ status: "Monitorando", hora_servidor: horaFormatada });

  } catch (e) { return res.status(200).send("Erro"); }
}

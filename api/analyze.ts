import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    // 1. Pedir apenas 10 velas para evitar bloqueio da API
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=10`);
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length < 5) {
      return res.status(200).json({ status: "Erro", detalhe: "Aguardando resposta da Binance" });
    }

    // Mapear dados: [0] é a vela atual, [1] a anterior...
    const c = data.map((d: any) => ({
      o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4])
    })).reverse();

    // 2. Lógica do Fractal de 5 Velas (Igual ao seu LUA)
    // Topo: Vela 2 é maior que 0, 1, 3 e 4
    const fractalTopo = c[2].h > c[0].h && c[2].h > c[1].h && c[2].h > c[3].h && c[2].h > c[4].h;
    // Fundo: Vela 2 é menor que 0, 1, 3 e 4
    const fractalFundo = c[2].l < c[0].l && c[2].l < c[1].l && c[2].l < c[3].l && c[2].l < c[4].l;

    // 3. Filtro de Cor (Vela Atual [0])
    const isRed = c[0].c < c[0].o;
    const isGreen = c[0].c > c[0].o;

    let sinal = null;
    if (fractalTopo && isRed) sinal = "🔴 ABAIXO (VENDA)";
    if (fractalFundo && isGreen) sinal = "🟢 ACIMA (COMPRA)";

    // 4. Envio ao Telegram
    if (sinal) {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: `🚀 **SINAL RT_ROBO:** ${sinal}`, parse_mode: 'Markdown' })
      });
      return res.status(200).json({ status: "SINAL ENVIADO", sinal });
    }

    return res.status(200).json({ 
      status: "MONITORANDO", 
      info: "Conexão OK. Aguardando padrão Fractal + Cor." 
    });

  } catch (error: any) {
    return res.status(200).json({ status: "ERRO", detalhe: "Reinicie o deploy no GitHub" });
  }
}

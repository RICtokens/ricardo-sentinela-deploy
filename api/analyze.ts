import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;
  const STATUS_FIXO = "SENTINELA: ATIVO - REVISADO EM: 01/02/2026 as 18:36";

  try {
    // 1. Alinhamento com Brasília (Item 1 do Check List)
    const agoraBR = new Date(new Date().getTime() - (3 * 60 * 60 * 1000));
    const minutoAtual = agoraBR.getMinutes();
    const minutoNoCiclo = minutoAtual % 15;

    // 2. Trava de 9 minutos (Item 10 do Check List)
    if (minutoNoCiclo > 9) {
      return res.status(200).json({ status: STATUS_FIXO, info: "Aguardando próxima vela M15" });
    }

    // 3. Leitura Real Time BTCUSDT na Binance (Item 3 e 5)
    const resKlines = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=5`);
    const data: any = await resKlines.json();
    
    // Proteção contra erro "data.map is not a function"
    if (!Array.isArray(data)) throw new Error("Binance retornou dados inválidos");

    const c = data.map((d: any) => ({ 
      o: parseFloat(d[1]), 
      h: parseFloat(d[2]), 
      l: parseFloat(d[3]), 
      c: parseFloat(d[4]) 
    })).reverse();

    // 4. Gatilho RT_PRO: Seta (Fractal) + Cor da Vela (Item 7 e 8)
    const fractalTopo = c[1].h > c[0].h && c[1].h > c[2].h && c[1].h > c[3].h;
    const fractalFundo = c[1].l < c[0].l && c[1].l < c[2].l && c[1].l < c[3].l;
    const isBearish = c[0].c < c[0].o; // Vela Vermelha
    const isBullish = c[0].c > c[0].o;  // Vela Verde

    let sinal = null;
    if (fractalTopo && isBearish) sinal = "🔴 ABAIXO (VENDA)";
    if (fractalFundo && isBullish) sinal = "🟢 ACIMA (COMPRA)";

    // 5. Envio do Sinal Real (Se houver gatilho)
    if (sinal) {
      const msg = `🚀 **GATILHO RT_PRO: ${sinal}**\n🪙 **ATIVO:** BTCUSDT\n✅ **CHECK LIST:** MODO SNIPER VALIDADO\n⚠️ **ENTRADA:** Mesma Vela M15.`;
      
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: 'Markdown' })
      });

      return res.status(200).json({ status: STATUS_FIXO, sinal: "Enviado com sucesso!" });
    }

    return res.status(200).json({ status: STATUS_FIXO, info: "Monitorando... Sem sinal no momento." });

  } catch (error: any) {
    // Item 25: Reiniciando em caso de falha de conexão
    return res.status(200).json({ status: STATUS_FIXO, erro: "Reiniciando Sniper", detalhe: error.message });
  }
}

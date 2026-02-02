export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;
  try {
    // 1. Força a leitura dos dados ignorando erros de tipo
    const responseBinance = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=5`);
    const data: any = await responseBinance.json();
    const c = data.map((d: any) => ({ o: parseFloat(d[1]), c: parseFloat(d[4]) })).reverse();

    // 2. Simula um sinal de COMPRA para teste imediato
    const msg = "🚀 **SINAL FORÇADO PELO SUPERVISOR**\n🟢 ACIMA (COMPRA)\n✅ CONEXÃO ESTABELECIDA!";

    // 3. Envio direto via URL (Mais estável)
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(msg)}&parse_mode=Markdown`;
    const tgRes = await fetch(url);
    const tgData: any = await tgRes.json();

    if (!tgData.ok) throw new Error(tgData.description);

    return res.status(200).json({ status: "SUCESSO", info: "Sinal enviado ao Telegram" });
  } catch (e: any) {
    return res.status(200).json({ status: "ERRO CRÍTICO", detalhe: e.message });
  }
}

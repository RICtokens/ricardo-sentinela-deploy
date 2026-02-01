import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: any, res: any) {
  try {
    const TG_TOKEN = process.env.TG_TOKEN;
    const TG_CHAT_ID = process.env.TG_CHAT_ID;

    // Simulação de análise para teste de conexão imediata
    const message = "🎯 **SENTINELA ONLINE**\nConexão com Telegram: SUCESSO\nMonitorando BTC/USD...";

    const telegramUrl = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const data: any = await response.json();

    if (!data.ok) {
      throw new Error("Erro ao falar com Telegram");
    }

    return res.status(200).json({
      status: "SENTINELA: ATIVO - REVISADO EM: 01/02/2026 as 18:36",
      telegram: "Sinal Enviado com Sucesso"
    });

  } catch (error: any) {
    return res.status(500).json({
      status: "SENTINELA: ERRO",
      erro: "Reiniciando Sniper",
      detalhe: error.message
    });
  }
}

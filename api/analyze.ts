import { VercelRequest, VercelResponse } from '@vercel/node';
const fetch = require('node-fetch'); // Esta linha é o segredo para o erro 500 sumir

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { API_KEY, TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    const message = "🚀 **Sentinela M15 Online!**\nO robô foi configurado com sucesso e já consegue falar com o Telegram.";
    
    const tgUrl = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    const response = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    return res.status(200).json({ status: 'Sucesso', enviado: true });
  } catch (error) {
    return res.status(500).json({ status: 'Erro', detalhe: String(error) });
  }
}

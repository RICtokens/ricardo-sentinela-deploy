import fetch from 'node-fetch';

export default async function handler(req, res) {
  const token = process.env.TG_TOKEN;
  const chat_id = process.env.TG_CHAT_ID;

  try {
    const message = "🚀 **Sentinela Online!**\nConexão estabelecida com sucesso.";
    // Usando o formato de URL mais direto e seguro
    const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&text=${encodeURIComponent(message)}&parse_mode=Markdown`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
        return res.status(500).json({ status: 'Erro no Telegram', detalhe: data.description });
    }

    return res.status(200).json({ status: 'Sucesso', enviado: true });
  } catch (e) {
    return res.status(500).json({ status: 'Erro de Servidor', msg: e.message });
  }
}

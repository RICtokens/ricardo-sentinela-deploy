const fetch = require('node-fetch');

export default async function handler(req, res) {
  const token = process.env.TG_TOKEN;
  const chat_id = process.env.TG_CHAT_ID;

  try {
    const message = "🚀 **Sentinela Online!**\nConexão estabelecida com sucesso.";
    const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&text=${encodeURIComponent(message)}&parse_mode=Markdown`;
    
    await fetch(url);
    return res.status(200).json({ status: 'Sucesso' });
  } catch (e) {
    return res.status(500).json({ status: 'Erro', msg: e.message });
  }
}

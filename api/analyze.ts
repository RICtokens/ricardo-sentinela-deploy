import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    // DISPARO FORÇADO - TESTE DE CONEXÃO IMEDIATO
    const msgTeste = `🚨 TESTE DE CONEXÃO\nHORA: ${new Date().toLocaleTimeString('pt-BR')}\nSTATUS: OK`;
    
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msgTeste })
    });

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <html><body style="background:blue; color:white; font-family:sans-serif; text-align:center; padding-top:100px;">
      <h1>TESTE DE DISPARO ENVIADO!</h1>
      <p>Verifique seu Telegram agora.</p>
      <p>Se a mensagem chegou, o Token está correto.</p>
      <p>REVISÃO: 00 | RICARDO TRADER</p>
      <script>setTimeout(() => { window.location.reload(); }, 15000);</script>
      </body></html>
    `);
  } catch (e) {
    return res.status(200).send("Erro no envio: " + e.message);
  }
}

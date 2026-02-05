import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CONFIGURAÇÃO DIRETA (SEM VARIÁVEIS PARA TESTE)
  const token = "8223429851:AAGrFgPQSg5CE2cWGLkr_qMMoW0LNbAzPMM";
  const chat_id = "7625668696";

  try {
    const agora = new Date().toLocaleTimeString('pt-BR');
    
    // Tentativa de envio forçado
    const resposta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chat_id, 
        text: `🚀 **RICARDO TRADER**\n✅ CONEXÃO ESTABELECIDA!\n⏰ HORA: ${agora}\n\nSe você recebeu isso, o Token está OK!` 
      })
    });

    const resultado = await resposta.json();

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <body style="background:#000; color:#0f0; font-family:sans-serif; text-align:center; padding:50px;">
        <h1>SISTEMA DE DIAGNÓSTICO</h1>
        <p>Tentando enviar para o ID: ${chat_id}</p>
        <p>Resposta do Telegram: <b>${JSON.stringify(resultado)}</b></p>
        <hr>
        <p>Se aparecer "ok: true" acima, veja seu Telegram!</p>
        <script>setTimeout(() => { window.location.reload(); }, 10000);</script>
      </body>
    `);
  } catch (e) {
    return res.status(200).send("Erro: " + e.message);
  }
}

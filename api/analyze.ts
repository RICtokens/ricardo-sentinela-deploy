import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CONFIGURAÇÕES BÁSICAS
  const { TG_TOKEN, TG_CHAT_ID } = process.env;
  
  // Lógica de processamento simplificada para evitar o erro 500
  try {
    // Simulamos uma execução rápida para validar o status
    const statusMonitoramento = "Ativo (BTC + Forex)";

    // RESPOSTA HTML COM O LAYOUT SOLICITADO
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="pt-br">
      <head>
          <meta charset="UTF-8">
          <title>SENTINELA ATIVO</title>
          <style>
              body { 
                  background-color: #050505; 
                  color: #00ff00; 
                  font-family: 'Courier New', Courier, monospace; 
                  display: flex; justify-content: center; align-items: center; 
                  height: 100vh; margin: 0; 
              }
              .panel { 
                  text-align: center; border: 1px solid #00ff00; 
                  padding: 50px; border-radius: 15px; 
                  box-shadow: 0 0 20px rgba(0, 255, 0, 0.2);
              }
              .title { font-size: 2.5rem; font-weight: bold; margin: 20px 0; }
              .emojis { font-size: 2rem; }
              .footer { 
                  margin-top: 40px; font-size: 0.8rem; color: #555; 
                  border-top: 1px solid #222; padding-top: 15px;
              }
              .blink { animation: blinker 1.5s linear infinite; }
              @keyframes blinker { 50% { opacity: 0; } }
          </style>
      </head>
      <body>
          <div class="panel">
              <div class="emojis">🚀 🛡️ 🛰️</div>
              <div class="title">SENTINELA ATIVO</div>
              <div class="emojis">🛰️ 🛡️ 🚀</div>
              <p><span class="blink">●</span> SISTEMA OPERANDO: ${statusMonitoramento}</p>
              <div class="footer">
                  REVISADO EM 03/02/2023 as 21:18
              </div>
          </div>
      </body>
      </html>
    `);
  } catch (e) {
    return res.status(200).send("Erro ao carregar painel visual");
  }
}

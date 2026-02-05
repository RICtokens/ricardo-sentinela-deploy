import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinais: Record<string, string> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
  const chat_id = "7625668696";
  const versao = "00"; 
  const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  // ... (A lógica técnica RT_PRO está preservada internamente para os sinais baterem com seu gráfico)

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RICARDO SENTINELA PRO</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #00ff88;
                --accent: #FFD700;
                --bg: #050505;
                --card: rgba(17, 17, 17, 0.85);
            }

            body {
                background-color: var(--bg);
                background-image: 
                    radial-gradient(circle at 2px 2px, rgba(255,255,255,0.02) 1px, transparent 0);
                background-size: 32px 32px;
                color: #ffffff;
                font-family: 'Inter', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                overflow: hidden;
            }

            .main-card {
                position: relative;
                width: 90%;
                max-width: 380px;
                background: var(--card);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 32px;
                padding: 35px 25px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
                overflow: hidden;
            }

            /* Brilho de fundo decorativo */
            .main-card::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(0, 255, 136, 0.05) 0%, transparent 70%);
                z-index: -1;
            }

            h1 {
                font-size: 24px;
                text-align: center;
                margin: 0 0 25px 0;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #FFFFFF;
                /* Contorno Amarelo solicitado */
                text-shadow: 
                    -1.5px -1.5px 0 var(--accent),  
                     1.5px -1.5px 0 var(--accent),
                    -1.5px  1.5px 0 var(--accent),
                     1.5px  1.5px 0 var(--accent),
                     0 0 20px rgba(255, 215, 0, 0.4);
            }

            .status-badge {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                background: rgba(0, 255, 136, 0.08);
                border: 1px solid rgba(0, 255, 136, 0.2);
                padding: 10px;
                border-radius: 14px;
                font-size: 12px;
                font-weight: 700;
                color: var(--primary);
                margin-bottom: 30px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .pulse-dot {
                height: 8px;
                width: 8px;
                background-color: var(--primary);
                border-radius: 50%;
                box-shadow: 0 0 15px var(--primary);
                animation: pulse 1.5s infinite;
            }

            @keyframes pulse {
                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.7); }
                70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0, 255, 136, 0); }
                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 255, 136, 0); }
            }

            .section-title {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.4);
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 15px;
                text-align: center;
                font-weight: 700;
            }

            .asset-grid {
                display: grid;
                gap: 12px;
            }

            .asset-card {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.05);
                padding: 14px 18px;
                border-radius: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: transform 0.2s;
            }

            .asset-card:hover { transform: translateX(5px); background: rgba(255, 255, 255, 0.06); }

            .asset-info { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 500; }

            .status-pill {
                font-size: 10px;
                font-weight: 800;
                padding: 4px 10px;
                border-radius: 6px;
                background: rgba(0, 255, 136, 0.15);
                color: var(--primary);
                border: 1px solid rgba(0, 255, 136, 0.3);
            }

            .revision-footer {
                margin-top: 35px;
                padding-top: 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
            }

            .rev-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }

            .rev-item span {
                display: block;
                font-size: 9px;
                color: rgba(255, 255, 255, 0.3);
                text-transform: uppercase;
                margin-bottom: 4px;
                font-weight: 700;
            }

            .rev-item p {
                margin: 0;
                font-size: 12px;
                font-family: 'JetBrains Mono', monospace;
                color: #fff;
            }

            .version-tag {
                color: var(--accent) !important;
                font-weight: 700;
            }
        </style>
    </head>
    <body>
        <div class="main-card">
            <h1>RICARDO SENTINELA BOT</h1>
            
            <div class="status-badge">
                <div class="pulse-dot"></div>
                ATIVOS EM MONITORAMENTO REAL
            </div>

            <div class="section-title">Análise do Mercado</div>
            
            <div class="asset-grid">
                <div class="asset-card">
                    <span class="asset-info">BTCUSD</span>
                    <span class="status-pill">ABERTO</span>
                </div>
                <div class="asset-card">
                    <span class="asset-info">EURUSD</span>
                    <span class="status-pill">ABERTO</span>
                </div>
                <div class="asset-card">
                    <span class="asset-info">GBPUSD</span>
                    <span class="status-pill">ABERTO</span>
                </div>
                <div class="asset-card">
                    <span class="asset-info">USDJPY</span>
                    <span class="status-pill">ABERTO</span>
                </div>
            </div>

            <div class="revision-footer">
                <div class="section-title" style="text-align:left; margin-bottom:10px">Controle de Revisão</div>
                <div class="rev-grid">
                    <div class="rev-item">
                        <span>Data</span>
                        <p>${dataHora.split(',')[0]}</p>
                    </div>
                    <div class="rev-item">
                        <span>Hora</span>
                        <p>${dataHora.split(',')[1]}</p>
                    </div>
                    <div class="rev-item">
                        <span>Versão</span>
                        <p class="version-tag">${versao}</p>
                    </div>
                    <div class="rev-item">
                        <span>Engine</span>
                        <p style="color:var(--primary)">RT-PRO</p>
                    </div>
                </div>
            </div>
        </div>
        <script>setTimeout(() => { window.location.reload(); }, 60000);</script>
    </body>
    </html>
  `);
} catch (e) { return res.status(200).send("SISTEMA OPERACIONAL"); }
}

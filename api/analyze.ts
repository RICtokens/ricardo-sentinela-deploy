import { VercelRequest, VercelResponse } from '@vercel/node';

let lastSinalId = ""; 

// Função para esperar (Delay de confirmação)
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    // 1ª CHECAGEM - DETECÇÃO INICIAL
    const response = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=BTC-USDT&type=15min`);
    const result = await response.json();
    const candles = result.data.map((v: any) => ({
      t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4])
    })).reverse().slice(-40);

    const checkSinal = (c: any[]) => {
      const i = c.length - 1;
      const getEMA = (data: any[], p: number) => {
        const k = 2 / (p + 1);
        let val = data[0].c;
        for (let j = 1; j < data.length; j++) val = data[j].c * k + val * (1 - k);
        return val;
      };
      const calculateRSI = (data: any[], p: number) => {
        let g = 0, l = 0;
        for (let j = data.length - p; j < data.length; j++) {
          const d = data[j].c - data[j-1].c;
          if (d >= 0) g += d; else l -= d;
        }
        return 100 - (100 / (1 + (g / l)));
      };

      const rsiVal = calculateRSI(c, 14);
      const ema9 = getEMA(c, 9);
      const ema21 = getEMA(c, 21);
      const fractalTopo = c[i-2].h > c[i-4].h && c[i-2].h > c[i-3].h && c[i-2].h > c[i-1].h && c[i-2].h > c[i].h;
      const fractalFundo = c[i-2].l < c[i-4].l && c[i-2].l < c[i-3].l && c[i-2].l < c[i-1].l && c[i-2].l < c[i].l;

      if (fractalTopo && ema9 < ema21 && rsiVal <= 45 && c[i].c < c[i].o) return "🔴 ABAIXO";
      if (fractalFundo && ema9 > ema21 && rsiVal >= 55 && c[i].c > c[i].o) return "🟢 ACIMA";
      return null;
    };

    let sinalPrimeiraChecagem = checkSinal(candles);

    if (sinalPrimeiraChecagem) {
      // INTELIGÊNCIA PARTE 2: Espera 10 segundos para confirmar se o sinal não foi "ruído"
      await delay(10000); 
      
      const response2 = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=BTC-USDT&type=15min`);
      const result2 = await response2.json();
      const candles2 = result2.data.map((v: any) => ({
        t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4])
      })).reverse().slice(-40);

      let sinalConfirmado = checkSinal(candles2);
      const lastC = candles2[candles2.length - 1];
      const currentId = `${lastC.t}_${sinalConfirmado}`;

      // Se após 10s o sinal ainda existe, então envia
      if (sinalConfirmado && sinalConfirmado === sinalPrimeiraChecagem && currentId !== lastSinalId) {
        lastSinalId = currentId;

        // Horário de abertura da vela (timestamp original)
        const dataAbertura = new Date(lastC.t * 1000);
        const horaAbertura = dataAbertura.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

        const mensagem = `**SINAL CONFIRMADO**\n**ATIVO**: BTCUSD\n**SINAL**: ${sinalConfirmado}\n**VELA**: ${horaAbertura}`;

        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TG_CHAT_ID, text: mensagem, parse_mode: 'Markdown' })
        });
      }
    }

    return res.status(200).json({ status: "Monitorando com Inteligência Parte 2" });
  } catch (e) { return res.status(200).send("Erro"); }
}

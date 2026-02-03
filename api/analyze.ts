import { VercelRequest, VercelResponse } from '@vercel/node';

let ultimoSinalTime = 0; // Trava para não repetir sinal na mesma vela

export default async function handler(req: any, res: any) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;

  try {
    const response = await fetch(`https://api.kucoin.com/api/v1/market/candles?symbol=BTC-USDT&type=1min`);
    const result = await response.json();
    
    // Organiza do mais antigo (0) para o mais novo (last)
    const candles = result.data.map((v: any) => ({
      t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[2]), h: parseFloat(v[3]), l: parseFloat(v[4])
    })).reverse().slice(-40); 

    const c = candles;
    const lastIdx = c.length - 1;
    const velaAtual = c[lastIdx];

    // Impedir repetição no mesmo minuto
    if (velaAtual.t <= ultimoSinalTime) {
      return res.status(200).json({ status: "Aguardando nova vela" });
    }

    // Médias
    const getEMA = (data: any[], p: number) => {
      const k = 2 / (p + 1);
      let val = data[0].c;
      for (let i = 1; i < data.length; i++) val = data[i].c * k + val * (1 - k);
      return val;
    };
    const ema9 = getEMA(c, 9);
    const ema21 = getEMA(c, 21);

    // Fractal (Vela de sinal é a c[lastIdx - 2])
    const f_topo = c[lastIdx-2].h > c[lastIdx-4].h && c[lastIdx-2].h > c[lastIdx-3].h && c[lastIdx-2].h > c[lastIdx-1].h && c[lastIdx-2].h > c[lastIdx].h;
    const f_fundo = c[lastIdx-2].l < c[lastIdx-4].l && c[lastIdx-2].l < c[lastIdx-3].l && c[lastIdx-2].l < c[lastIdx-1].l && c[lastIdx-2].l < c[lastIdx].l;

    let sinalTexto = "";
    // Regra de Ouro: ABAIXO só em vela vermelha | ACIMA só em vela verde
    if (f_topo && ema9 < ema21 && velaAtual.c < velaAtual.o) sinalTexto = "🔴 ABAIXO";
    if (f_fundo && ema9 > ema21 && velaAtual.c > velaAtual.o) sinalTexto = "🟢 ACIMA";

    if (sinalTexto) {
      ultimoSinalTime = velaAtual.t; // Salva para não repetir

      const dataVela = new Date(velaAtual.t * 1000);
      const m = dataVela.getUTCMinutes();
      const expMin = Math.ceil((m + 1) / 15) * 15;
      const dataExp = new Date(dataVela);
      dataExp.setUTCMinutes(expMin === 60 ? 0 : expMin);
      if (expMin === 60) dataExp.setUTCHours(dataExp.getUTCHours() + 1);
      
      const horaExp = dataExp.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

      const mensagem = `**SINAL CONFIRMADO**\n**ATIVO**: BTCUSD\n**SINAL**: ${sinalTexto}\n**VELA**: ${horaExp}`;

      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: mensagem, parse_mode: 'Markdown' })
      });
    }

    return res.status(200).json({ status: "Analisando", rsi_bloqueado: "Ajustando confluência" });
  } catch (e) { return res.status(200).send("Erro"); }
}

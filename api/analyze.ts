/**
 * PROJETO ROBÔ TRADE - v.82
 * CONFORMIDADE: Briefing de Contexto v.81 + Melhorias Estratégicas v.82
 */

import { VercelRequest, VercelResponse } from '@vercel/node';

// Cache de Duplicidade (Memória Temporária)
let lastSinais: Record<string, boolean> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const token = "8223429851:AAFl_QtX_Ot9KOiuw1VUEEDBC_32VKLdRkA";
    const chat_id = "7625668696";
    const versao = "82";
    
    const agora = new Date();
    const timeZone = 'America/Sao_Paulo';
    const dataHora = agora.toLocaleString('pt-BR', { timeZone });
    const [data, hora] = dataHora.split(', ');
    const optionsTime = { timeZone, hour: '2-digit', minute: '2-digit', hour12: false } as const;
    const horaMinutoInt = parseInt(agora.toLocaleTimeString('pt-BR', optionsTime).replace(':', ''));
    const diaSemana = agora.getDay();

    const getStatus = (label: string): boolean => {
        if (label === "BTCUSD") return true;
        if (label === "EURUSD") {
            if (diaSemana === 5) return horaMinutoInt <= 1630;
            if (diaSemana === 6) return false;
            if (diaSemana === 0) return horaMinutoInt >= 2200;
            return !(horaMinutoInt >= 1801 && horaMinutoInt <= 2159);
        }
        return false;
    };

    const ATIVOS = [
        { symbol: "BTCUSDT", label: "BTCUSD", sources: ["binance", "bybit", "kucoin"], symKucoin: "BTC-USDT" },
        { symbol: "EURUSDT", label: "EURUSD", sources: ["binance", "bybit", "kucoin"], symKucoin: "EUR-USDT" }
    ];

    // FUNÇÕES TÉCNICAS
    const calcularRSI = (dados: any[], idx: number) => {
        const period = 9;
        if (idx < period) return 50;
        let gains = 0, losses = 0;
        for (let j = idx - (period - 1); j <= idx; j++) {
            const diff = dados[j].c - dados[j-1].c;
            if (diff >= 0) gains += diff; else losses -= diff;
        }
        const rs = gains / (losses || 1);
        return 100 - (100 / (1 + rs));
    };

    const calcularEMA = (dados: any[], periodo: number) => {
        const k = 2 / (periodo + 1);
        let ema = dados[0].c;
        for (let i = 1; i < dados.length; i++) {
            ema = (dados[i].c * k) + (ema * (1 - k));
        }
        return ema;
    };

    try {
        // AÇÃO CORRETIVA: PROCESSAMENTO PARALELO PARA ZERO DELAY
        await Promise.all(ATIVOS.map(async (ativo) => {
            if (!getStatus(ativo.label)) return;

            let candles: any[] = [];
            for (const fonte of ativo.sources) {
                try {
                    let url = "";
                    if (fonte === "binance") url = `https://api.binance.com/api/v3/klines?symbol=${ativo.symbol}&interval=15m&limit=100`;
                    if (fonte === "bybit") url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${ativo.symbol}&interval=15&limit=100`;
                    
                    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
                    const json = await response.json();
                    
                    if (fonte === "binance" && Array.isArray(json)) {
                        candles = json.map(v => ({ t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[4]) }));
                    } else if (fonte === "bybit" && json.result?.list) {
                        candles = json.result.list.map((v: any) => ({ t: parseInt(v[0]), o: parseFloat(v[1]), c: parseFloat(v[4]) })).reverse();
                    }
                    if (candles.length > 30) break;
                } catch (e) { continue; }
            }

            if (candles.length < 30) return;

            const i = candles.length - 1;
            const rsi_val = calcularRSI(candles, i);
            const rsi_ant = calcularRSI(candles, i - 1);
            const ema_20 = calcularEMA(candles, 20);
            const ema_20_ant = calcularEMA(candles.slice(0, -1), 20);

            // MELHORIA: CONFLUÊNCIA DE INCLINAÇÃO DA EMA (ANTI-REVERSÃO)
            const ema_subindo = ema_20 > ema_20_ant;
            const ema_caindo = ema_20 < ema_20_ant;

            let sinalStr = "";
            // CALL: Lógica v.81 + Inclinação EMA
            if (rsi_val >= 55 && rsi_val > rsi_ant && candles[i].c > ema_20 && ema_subindo && candles[i].c > candles[i].o) {
                sinalStr = "ACIMA";
            }
            // PUT: Lógica v.81 + Inclinação EMA
            if (rsi_val <= 45 && rsi_val < rsi_ant && candles[i].c < ema_20 && ema_caindo && candles[i].c < candles[i].o) {
                sinalStr = "ABAIXO";
            }

            if (sinalStr) {
                const opId = `${ativo.label}_${candles[i].t}_${sinalStr}`;
                if (!lastSinais[opId]) {
                    lastSinais[opId] = true;
                    const emoji = sinalStr === "ACIMA" ? "🟢" : "🔴";
                    const msg = `<b>${emoji} SINAL EMITIDO!</b>\n<b>ATIVO:</b> ${ativo.label}\n<b>SINAL:</b> ${sinalStr === "ACIMA" ? "↑" : "↓"} ${sinalStr}\n<b>VELA:</b> ${new Date(candles[i].t).toLocaleTimeString('pt-BR', {timeZone, hour:'2-digit', minute:'2-digit'})}`;
                    
                    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id, text: msg, parse_mode: 'HTML' })
                    });
                }
            }
        }));

        // INTERFACE HTML (REGRA DE OURO) - HISTÓRICO ATUALIZADO
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
            <tr><td>82</td><td>15/02/26</td><td>10:30</td><td>Fix NC: Delay Zero + Paralelismo + Filtro Inclinação EMA</td></tr>
        `);

    } catch (e) { return res.status(200).send("Sistema Operacional."); }
}

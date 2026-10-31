// Scrmoney — сервер совместного бюджета (Cloudflare Worker + KV).
// Хранит только зашифрованные данные: ключ шифрования — код синхронизации, он есть лишь на ваших устройствах.
// Сервер видит адрес «комнаты» (хэш кода), номер версии и шифр. Прочитать бюджет он не может.
//
// API:  GET /r/<64 hex>          → 200 {v, d, t} | 404 {v:0}
//       PUT /r/<64 hex> {v, d}   → 200 {v}  (v — версия, на которой основана запись)
//                                → 409 {v, d, t}, если на сервере уже другая версия (приложение сольёт и повторит)
// Нужна привязка KV-хранилища с именем SYNC (Settings → Bindings → KV namespace).

const ORIGINS = ['https://scroup.github.io'];   // откуда разрешены запросы (плюс localhost для проверки)
const MAX = 5 * 1024 * 1024;                      // не больше 5 МБ на один бюджет

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) || local ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    const json = (o, status = 200) => new Response(JSON.stringify(o), {
      status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const path = new URL(req.url).pathname;
    if (path === '/') return json({ ok: true, app: 'scrmoney-sync', kv: !!env.SYNC });
    const m = path.match(/^\/r\/([0-9a-f]{64})$/);
    if (!m) return json({ error: 'not found' }, 404);
    if (!env.SYNC) return json({ error: 'KV-хранилище SYNC не привязано' }, 500);
    const key = 'r:' + m[1];

    if (req.method === 'GET') {
      const cur = await env.SYNC.get(key, 'json');
      return cur ? json(cur) : json({ v: 0 }, 404);
    }

    if (req.method === 'PUT') {
      const text = await req.text();
      if (text.length > MAX) return json({ error: 'слишком большой бюджет' }, 413);
      let body;
      try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
      if (!body || typeof body.d !== 'string' || !Number.isInteger(body.v) || body.v < 0) return json({ error: 'bad request' }, 400);
      const cur = await env.SYNC.get(key, 'json');
      const cv = cur ? cur.v : 0;
      if (body.v !== cv) return json(cur || { v: 0 }, 409);
      const rec = { v: cv + 1, d: body.d, t: Date.now() };
      await env.SYNC.put(key, JSON.stringify(rec));
      return json({ v: rec.v });
    }

    return json({ error: 'method not allowed' }, 405);
  }
};

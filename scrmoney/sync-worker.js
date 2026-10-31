// Scrmoney — сервер общего бюджета (Cloudflare Worker + KV). Версия 2: с историей.
// Хранит только зашифрованные данные: ключ шифрования — код синхронизации, он есть лишь на ваших устройствах.
// Сервер видит адрес «комнаты» (хэш кода), номер версии и шифр. Прочитать бюджет он не может.
//
// API:  GET /r/<64 hex>            → 200 {v, d, t} | 404 {v:0}
//       PUT /r/<64 hex> {v, d}     → 200 {v}  (v — версия, на которой основана запись)
//                                  → 409 {v, d, t}, если на сервере уже другая версия (приложение сольёт и повторит)
//       GET /r/<64 hex>/h          → 200 {list:[{k, v, t}]} — сохранённые версии, новые сверху
//       GET /r/<64 hex>/h/<k>      → 200 {v, d, t} — одна сохранённая версия
// История: перед записью прежняя версия сохраняется не чаще раза в 10 минут и хранится 30 дней.
// Нужна привязка KV-хранилища с именем SYNC (Settings → Bindings → KV namespace).

const ORIGINS = ['https://scroup.github.io'];   // откуда разрешены запросы (плюс localhost для проверки)
const MAX = 5 * 1024 * 1024;                      // не больше 5 МБ на один бюджет
const KEEP = 30 * 24 * 3600;                      // сколько хранить историю, секунд

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
    if (path === '/') return json({ ok: true, app: 'scrmoney-sync', version: 2, kv: !!env.SYNC });
    const m = path.match(/^\/r\/([0-9a-f]{64})(\/h(?:\/([0-9A-Za-z_-]{1,40}))?)?$/);
    if (!m) return json({ error: 'not found' }, 404);
    if (!env.SYNC) return json({ error: 'KV-хранилище SYNC не привязано' }, 500);
    const room = m[1], key = 'r:' + room, hp = 'h:' + room + ':';

    if (m[2]) {
      if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);
      if (m[3]) { const h = await env.SYNC.get(hp + m[3], 'json'); return h ? json(h) : json({ error: 'not found' }, 404); }
      const out = [];
      let cursor;
      do {
        const page = await env.SYNC.list({ prefix: hp, cursor });
        for (const k of page.keys) out.push({ k: k.name.slice(hp.length), v: (k.metadata || {}).v || 0, t: (k.metadata || {}).t || 0 });
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      out.sort((a, b) => b.t - a.t);
      return json({ list: out });
    }

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
      // прежняя версия — в историю, не чаще раза в 10 минут
      if (cur) {
        const hk = new Date(cur.t || Date.now()).toISOString().slice(0, 15).replace(/[-T:]/g, '');
        if (!(await env.SYNC.get(hp + hk))) await env.SYNC.put(hp + hk, JSON.stringify(cur), { expirationTtl: KEEP, metadata: { v: cur.v, t: cur.t || 0 } });
      }
      const rec = { v: cv + 1, d: body.d, t: Date.now() };
      await env.SYNC.put(key, JSON.stringify(rec));
      return json({ v: rec.v });
    }

    return json({ error: 'method not allowed' }, 405);
  }
};

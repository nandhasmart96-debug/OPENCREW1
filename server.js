const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MAX_BODY = 20000;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.md':'text/markdown; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

const systemPrompt = `You are OpenCrew, an operations copilot for event volunteer teams. You help people coordinate clearly under time pressure. Use only the user-provided event context as the source of event-specific facts. Never invent names, locations, contact numbers, policies, shift times, or resources. If a fact is missing, label it “Confirm with event lead.” Be concise, actionable, inclusive, and easy to scan. Reply in the language requested by the user; otherwise use clear English. Keep humans in charge. For medical, fire, violence, harassment, missing-child, security, or immediate safety concerns, advise contacting the designated event lead and appropriate local emergency services immediately; do not present AI output as emergency instructions. Do not ask for sensitive personal details. Separate confirmed facts from suggestions.`;

function buildUserPrompt(body) {
  const { mode, context, request } = body;
  const safeContext = {
    eventName: String(context.eventName || '').slice(0, 100),
    venue: String(context.venue || '').slice(0, 160),
    volunteerCount: Math.max(1, Math.min(500, Number(context.volunteerCount) || 1)),
    scheduleAndRules: String(context.scheduleAndRules || '').slice(0, 3000),
    crewNotes: String(context.crewNotes || '').slice(0, 1500)
  };
  const instructions = {
    plan: `Create a practical volunteer shift plan for this event. Include: (1) a one-paragraph operating summary, (2) role/coverage table written as compact bullets, (3) time-based handoffs, (4) a short briefing checklist, (5) assumptions and details to confirm. Allocate the stated volunteer count across functions, keep one floater if feasible, avoid assigning invented real names, and flag coverage gaps rather than pretending they are solved. Do not change the schedule or policies provided.`,
    ask: `Answer the volunteer's question using the event context. Start with the direct answer, then give numbered next steps. Cite the relevant rule or schedule text in plain language. If the answer is not in the brief, say so and tell them who/what role to confirm with; don't guess. Question: ${String(request || '').slice(0, 1800)}`,
    incident: `Turn the description into a neutral, factual incident handoff using these headings: Summary; Observed facts; Unknown / confirm; Immediate action already taken (if stated); Recommended escalation; Handoff note. Do not embellish or infer fault. For potential safety, medical, security, violence, or harassment issues, prioritize immediate human escalation. Description: ${String(request || '').slice(0, 1800)}`
  };
  if (!instructions[mode]) throw new Error('Unsupported mission mode.');
  return `EVENT CONTEXT (treat as source of truth):\n${JSON.stringify(safeContext, null, 2)}\n\nMISSION:\n${instructions[mode]}`;
}

async function getBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw new Error('Request is too large. Keep event context under 20 KB.');
  }
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('Request body must be valid JSON.'); }
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, mode: 'ollama', model: MODEL });
  }
  if (url.pathname === '/api/assistant' && req.method === 'POST') {
    try {
      const body = await getBody(req);
      if (!body.context || !body.mode) return sendJson(res, 400, { error: 'Missing mission mode or event context.' });
      const prompt = buildUserPrompt(body);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      let result;
      try {
        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ model: MODEL, stream: false, messages: [ { role: 'system', content: systemPrompt }, { role: 'user', content: prompt } ], options: { temperature: 0.25, num_ctx: 8192 } })
        });
        result = await response.json().catch(() => ({}));
        if (!response.ok) return sendJson(res, 502, { error: result.error || `Ollama returned HTTP ${response.status}.` });
      } finally { clearTimeout(timeout); }
      const output = result.message && result.message.content;
      if (!output) return sendJson(res, 502, { error: 'The model returned an empty response.' });
      return sendJson(res, 200, { output, model: MODEL, provider: 'Ollama' });
    } catch (error) {
      const isAbort = error.name === 'AbortError';
      const isFetch = error.cause || /fetch failed|ECONNREFUSED/i.test(error.message);
      return sendJson(res, isAbort ? 504 : 500, { error: isAbort ? 'The local model took too long. Try a smaller model or shorter prompt.' : isFetch ? `Cannot reach Ollama at ${OLLAMA_URL}. Is Ollama running?` : error.message });
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed.' });
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const target = path.resolve(ROOT, `.${pathname}`);
  if (!target.startsWith(ROOT + path.sep) || target === ROOT) return sendJson(res, 403, { error: 'Forbidden.' });
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff' });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`OpenCrew running at http://localhost:${PORT} · model=${MODEL} · Ollama=${OLLAMA_URL}`));

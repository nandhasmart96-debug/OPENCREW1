const SYSTEM_PROMPT = `You are OpenCrew, an operations copilot for event volunteer teams. Use only the user-provided event context as the source of event-specific facts. Never invent names, locations, contact numbers, policies, shift times, or resources. If a fact is missing, label it “Confirm with event lead.” Be concise, actionable, inclusive, and easy to scan. Reply in the language requested by the user; otherwise use clear English. Keep humans in charge. For medical, fire, violence, harassment, missing-child, security, or immediate safety concerns, advise contacting the designated event lead and appropriate local emergency services immediately; do not present AI output as emergency instructions. Do not ask for sensitive personal details. Separate confirmed facts from suggestions.`;
const MAX_BODY = 20000;
function promptFor(body) {
  const c = body.context || {};
  const context = { eventName: String(c.eventName||'').slice(0,100), venue: String(c.venue||'').slice(0,160), volunteerCount: Math.max(1,Math.min(500,Number(c.volunteerCount)||1)), scheduleAndRules: String(c.scheduleAndRules||'').slice(0,3000), crewNotes: String(c.crewNotes||'').slice(0,1500) };
  const request = String(body.request||'').slice(0,1800);
  const tasks = {
    plan: `Create a practical volunteer shift plan. Include operating summary, roles/coverage, time-based handoffs, briefing checklist, and details to confirm. Allocate the stated volunteer count, keep a floater if feasible, use role labels rather than invented names, flag coverage gaps, and do not change the provided schedule/rules.`,
    ask: `Answer the volunteer's question directly, give numbered next steps, and cite the relevant provided rule/schedule in plain language. If the answer is missing, say so and tell them what role to confirm with; never guess. Question: ${request}`,
    incident: `Create a neutral, factual incident handoff with headings: Summary; Observed facts; Unknown / confirm; Immediate action already taken (if stated); Recommended escalation; Handoff note. Do not infer fault. Safety, medical, security, violence, or harassment concerns require immediate human escalation. Description: ${request}`
  };
  if (!tasks[body.mode]) throw new Error('Unsupported mission mode.');
  return `EVENT CONTEXT (source of truth):\n${JSON.stringify(context,null,2)}\n\nMISSION:\n${tasks[body.mode]}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.HF_TOKEN) return res.status(503).json({ error: 'Hosted model is not configured. Add HF_TOKEN to the deployment environment.' });
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    if (!body || JSON.stringify(body).length > MAX_BODY) return res.status(413).json({ error: 'Request is too large.' });
    if (!body.context || !body.mode) return res.status(400).json({ error: 'Missing mission mode or event context.' });
    const model = process.env.HF_MODEL || 'openai/gpt-oss-20b';
    const upstream = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': `Bearer ${process.env.HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [ { role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: promptFor(body) } ], temperature: 0.25, max_tokens: 1400 })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(502).json({ error: data.error?.message || data.error || `Inference provider returned HTTP ${upstream.status}.` });
    const output = data.choices?.[0]?.message?.content;
    if (!output || typeof output !== 'string') return res.status(502).json({ error: 'The model returned an empty response.' });
    return res.status(200).json({ output, model, provider: 'Hugging Face Inference Providers' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unexpected server error.' });
  }
};

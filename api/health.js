module.exports = async function handler(req, res) {
  const configured = Boolean(process.env.HF_TOKEN);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, mode: configured ? 'huggingface' : 'unconfigured', model: process.env.HF_MODEL || 'openai/gpt-oss-20b' });
};

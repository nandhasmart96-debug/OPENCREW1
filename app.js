const $ = (id) => document.getElementById(id);
const state = { mode: 'plan', lastOutput: '' };
const modes = {
  plan: { button: 'GENERATE SHIFT PLAN', label: '', placeholder: '' },
  ask: { button: 'ASK THE CREW COPILOT', label: 'YOUR QUESTION', placeholder: 'Example: Who handles a duplicate check-in, and what should I do first?' },
  incident: { button: 'STRUCTURE INCIDENT REPORT', label: 'WHAT HAPPENED?', placeholder: 'Record only what you observed: what happened, when, where, people involved, and any immediate action already taken.' }
};

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-card').forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const inputWrap = $('missionInputWrap');
  inputWrap.hidden = mode === 'plan';
  $('missionLabel').textContent = modes[mode].label;
  $('missionInput').placeholder = modes[mode].placeholder;
  $('runBtnText').textContent = modes[mode].button;
  $('missionInput').required = mode !== 'plan';
}

document.querySelectorAll('.mode-card').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));

$('loadDemo').addEventListener('click', () => {
  $('eventName').value = 'Community Tech Meetup';
  $('eventVenue').value = 'Main hall + registration desk';
  $('volunteerCount').value = '12';
  $('eventSchedule').value = '08:00 — volunteer briefing\n09:00 — doors open and registration starts\n10:00 — opening session\n13:00 — lunch distribution\n17:00 — closing and venue reset\nRules: Only the registration lead can resolve duplicate check-ins. Keep emergency exits clear. Lost-and-found items go to the event lead. Escalate medical, safety, security, or harassment concerns to the designated event lead immediately.';
  $('crewNotes').value = 'Assume a mix of experienced and first-time volunteers. Do not assign real names; use role labels. Keep one person available as a floater.';
});

function getContext() {
  return {
    eventName: $('eventName').value.trim(),
    venue: $('eventVenue').value.trim(),
    volunteerCount: Number($('volunteerCount').value),
    scheduleAndRules: $('eventSchedule').value.trim(),
    crewNotes: $('crewNotes').value.trim()
  };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

// Small Markdown renderer for model output. It escapes HTML before formatting.
function renderMarkdown(raw) {
  const escaped = escapeHtml(raw.trim());
  const lines = escaped.split('\n');
  let html = '', listType = null, inCode = false, code = [];
  const closeList = () => { if (listType) { html += `</${listType}>`; listType = null; } };
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      closeList();
      if (inCode) { html += `<pre>${code.join('\n')}</pre>`; code = []; inCode = false; }
      else inCode = true;
      continue;
    }
    if (inCode) { code.push(line); continue; }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (heading) { closeList(); html += `<h3>${heading[1]}</h3>`; }
    else if (bullet || numbered) {
      const type = bullet ? 'ul' : 'ol';
      if (listType !== type) { closeList(); listType = type; html += `<${type}>`; }
      html += `<li>${(bullet || numbered)[1].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</li>`;
    } else if (!line.trim()) { closeList(); }
    else { closeList(); html += `<p>${line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`; }
  }
  closeList();
  if (inCode) html += `<pre>${code.join('\n')}</pre>`;
  return html || '<p>No output was returned by the model.</p>';
}

function setOutput(text, tag = 'MODEL OUTPUT') {
  state.lastOutput = text;
  $('outputBody').className = 'output-body';
  $('outputBody').innerHTML = renderMarkdown(text);
  $('outputTag').textContent = tag;
  $('copyBtn').disabled = !text;
}

function showError(message) {
  state.lastOutput = '';
  $('outputBody').className = 'output-body';
  $('outputBody').innerHTML = `<div class="error-box">${escapeHtml(message)}</div>`;
  $('outputTag').textContent = 'NEEDS ATTENTION';
  $('copyBtn').disabled = true;
}

$('runBtn').addEventListener('click', async () => {
  const context = getContext();
  if (!context.eventName || !context.venue || !context.scheduleAndRules || !context.volunteerCount) {
    showError('Please complete the event name, venue, volunteer count, and schedule/rules before running a mission.');
    return;
  }
  const request = $('missionInput').value.trim();
  if (state.mode !== 'plan' && !request) {
    showError('Add a question or incident description so the model has something specific to work with.');
    $('missionInput').focus();
    return;
  }
  const button = $('runBtn');
  button.disabled = true;
  $('runBtnText').textContent = 'WORKING ON YOUR BRIEF…';
  $('outputTag').textContent = 'GENERATING';
  $('outputBody').className = 'output-body empty-state';
  $('outputBody').innerHTML = '<span class="loading-pulse"></span><div><strong>Working from your event context…</strong><p>The open-weight model is drafting a response. Larger local models may take a little longer.</p></div>';
  $('copyBtn').disabled = true;
  try {
    const response = await fetch('/api/assistant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: state.mode, context, request })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `AI request failed (HTTP ${response.status}).`);
    if (!data.output || typeof data.output !== 'string') throw new Error('The model returned an empty response. Try again or check the model connection.');
    setOutput(data.output, state.mode === 'plan' ? 'SHIFT PLAN GENERATED' : state.mode === 'ask' ? 'COPILOT RESPONSE' : 'INCIDENT DRAFT');
  } catch (error) {
    showError(`${error.message} ${location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'For local use, start Ollama and run “ollama pull qwen2.5:1.5b”. Then restart this app.' : 'For a hosted deployment, configure HF_TOKEN and HF_MODEL in your deployment environment.'}`);
  } finally {
    button.disabled = false;
    $('runBtnText').textContent = modes[state.mode].button;
  }
});

$('copyBtn').addEventListener('click', async () => {
  if (!state.lastOutput) return;
  try {
    await navigator.clipboard.writeText(state.lastOutput);
    $('copyBtn').textContent = '✓ COPIED';
    setTimeout(() => { $('copyBtn').textContent = '▣ COPY OUTPUT'; }, 1400);
  } catch { $('copyBtn').textContent = 'COPY NOT AVAILABLE'; }
});

async function checkBackend() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    $('backendStatus').textContent = data.mode === 'ollama' ? `LOCAL MODEL · ${data.model}` : data.mode === 'huggingface' ? `HOSTED MODEL · ${data.model}` : 'AI BACKEND READY';
    $('backendHint').textContent = data.mode === 'ollama' ? `Local inference via Ollama · ${data.model}. Your prompt goes to the model running on your machine.` : 'Hosted open-weight model via Hugging Face Inference Providers. Keep the token server-side.';
  } catch {
    $('backendStatus').textContent = 'AI BACKEND NOT CHECKED';
    $('backendHint').textContent = 'Local mode uses Ollama. Start the model first, then run the app.';
  }
}
checkBackend();

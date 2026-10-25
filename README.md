# OpenCrew — Open-weight AI for event volunteer operations

**OpenCrew** is a volunteer-operations copilot designed for community tech events, meetups, hackathons, and conferences. It turns a supplied event brief into a draft shift plan, answers crew questions from that brief, and structures incident notes for a human event lead.

## Why this is not just a chatbot wrapper

- **Context-grounded prompting:** the event schedule, rules, venue areas, volunteer count, and crew notes are passed as structured context with explicit anti-hallucination instructions.
- **Three bounded workflows:** shift planning, event FAQ, and incident handoff use different task instructions.
- **Open-weight model support:** local inference uses Qwen2.5 1.5B through Ollama; hosted deployment uses Hugging Face Inference Providers with an open-weight model.
- **Agent skill included:** `skills/opencrew-ops/SKILL.md` packages the operating rules and output contract for reuse in an agent runner.
- **Human escalation by design:** safety-related issues are not treated as decisions for an AI system.

## Run locally (Windows-friendly)

### 1. Install Ollama
Install Ollama from [ollama.com](https://ollama.com/), then open PowerShell or Command Prompt.

### 2. Download the open-weight model

```bash
ollama pull qwen2.5:1.5b
```

The first download is about 1 GB, so allow disk space and network time. The model runs on your own machine after download. The Ollama library lists the model family and available sizes: https://ollama.com/library/qwen2.5

### 3. Start OpenCrew
Install Node.js 18 or newer. In the project folder run:

```bash
node server.js
```

Open **http://localhost:3000** in Chrome. Ollama should be running in the background; if not, launch Ollama and retry.

Optional environment settings:

```powershell
$env:OLLAMA_MODEL="qwen2.5:1.5b"
$env:PORT="3000"
node server.js
```

## Deploy to Vercel (hosted model)

The repository includes `api/assistant.js` and `api/health.js` for Vercel. For the hosted path, set these **Project → Settings → Environment Variables**:

- `HF_TOKEN`: a Hugging Face access token with permission to call Inference Providers
- `HF_MODEL`: `openai/gpt-oss-20b` by default, or another model currently available to your account through Inference Providers

Then deploy the project to Vercel. Do not put the token in `app.js`, HTML, or any public file. Hosted inference may consume paid credits; check your Hugging Face account and provider availability. The hosted route uses Hugging Face's OpenAI-compatible endpoint: https://huggingface.co/docs/inference-providers/en/tasks/chat-completion

The local server and Vercel function are alternative backends; for Vercel, the platform serves the static files and `/api/*` functions. For local use, `server.js` serves the app and forwards inference to Ollama.

## Demo walkthrough

1. Keep the prefilled sample meetup context or enter your own event schedule and rules.
2. Select **Build a shift plan** and generate role coverage and handoffs.
3. Select **Ask the crew copilot** and ask, for example, “Who handles a duplicate check-in?”
4. Select **Triage an incident** and enter a neutral description without unnecessary personal details.
5. Copy the output and have the actual event lead verify it before use.

## Important limitations

- Outputs are drafts, not official assignments or event policy.
- The model may still make mistakes; confirm the details with the event organizer.
- Never use the app as a replacement for emergency services or venue safety procedures.
- The prototype does not store event inputs in a database. In local mode, requests are sent to the Ollama service running on the user's machine. In hosted mode, request text is sent to Hugging Face Inference Providers for generation.

## Tech stack

Vanilla HTML/CSS/JavaScript · Node.js built-in HTTP server · Ollama local inference · Qwen2.5 1.5B open-weight model · optional Vercel serverless route · optional Hugging Face Inference Providers.

## License

MIT for this application code. Model weights retain their own terms; review the selected model's license before redistribution or commercial use.

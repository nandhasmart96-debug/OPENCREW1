# OpenCrew — Project pitch

## One-line idea
An open-weight AI operations copilot that helps event volunteer teams plan shifts, answer brief-specific questions, and create calm, factual incident handoffs.

## Problem
Community events depend on volunteer coordination, yet schedules, venue rules, role assignments, and last-minute instructions are often scattered across messages or remembered informally. First-time volunteers can hesitate when they need an answer quickly, and incident notes may omit the facts an event lead needs to act.

## What we built
OpenCrew takes one event brief (schedule, venue areas, rules, volunteer headcount, and crew notes) and exposes three focused workflows:

1. **Shift planner:** proposes role coverage, time-based handoffs, briefing checklist, and gaps to confirm.
2. **Crew copilot:** answers a volunteer's question against the supplied brief and explicitly says when the answer is missing.
3. **Incident handoff:** turns a short, neutral description into a structured summary with observed facts, unknowns, actions already taken, and suggested escalation.

## Why open-weight AI matters
The core work is language understanding and context-aware generation—not keyword lookup. A compact Qwen2.5 1.5B model can run locally through Ollama, useful for testing without sending prompts to a hosted model. The optional Vercel route uses a hosted open-weight model through Hugging Face Inference Providers. The app also includes a reusable `opencrew-ops` agent skill with bounded modes, output contracts, and safety rules.

## Originality / design choices
- Three constrained operational workflows rather than an unbounded event chatbot.
- The event brief is treated as the source of truth; missing details must be marked for confirmation rather than hallucinated.
- Suggested staffing is distinguished from official assignments, and coverage gaps are surfaced.
- Safety, medical, security, and harassment concerns are routed to human leads and appropriate emergency services; the model is not positioned as an emergency decision-maker.
- A human-readable agent skill makes the operating behavior portable to other compatible agent runners.

## Demo in under two minutes
1. Open the app with the sample community tech meetup.
2. Generate a shift plan for the 12-person crew.
3. Ask who handles a duplicate check-in and observe the answer grounded in the rule.
4. Enter a short incident description and show the structured handoff.
5. Point out where unknowns and human escalation are explicitly called out.

## Current status
Working web UI, local Ollama API integration, optional Hugging Face hosted API route, agent skill, and setup instructions are included. The UI and local API routes were smoke-tested in the build environment. Full model generation must be tested on a machine with Ollama and the model installed, or after adding a valid Hugging Face token for hosted deployment.

## Next milestones
- Add an optional CSV roster import and assignment preview.
- Add organizer-approved FAQ retrieval with citations to source lines.
- Add a shift acknowledgement flow without collecting unnecessary personal data.
- Evaluate hallucination rate on a small set of event-ops test scenarios before broader use.

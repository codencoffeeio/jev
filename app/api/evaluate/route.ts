import { experimental_evaluate, generateText, generateObject } from 'ai';
import {
  SCENARIOS,
  buildComparisonPrompt,
  buildJsonComparisonPrompt,
  buildComparisonSchema,
  type ScenarioId,
} from '../../../lib/scenarios';

const CHAT_MODEL = 'openai/gpt-4o-mini';

// Pricing as listed at https://ai-gateway.vercel.sh/v1/models at the time this was written.
// Illustrative only — check the live endpoint for current numbers.
const PRICING = {
  'typesafe-ai/jev': { input: 0.000000042, output: 0 },
  [CHAT_MODEL]: { input: 0.00000015, output: 0.0000006 },
};

function estimateCost(model: keyof typeof PRICING, inputTokens = 0, outputTokens = 0) {
  const p = PRICING[model];
  return inputTokens * p.input + outputTokens * p.output;
}

export async function POST(request: Request) {
  const body = await request.json();
  const scenarioId = body.scenarioId as ScenarioId;
  const state = typeof body.state === 'string' ? body.state.trim() : '';

  const scenario = SCENARIOS[scenarioId];
  if (!scenario) {
    return Response.json({ error: 'Unknown scenario.' }, { status: 400 });
  }
  if (!state) {
    return Response.json({ error: 'State text is required.' }, { status: 400 });
  }

  const jevStart = performance.now();
  const jevPromise = experimental_evaluate({
    model: 'typesafe-ai/jev',
    state,
    questions: scenario.questions,
  }).then((result) => ({
    latencyMs: Math.round(performance.now() - jevStart),
    answers: result.answers,
    usage: result.usage,
    cost: estimateCost('typesafe-ai/jev', result.usage?.inputTokens, result.usage?.outputTokens),
  }));

  const chatStart = performance.now();
  const chatPromise = generateText({
    model: CHAT_MODEL,
    prompt: buildComparisonPrompt(scenario.questions, state),
  }).then((result) => ({
    latencyMs: Math.round(performance.now() - chatStart),
    text: result.text,
    usage: result.usage,
    cost: estimateCost(CHAT_MODEL, result.usage?.inputTokens, result.usage?.outputTokens),
    model: CHAT_MODEL,
  }));

  const jsonStart = performance.now();
  const jsonPromise = generateObject({
    model: CHAT_MODEL,
    schema: buildComparisonSchema(scenario.questions),
    prompt: buildJsonComparisonPrompt(scenario.questions, state),
  }).then((result) => ({
    latencyMs: Math.round(performance.now() - jsonStart),
    object: result.object,
    usage: result.usage,
    cost: estimateCost(CHAT_MODEL, result.usage?.inputTokens, result.usage?.outputTokens),
    model: CHAT_MODEL,
  }));

  const [jevOutcome, chatOutcome, jsonOutcome] = await Promise.allSettled([
    jevPromise,
    chatPromise,
    jsonPromise,
  ]);

  if (jevOutcome.status === 'rejected') {
    console.error(jevOutcome.reason);
  }
  if (chatOutcome.status === 'rejected') {
    console.error(chatOutcome.reason);
  }
  if (jsonOutcome.status === 'rejected') {
    console.error(jsonOutcome.reason);
  }

  return Response.json({
    jev: jevOutcome.status === 'fulfilled' ? jevOutcome.value : null,
    jevError: jevOutcome.status === 'rejected' ? errorMessage(jevOutcome.reason) : null,
    chat: chatOutcome.status === 'fulfilled' ? chatOutcome.value : null,
    chatError: chatOutcome.status === 'rejected' ? errorMessage(chatOutcome.reason) : null,
    chatJson: jsonOutcome.status === 'fulfilled' ? jsonOutcome.value : null,
    chatJsonError: jsonOutcome.status === 'rejected' ? errorMessage(jsonOutcome.reason) : null,
  });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed.';
}

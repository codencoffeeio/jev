'use client';

import { useState } from 'react';
import { SCENARIOS, type ScenarioId } from '../lib/scenarios';

type ChoiceAnswer = { type: 'choice'; choice: string; probabilities?: Record<string, number> };
type ScoreAnswer = { type: 'score'; score: number; probabilities?: Record<string, number> };
type BooleanAnswer = { type: 'boolean'; probability: number };
type Answer = ChoiceAnswer | ScoreAnswer | BooleanAnswer;

type Usage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };

type EvaluateResponse = {
  jev: { latencyMs: number; answers: Record<string, Answer>; usage: Usage; cost: number } | null;
  jevError: string | null;
  chat: { latencyMs: number; text: string; usage: Usage; cost: number; model: string } | null;
  chatError: string | null;
  chatJson: {
    latencyMs: number;
    object: Record<string, string | number>;
    usage: Usage;
    cost: number;
    model: string;
  } | null;
  chatJsonError: string | null;
};

const scenarioIds = Object.keys(SCENARIOS) as ScenarioId[];

export default function Page() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('support');
  const [text, setText] = useState(SCENARIOS.support.placeholder);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluateResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const scenario = SCENARIOS[scenarioId];

  function handleScenarioChange(next: ScenarioId) {
    setScenarioId(next);
    setText(SCENARIOS[next].placeholder);
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setFetchError(null);
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, state: text }),
      });
      const data: EvaluateResponse = await res.json();
      setResult(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="header">
        <h1>What does Jev actually do?</h1>
        <p>
          Jev doesn&apos;t write text back. It answers typed questions about whatever you give
          it, with a confidence attached. Type something in, pick a scenario, and see the same
          input handled three ways: a chat model writing prose, that same chat model forced into
          JSON, and Jev.
        </p>
      </header>

      <form className="panel" onSubmit={handleSubmit}>
        <div className="scenario-picker">
          {scenarioIds.map((id) => (
            <button
              type="button"
              key={id}
              className={id === scenarioId ? 'scenario-tab active' : 'scenario-tab'}
              onClick={() => handleScenarioChange(id)}
            >
              {SCENARIOS[id].label}
            </button>
          ))}
        </div>
        <p className="blurb">{scenario.blurb}</p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={scenario.placeholder}
        />

        <button type="submit" className="submit" disabled={loading || !text.trim()}>
          {loading ? 'Asking Jev…' : 'Evaluate'}
        </button>
      </form>

      {fetchError && <div className="error">{fetchError}</div>}

      {result && (
        <section className="compare">
          <div className="compare-col">
            <div className="compare-head">
              <span className="compare-title">Chat model, free text</span>
              <span className="compare-sub">{result.chat?.model ?? 'openai/gpt-4o-mini'}</span>
            </div>
            {result.chatError && <div className="error">{result.chatError}</div>}
            {result.chat && (
              <>
                <StatRow latencyMs={result.chat.latencyMs} cost={result.chat.cost} usage={result.chat.usage} />
                <div className="chat-answer">
                  <p className="chat-note">
                    Asked in plain language. This is free text your code would have to read and
                    interpret &mdash; nothing to grab programmatically.
                  </p>
                  <pre className="chat-text">{result.chat.text}</pre>
                </div>
              </>
            )}
          </div>

          <div className="compare-col">
            <div className="compare-head">
              <span className="compare-title">Same model, forced JSON</span>
              <span className="compare-sub">{result.chatJson?.model ?? 'openai/gpt-4o-mini'}</span>
            </div>
            {result.chatJsonError && <div className="error">{result.chatJsonError}</div>}
            {result.chatJson && (
              <>
                <StatRow
                  latencyMs={result.chatJson.latencyMs}
                  cost={result.chatJson.cost}
                  usage={result.chatJson.usage}
                />
                <div className="chat-answer">
                  <p className="chat-note">
                    Same chat model, but forced to fill a schema (<code>generateObject</code>).
                    You get real fields back, but it&apos;s still a language model writing text
                    that looks like JSON &mdash; its &quot;probability&quot; is a number it typed,
                    not something read out of the model&apos;s own math.
                  </p>
                  <pre className="chat-text">{JSON.stringify(result.chatJson.object, null, 2)}</pre>
                </div>
              </>
            )}
          </div>

          <div className="compare-col">
            <div className="compare-head">
              <span className="compare-title">Jev</span>
              <span className="compare-sub">evaluation model</span>
            </div>
            {result.jevError && <div className="error">{result.jevError}</div>}
            {result.jev && (
              <>
                <StatRow latencyMs={result.jev.latencyMs} cost={result.jev.cost} usage={result.jev.usage} />
                <div className="results">
                  {Object.entries(scenario.questions).map(([key, question]) => {
                    const answer = result.jev?.answers?.[key];
                    if (!answer) return null;
                    return (
                      <QuestionCard
                        key={key}
                        title={key}
                        instructions={question.instructions as string}
                        question={question as any}
                        answer={answer}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {result && (
        <div className="raw-wrap">
          <button className="raw-toggle" onClick={() => setShowRaw((v) => !v)} type="button">
            {showRaw ? 'Hide raw response' : 'Show raw response'}
          </button>
          {showRaw && <pre className="raw">{JSON.stringify(result, null, 2)}</pre>}
        </div>
      )}
    </main>
  );
}

function StatRow({
  latencyMs,
  cost,
  usage,
}: {
  latencyMs: number;
  cost: number;
  usage: Usage;
}) {
  const costLabel = cost < 0.00001 ? `$${cost.toExponential(2)}` : `$${cost.toFixed(6)}`;
  return (
    <div className="stat-row">
      <div className="stat">
        <span className="stat-value">{latencyMs}ms</span>
        <span className="stat-label">latency</span>
      </div>
      <div className="stat">
        <span className="stat-value">{costLabel}</span>
        <span className="stat-label">est. cost</span>
      </div>
      <div className="stat">
        <span className="stat-value">{usage?.totalTokens ?? '—'}</span>
        <span className="stat-label">tokens</span>
      </div>
    </div>
  );
}

function QuestionCard({
  title,
  instructions,
  question,
  answer,
}: {
  title: string;
  instructions: string;
  question: { type: string; criteria: unknown };
  answer: Answer;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{title}</span>
        <span className={`card-type card-type-${answer.type}`}>{answer.type}</span>
      </div>
      <p className="card-instructions">{instructions}</p>

      {answer.type === 'choice' && (
        <ChoiceBars
          criteria={question.criteria as Record<string, string>}
          answer={answer}
        />
      )}
      {answer.type === 'score' && (
        <ScoreGauge levels={question.criteria as string[]} answer={answer} />
      )}
      {answer.type === 'boolean' && <BooleanBar answer={answer} />}
    </div>
  );
}

function ChoiceBars({
  criteria,
  answer,
}: {
  criteria: Record<string, string>;
  answer: ChoiceAnswer;
}) {
  return (
    <div className="choice-bars">
      {Object.keys(criteria).map((option) => {
        const p = answer.probabilities?.[option] ?? (option === answer.choice ? 1 : 0);
        const selected = option === answer.choice;
        return (
          <div className="choice-row" key={option}>
            <span className={selected ? 'choice-label selected' : 'choice-label'}>
              {selected ? '✓ ' : ''}
              {option}
            </span>
            <div className="bar-track">
              <div
                className={selected ? 'bar-fill selected' : 'bar-fill'}
                style={{ width: `${Math.round(p * 100)}%` }}
              />
            </div>
            <span className="bar-value">{Math.round(p * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreGauge({ levels, answer }: { levels: string[]; answer: ScoreAnswer }) {
  const max = levels.length - 1;
  const pct = max > 0 ? (answer.score / max) * 100 : 0;
  return (
    <div className="score-gauge">
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${pct}%` }} />
        <div className="gauge-marker" style={{ left: `${pct}%` }} />
      </div>
      <div className="gauge-labels">
        {levels.map((level, i) => (
          <span key={level} className={i === Math.round(answer.score) ? 'active' : ''}>
            {level}
          </span>
        ))}
      </div>
      <div className="gauge-score">{answer.score.toFixed(2)} / {max}</div>
    </div>
  );
}

function BooleanBar({ answer }: { answer: BooleanAnswer }) {
  const pct = Math.round(answer.probability * 100);
  return (
    <div className="boolean-bar">
      <div className="bar-track large">
        <div className="bar-fill boolean" style={{ width: `${pct}%` }} />
      </div>
      <span className="bar-value">{pct}% yes</span>
    </div>
  );
}

import { z } from 'zod';

export type ScenarioId = 'support' | 'resume';

export const SCENARIOS = {
  support: {
    id: 'support' as const,
    label: 'Support ticket triage',
    blurb: 'One customer message, three independent decisions at once.',
    placeholder:
      'I was charged twice for my subscription this month. Please refund the extra charge ASAP, this is really frustrating.',
    questions: {
      department: {
        type: 'choice' as const,
        instructions: 'Which team should handle this?',
        criteria: {
          billing: 'Payments and refunds',
          support: 'Other requests',
        },
      },
      severity: {
        type: 'score' as const,
        instructions: 'How severe is the issue?',
        criteria: ['Cosmetic', 'Workaround exists', 'Blocking; no workaround'],
      },
      requestsRefund: {
        type: 'boolean' as const,
        instructions: 'Is the customer requesting money back?',
      },
    },
  },
  resume: {
    id: 'resume' as const,
    label: 'Resume screening',
    blurb: 'Score independent skill dimensions instead of one blended gut feeling.',
    placeholder:
      'Spent 5 years building backend services in Python. Led a team of 4 engineers on the payments platform. Designed the microservice architecture that replaced our monolith.',
    questions: {
      pythonDepth: {
        type: 'score' as const,
        instructions: "How deep is this candidate's Python expertise?",
        criteria: ['Beginner', 'Intermediate', 'Expert'],
      },
      leadership: {
        type: 'score' as const,
        instructions: 'How much leadership experience does this candidate show?',
        criteria: ['Individual contributor', 'Mentors others', 'Manages a team'],
      },
      systemDesign: {
        type: 'score' as const,
        instructions: 'How much system design experience does this candidate show?',
        criteria: ['Follows existing patterns', 'Designs components', 'Designs whole systems'],
      },
    },
  },
} satisfies Record<ScenarioId, {
  id: ScenarioId;
  label: string;
  blurb: string;
  placeholder: string;
  questions: Record<string, unknown>;
}>;

type QuestionDef = {
  type: 'choice' | 'score' | 'boolean';
  instructions: string;
  criteria?: Record<string, string> | string[];
};

export function buildComparisonPrompt(
  questions: Record<string, QuestionDef>,
  state: string,
): string {
  const lines = Object.entries(questions).map(([key, q], i) => {
    if (q.type === 'choice') {
      const options = Object.keys(q.criteria as Record<string, string>).join(' or ');
      return `${i + 1}. ${q.instructions} (${key}: choose ${options})`;
    }
    if (q.type === 'score') {
      const levels = (q.criteria as string[]).join(' -> ');
      return `${i + 1}. ${q.instructions} (${key}: rate on this scale: ${levels})`;
    }
    return `${i + 1}. ${q.instructions} (${key}: yes or no, with your confidence)`;
  });

  return [
    `Here is some text to evaluate:\n"""${state}"""`,
    '',
    'Answer these questions about it in your own words:',
    ...lines,
  ].join('\n');
}

export function buildJsonComparisonPrompt(
  questions: Record<string, QuestionDef>,
  state: string,
): string {
  const lines = Object.entries(questions).map(([key, q]) => {
    if (q.type === 'choice') {
      const options = Object.keys(q.criteria as Record<string, string>).join("' or '");
      return `- ${key}: ${q.instructions} Must be exactly '${options}'.`;
    }
    if (q.type === 'score') {
      const levels = q.criteria as string[];
      return `- ${key}: ${q.instructions} A number from 0 (${levels[0]}) to ${levels.length - 1} (${levels[levels.length - 1]}).`;
    }
    return `- ${key}: ${q.instructions} A number from 0 to 1: your estimated probability that the answer is yes.`;
  });

  return [
    `Here is some text to evaluate:\n"""${state}"""`,
    '',
    'Fill out this schema based on the text:',
    ...lines,
  ].join('\n');
}

// Zod's `z.enum` needs a nonempty tuple type, not `string[]` — dynamic
// scenario data can't satisfy that statically, so this narrows at runtime.
function toEnumTuple(keys: string[]): [string, ...string[]] {
  return keys as [string, ...string[]];
}

export function buildComparisonSchema(questions: Record<string, QuestionDef>) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, q] of Object.entries(questions)) {
    if (q.type === 'choice') {
      shape[key] = z.enum(toEnumTuple(Object.keys(q.criteria as Record<string, string>)));
    } else if (q.type === 'score') {
      const levels = q.criteria as string[];
      shape[key] = z.number().min(0).max(levels.length - 1);
    } else {
      shape[key] = z.number().min(0).max(1);
    }
  }

  return z.object(shape);
}

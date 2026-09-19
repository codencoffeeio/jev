import { experimental_evaluate } from 'ai';

async function main() {
  const result = await experimental_evaluate({
    model: 'typesafe-ai/jev',
    state: 'I was charged twice for my subscription this month. Please refund the extra charge ASAP.',
    questions: {
      department: {
        type: 'choice',
        instructions: 'Which team should handle this?',
        criteria: {
          billing: 'Payments and refunds',
          support: 'Other requests',
        },
      },
      severity: {
        type: 'score',
        instructions: 'How severe is the issue?',
        criteria: ['Cosmetic', 'Workaround exists', 'Blocking; no workaround'],
      },
      requestsRefund: {
        type: 'boolean',
        instructions: 'Is the customer requesting money back?',
      },
    },
  });

  console.log(JSON.stringify(result.answers, null, 2));
}

main().catch(console.error);

import { generateText } from 'ai';

async function main() {
  const { text } = await generateText({
    model: 'openai/gpt-5.6-sol',
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(text);
}

main().catch(console.error);

import { mkdir, writeFile } from 'node:fs/promises';
import { generatePromptKnowledgeCorpus } from '../src/prompt-knowledge-corpus.js';

const outputPath = new URL('../data/prompt-knowledge-10k.jsonl', import.meta.url);
const corpus = generatePromptKnowledgeCorpus(10000);
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(outputPath, corpus.map(example => JSON.stringify(example)).join('\n') + '\n', 'utf8');
console.log('Generated ' + corpus.length + ' multilingual prompt examples at ' + outputPath.pathname);

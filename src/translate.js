import { chat } from '@forge/llm';
import { LANGUAGES, demoTranslate, detectLanguage } from './dictionary';
import { relevantTerms, applyGlossary } from './glossary';

/**
 * Translation provider chain. Every provider implements:
 *
 *   translate(text, { sourceLang, targetLang, glossary, projectKey })
 *     -> Promise<string | null>        (null = "I can't, try the next one")
 *
 * Order:
 *   1. Forge LLM  — Atlassian-hosted Claude via @forge/llm. Primary engine:
 *      no API key, no data egress. Enabled by the `llm` module in the
 *      manifest.
 *   2. External   — any HTTPS translation API (Google Cloud Translation by
 *      default), used ONLY when SAMBUNGKATA_API_URL / SAMBUNGKATA_API_KEY
 *      Forge environment variables are set. The endpoint host must be
 *      declared under permissions.external.fetch.backend in manifest.yml.
 *   3. Dictionary — built-in demo dictionary. Always available, so a fresh
 *      install still answers; quality is intentionally modest.
 *
 * The result reports which engine produced it so the UI/agent can be honest
 * about quality.
 */

// Model id as used in Atlassian's official Forge LLMs examples. Confirm the
// current ids on the "Forge LLMs models" docs page before switching tiers.
const LLM_MODEL = 'claude-sonnet-4-5-20250929';

function llmText(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => part.text || '').join('');
  return null;
}

async function forgeLlmTranslate(text, { sourceLang, targetLang, glossary }) {
  const targetName = LANGUAGES[targetLang] || targetLang;
  const sourceName = sourceLang ? LANGUAGES[sourceLang] || sourceLang : 'the source language';
  const terms = glossary ? relevantTerms(glossary, text, targetLang) : [];
  const glossaryBlock = terms.length
    ? `\nUse these team glossary translations exactly:\n${terms.map((t) => `- "${t.term}" -> "${t.translation}"`).join('\n')}`
    : '';
  const response = await chat({
    model: LLM_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a precise translation engine for software teams. ' +
          'Translate the user\'s text faithfully, keep issue keys, code, URLs, ' +
          'markdown and placeholders unchanged, and reply with ONLY the translation.',
      },
      {
        role: 'user',
        content: `Translate the following text from ${sourceName} into ${targetName}:${glossaryBlock}\n\n${text}`,
      },
    ],
  });
  const out = llmText(response);
  return out ? out.trim() : null;
}

async function externalTranslate(text, { targetLang }) {
  const url = process.env.SAMBUNGKATA_API_URL;
  const key = process.env.SAMBUNGKATA_API_KEY;
  if (!url || !key) return null;
  // Default shape: Google Cloud Translation v2
  // POST {q, target, format} -> { data: { translations: [{ translatedText }] } }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
    body: JSON.stringify({ q: text, target: targetLang, format: 'text' }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body?.data?.translations?.[0]?.translatedText || null;
}

async function dictionaryTranslate(text, { sourceLang, targetLang, glossary }) {
  const out = demoTranslate(text, sourceLang, targetLang);
  if (out == null) return null;
  return glossary ? applyGlossary(out, glossary, text, targetLang) : out;
}

const PROVIDERS = [
  { name: 'forge-llm', run: forgeLlmTranslate },
  { name: 'external-api', run: externalTranslate },
  { name: 'dictionary', run: dictionaryTranslate },
];

/**
 * Translate `text` into `targetLang` (ISO 639-1). `sourceLang` may be
 * omitted, in which case a small heuristic detector is used for the
 * dictionary path and the LLM is told to detect it itself.
 *
 * Returns { text, sourceLang, targetLang, engine }.
 */
export async function translate(text, { sourceLang, targetLang, glossary, projectKey } = {}) {
  const clean = String(text || '').trim();
  if (!clean) return { text: '', sourceLang: sourceLang || null, targetLang, engine: 'none' };
  if (!targetLang) throw new Error('targetLang is required');
  const detected = sourceLang || detectLanguage(clean);
  if (detected === targetLang) {
    return { text: clean, sourceLang: detected, targetLang, engine: 'none' };
  }
  let lastError;
  for (const provider of PROVIDERS) {
    try {
      const out = await provider.run(clean, { sourceLang: detected, targetLang, glossary, projectKey });
      if (out) return { text: out, sourceLang: detected, targetLang, engine: provider.name };
    } catch (err) {
      // e.g. the llm module is not enabled on this deployment — degrade
      // gracefully to the next provider instead of failing the request.
      lastError = err;
      console.warn(`SambungKata: provider ${provider.name} failed: ${err?.message || err}`);
    }
  }
  throw new Error(`No translation provider could handle ${detected} -> ${targetLang}${lastError ? `: ${lastError.message}` : ''}`);
}

import { kvs } from '@forge/kvs';

/**
 * Per-project glossary, stored in the Forge Key-Value Store.
 *
 * One KVS key per Jira project: `glossary:<projectKey>` (or
 * `glossary:global` when no project is known). Value shape:
 *
 *   { "<source term>": { "<lang>": "<preferred translation>", ... }, ... }
 *
 * Requires the `storage:app` scope in manifest.yml.
 */

const keyFor = (projectKey) => `glossary:${projectKey || 'global'}`;

export async function getGlossary(projectKey) {
  const stored = await kvs.get(keyFor(projectKey));
  return stored && typeof stored === 'object' ? stored : {};
}

export async function saveGlossaryEntry(projectKey, term, lang, translation) {
  const cleanTerm = String(term || '').trim();
  const cleanLang = String(lang || '').trim().toLowerCase();
  const cleanTranslation = String(translation || '').trim();
  if (!cleanTerm || !cleanLang || !cleanTranslation) {
    throw new Error('term, lang and translation are all required');
  }
  const glossary = await getGlossary(projectKey);
  glossary[cleanTerm] = { ...(glossary[cleanTerm] || {}), [cleanLang]: cleanTranslation };
  await kvs.set(keyFor(projectKey), glossary);
  return glossary;
}

export async function deleteGlossaryEntry(projectKey, term, lang) {
  const glossary = await getGlossary(projectKey);
  const entry = glossary[term];
  if (entry) {
    if (lang) {
      delete entry[lang];
      if (Object.keys(entry).length === 0) delete glossary[term];
    } else {
      delete glossary[term];
    }
    await kvs.set(keyFor(projectKey), glossary);
  }
  return glossary;
}

/**
 * Glossary terms that actually occur in `text`, for the given target
 * language — the subset worth injecting into an LLM prompt or applying
 * as post-replacements in dictionary mode.
 */
export function relevantTerms(glossary, text, targetLang) {
  const haystack = ` ${String(text || '').toLowerCase()} `;
  return Object.entries(glossary || {})
    .filter(([term, byLang]) => byLang?.[targetLang] && haystack.includes(term.toLowerCase()))
    .map(([term, byLang]) => ({ term, translation: byLang[targetLang] }));
}

/** Apply glossary choices to already-translated text (dictionary mode). */
export function applyGlossary(text, glossary, sourceText, targetLang) {
  let out = text;
  for (const { term, translation } of relevantTerms(glossary, sourceText, targetLang)) {
    // In dictionary mode the source term may survive untranslated; swap it
    // for the team's preferred rendering wherever it appears verbatim.
    out = out.replace(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), translation);
  }
  return out;
}

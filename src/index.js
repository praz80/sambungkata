import Resolver from '@forge/resolver';
import { translate } from './translate';
import { fetchIssue } from './jira';
import { fetchPage } from './confluence';
import { getGlossary, saveGlossaryEntry, deleteGlossaryEntry } from './glossary';

/**
 * Shared core: translate a fetched Jira issue, honouring the project
 * glossary. Used by both the issue-panel resolver and the Rovo action, so
 * the two surfaces can never drift apart.
 */
async function translateIssueByKey(issueIdOrKey, targetLang) {
  const issue = await fetchIssue(issueIdOrKey);
  const glossary = await getGlossary(issue.projectKey);
  const [summary, description] = await Promise.all([
    translate(issue.summary, { targetLang, glossary, projectKey: issue.projectKey }),
    issue.descriptionText
      ? translate(issue.descriptionText, { targetLang, glossary, projectKey: issue.projectKey })
      : Promise.resolve({ text: '', engine: 'none' }),
  ]);
  return {
    issueKey: issue.key,
    projectKey: issue.projectKey,
    targetLang,
    original: { summary: issue.summary, description: issue.descriptionText },
    translated: { summary: summary.text, description: description.text },
    engine: summary.engine,
  };
}

/* ------------------------------------------------------------------ */
/* UI Kit resolvers (issue panel + Confluence byline)                  */
/* ------------------------------------------------------------------ */

const resolver = new Resolver();

// Payload: { issueId, targetLang }
resolver.define('getIssueTranslation', async (req) => {
  const { issueId, targetLang } = req.payload || {};
  if (!issueId || !targetLang) throw new Error('issueId and targetLang are required');
  return translateIssueByKey(issueId, targetLang);
});

// Payload: { contentId, targetLang }
resolver.define('getPageTranslation', async (req) => {
  const { contentId, targetLang } = req.payload || {};
  if (!contentId || !targetLang) throw new Error('contentId and targetLang are required');
  const page = await fetchPage(contentId);
  const glossary = await getGlossary(null);
  const [title, excerpt] = await Promise.all([
    translate(page.title, { targetLang, glossary }),
    page.excerpt ? translate(page.excerpt, { targetLang, glossary }) : Promise.resolve({ text: '' }),
  ]);
  return {
    contentId: page.id,
    targetLang,
    original: { title: page.title, excerpt: page.excerpt },
    translated: { title: title.text, excerpt: excerpt.text },
    engine: title.engine,
  };
});

// Payload: { projectKey }
resolver.define('getGlossary', async (req) => {
  return getGlossary(req.payload?.projectKey);
});

// Payload: { projectKey, term, lang, translation }
resolver.define('saveGlossaryEntry', async (req) => {
  const { projectKey, term, lang, translation } = req.payload || {};
  return saveGlossaryEntry(projectKey, term, lang, translation);
});

// Payload: { projectKey, term, lang? }
resolver.define('deleteGlossaryEntry', async (req) => {
  const { projectKey, term, lang } = req.payload || {};
  return deleteGlossaryEntry(projectKey, term, lang);
});

export const handler = resolver.getDefinitions();

/* ------------------------------------------------------------------ */
/* Rovo action handlers                                                */
/*                                                                     */
/* Called as fn(payload, context): payload holds the manifest-declared */
/* inputs plus payload.context (deterministic product context, e.g.    */
/* payload.context.jira.issueKey). Return any string or JSON object —  */
/* the agent turns it into a natural-language reply.                   */
/* ------------------------------------------------------------------ */

// Action: translate-text — inputs { text, targetLanguage, sourceLanguage? }
export async function translateTextAction(payload) {
  const { text, targetLanguage, sourceLanguage } = payload || {};
  if (!text || !targetLanguage) {
    return { error: 'Both "text" and "targetLanguage" are required.' };
  }
  const result = await translate(text, {
    sourceLang: sourceLanguage || undefined,
    targetLang: String(targetLanguage).toLowerCase(),
  });
  return {
    original: text,
    translatedText: result.text,
    sourceLanguage: result.sourceLang,
    targetLanguage: result.targetLang,
    engine: result.engine,
  };
}

// Action: translate-issue — inputs { issueKey, targetLanguage }
export async function translateIssueAction(payload) {
  const { targetLanguage } = payload || {};
  // LLM-extracted inputs can be wrong; prefer a plausible input key, else
  // fall back to the deterministic context of the surface the user is on.
  const inputKey = payload?.issueKey;
  const contextKey = payload?.context?.jira?.issueKey;
  const issueKey =
    typeof inputKey === 'string' && /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(inputKey.trim())
      ? inputKey.trim()
      : contextKey;
  if (!issueKey || !targetLanguage) {
    return { error: 'A Jira issue key and a target language are required.' };
  }
  const result = await translateIssueByKey(issueKey, String(targetLanguage).toLowerCase());
  return {
    issueKey: result.issueKey,
    targetLanguage: result.targetLang,
    originalSummary: result.original.summary,
    translatedSummary: result.translated.summary,
    translatedDescription: result.translated.description,
    engine: result.engine,
  };
}

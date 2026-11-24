import api, { route } from '@forge/api';

/** Strip Confluence storage-format HTML down to a short plain-text excerpt. */
export function excerptFromStorage(html, maxChars = 600) {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

/**
 * Fetch a Confluence page's title and a plain-text excerpt of its body.
 * Runs as the invoking user. Uses the v1 content REST endpoint because it
 * returns title + storage body in a single call (see FORGE-NOTES.md §5).
 */
export async function fetchPage(contentId) {
  const res = await api
    .asUser()
    .requestConfluence(route`/wiki/rest/api/content/${contentId}?expand=body.storage`, {
      headers: { Accept: 'application/json' },
    });
  if (!res.ok) {
    throw new Error(`Confluence returned ${res.status} for content ${contentId}`);
  }
  const page = await res.json();
  return {
    id: page.id,
    title: page.title || '',
    excerpt: excerptFromStorage(page.body?.storage?.value),
  };
}

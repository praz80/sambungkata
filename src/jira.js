import api, { route } from '@forge/api';

/** Flatten an Atlassian Document Format (ADF) tree into plain text. */
export function adfToText(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  const blockTypes = new Set([
    'paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock', 'rule',
  ]);
  const inner = (node.content || []).map(adfToText).join('');
  return blockTypes.has(node.type) ? `${inner}\n` : inner;
}

/**
 * Fetch an issue's summary, description (as plain text) and project key.
 * Runs as the invoking user, so Jira permissions are honoured.
 * Requires the `read:jira-work` scope.
 */
export async function fetchIssue(issueIdOrKey) {
  const res = await api
    .asUser()
    .requestJira(route`/rest/api/3/issue/${issueIdOrKey}?fields=summary,description,project`, {
      headers: { Accept: 'application/json' },
    });
  if (!res.ok) {
    throw new Error(`Jira returned ${res.status} for issue ${issueIdOrKey}`);
  }
  const issue = await res.json();
  const description = issue.fields?.description;
  return {
    key: issue.key,
    projectKey: issue.fields?.project?.key || null,
    summary: issue.fields?.summary || '',
    descriptionText: typeof description === 'string' ? description : adfToText(description).trim(),
  };
}

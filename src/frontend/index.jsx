import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Heading,
  Inline,
  Label,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Text,
  Textfield,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const LANGUAGE_OPTIONS = [
  { label: 'Indonesian (Bahasa Indonesia)', value: 'id' },
  { label: 'Javanese (Basa Jawa)', value: 'jv' },
  { label: 'English', value: 'en' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Portuguese', value: 'pt' },
];

const GlossaryEditor = ({ projectKey }) => {
  const [glossary, setGlossary] = useState({});
  const [term, setTerm] = useState('');
  const [lang, setLang] = useState('id');
  const [translation, setTranslation] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async (key) => {
    try {
      setGlossary((await invoke('getGlossary', { projectKey: key })) || {});
    } catch (e) {
      // Glossary is best-effort UI; translation still works without it.
    }
  };

  useEffect(() => {
    refresh(projectKey);
  }, [projectKey]);

  const save = async () => {
    if (!term.trim() || !translation.trim()) return;
    setSaving(true);
    try {
      const updated = await invoke('saveGlossaryEntry', {
        projectKey,
        term: term.trim(),
        lang,
        translation: translation.trim(),
      });
      setGlossary(updated || {});
      setTerm('');
      setTranslation('');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entryTerm, entryLang) => {
    const updated = await invoke('deleteGlossaryEntry', {
      projectKey,
      term: entryTerm,
      lang: entryLang,
    });
    setGlossary(updated || {});
  };

  const rows = Object.entries(glossary).flatMap(([entryTerm, byLang]) =>
    Object.entries(byLang || {}).map(([entryLang, value]) => ({ entryTerm, entryLang, value })),
  );

  return (
    <Stack space="space.100">
      <Heading size="small">Project glossary{projectKey ? ` (${projectKey})` : ''}</Heading>
      <Text>Terms the translator must always render the team's way.</Text>
      {rows.length === 0 && <Text>No glossary entries yet.</Text>}
      {rows.map((row) => (
        <Inline key={`${row.entryTerm}:${row.entryLang}`} space="space.100" alignBlock="center">
          <Text>
            <strong>{row.entryTerm}</strong> → [{row.entryLang}] {row.value}
          </Text>
          <Button appearance="subtle" onClick={() => remove(row.entryTerm, row.entryLang)}>
            Remove
          </Button>
        </Inline>
      ))}
      <Label labelFor="glossary-term">Term</Label>
      <Textfield id="glossary-term" value={term} onChange={(e) => setTerm(e.target.value)} />
      <Label labelFor="glossary-lang">Language</Label>
      <Select
        id="glossary-lang"
        options={LANGUAGE_OPTIONS}
        defaultValue={LANGUAGE_OPTIONS[0]}
        onChange={(selection) => setLang((Array.isArray(selection) ? selection[0] : selection)?.value || 'id')}
      />
      <Label labelFor="glossary-translation">Preferred translation</Label>
      <Textfield
        id="glossary-translation"
        value={translation}
        onChange={(e) => setTranslation(e.target.value)}
      />
      <Button appearance="primary" isDisabled={saving} onClick={save}>
        Add glossary entry
      </Button>
    </Stack>
  );
};

const App = () => {
  const context = useProductContext();
  const issueId = context?.extension?.issue?.id;
  const contextProjectKey = context?.extension?.project?.key || null;

  const [targetLang, setTargetLang] = useState('id');
  const [projectKey, setProjectKey] = useState(contextProjectKey);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const translateIssue = async () => {
    if (!issueId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await invoke('getIssueTranslation', { issueId, targetLang });
      setResult(data);
      if (data?.projectKey) setProjectKey(data.projectKey);
    } catch (e) {
      setError(e?.message || 'Translation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack space="space.200">
      <Box>
        <Label labelFor="target-lang">Translate this issue into</Label>
        <Select
          id="target-lang"
          options={LANGUAGE_OPTIONS}
          defaultValue={LANGUAGE_OPTIONS[0]}
          onChange={(selection) =>
            setTargetLang((Array.isArray(selection) ? selection[0] : selection)?.value || 'id')
          }
        />
      </Box>
      <Button appearance="primary" isDisabled={loading || !issueId} onClick={translateIssue}>
        Translate issue
      </Button>
      {loading && <Spinner />}
      {error && (
        <SectionMessage title="Something went wrong" appearance="error">
          <Text>{error}</Text>
        </SectionMessage>
      )}
      {result && (
        <Stack space="space.100">
          <Heading size="small">{result.translated.summary}</Heading>
          {result.translated.description ? <Text>{result.translated.description}</Text> : null}
          <Text>
            Engine: {result.engine}
            {result.engine === 'dictionary'
              ? ' (demo dictionary — enable the Forge LLM module or set an API provider for full quality)'
              : ''}
          </Text>
        </Stack>
      )}
      <GlossaryEditor projectKey={projectKey} />
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

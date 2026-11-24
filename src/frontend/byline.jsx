import React, { useState } from 'react';
import ForgeReconciler, {
  Button,
  Label,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Text,
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

const App = () => {
  const context = useProductContext();
  const contentId = context?.extension?.content?.id;

  const [targetLang, setTargetLang] = useState('id');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const translatePage = async () => {
    if (!contentId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await invoke('getPageTranslation', { contentId, targetLang }));
    } catch (e) {
      setError(e?.message || 'Translation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack space="space.100">
      <Label labelFor="byline-target-lang">Translate page title & summary into</Label>
      <Select
        id="byline-target-lang"
        options={LANGUAGE_OPTIONS}
        defaultValue={LANGUAGE_OPTIONS[0]}
        onChange={(selection) =>
          setTargetLang((Array.isArray(selection) ? selection[0] : selection)?.value || 'id')
        }
      />
      <Button appearance="primary" isDisabled={loading || !contentId} onClick={translatePage}>
        Translate
      </Button>
      {loading && <Spinner />}
      {error && (
        <SectionMessage title="Something went wrong" appearance="error">
          <Text>{error}</Text>
        </SectionMessage>
      )}
      {result && (
        <Stack space="space.050">
          <Text>
            <strong>{result.translated.title}</strong>
          </Text>
          {result.translated.excerpt ? <Text>{result.translated.excerpt}</Text> : null}
          <Text>Engine: {result.engine}</Text>
        </Stack>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

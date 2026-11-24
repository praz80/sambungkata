/**
 * Built-in demo dictionary — the zero-configuration fallback translator.
 *
 * It exists so a fresh install (no LLM module enabled yet, no API keys)
 * still responds sensibly. Coverage is deliberately small: common Jira /
 * standup vocabulary between English, Indonesian and Javanese. Anything it
 * doesn't know is passed through unchanged, and the result is labelled
 * `engine: 'dictionary'` so callers can tell it apart from a real MT result.
 */

export const LANGUAGES = {
  en: 'English',
  id: 'Indonesian (Bahasa Indonesia)',
  jv: 'Javanese (Basa Jawa)',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
};

// Whole-phrase entries, keyed by lower-cased source text.
const PHRASES = {
  en: {
    id: {
      'sprint planning moved to friday': 'perencanaan sprint pindah ke hari jumat',
      'the build is broken': 'build-nya rusak',
      'please review my pull request': 'tolong tinjau pull request saya',
      'blocked by': 'terhalang oleh',
      'ready for testing': 'siap untuk pengujian',
    },
    jv: {
      'sprint planning moved to friday': 'rancangan sprint pindhah menyang dina jumat',
      'please review my pull request': 'tulung dipriksa pull request kula',
      'ready for testing': 'siap kanggo pengujian',
    },
  },
  id: {
    en: {
      'perencanaan sprint pindah ke hari jumat': 'sprint planning moved to friday',
      'tolong tinjau pull request saya': 'please review my pull request',
      'siap untuk pengujian': 'ready for testing',
    },
  },
};

// Word-by-word maps, keyed by lower-cased source word.
const WORDS = {
  en: {
    id: {
      the: '', a: '', an: '', is: 'adalah', are: 'adalah', was: 'tadi',
      issue: 'isu', bug: 'bug', fix: 'perbaikan', fixed: 'diperbaiki',
      sprint: 'sprint', planning: 'perencanaan', meeting: 'rapat',
      moved: 'pindah', to: 'ke', friday: 'jumat', monday: 'senin',
      tuesday: 'selasa', wednesday: 'rabu', thursday: 'kamis',
      please: 'tolong', review: 'tinjau', my: 'saya', your: 'anda',
      ready: 'siap', for: 'untuk', testing: 'pengujian', done: 'selesai',
      blocked: 'terhalang', by: 'oleh', and: 'dan', or: 'atau',
      not: 'tidak', this: 'ini', that: 'itu', we: 'kami', i: 'saya',
      need: 'perlu', needs: 'perlu', update: 'pembaruan', updated: 'diperbarui',
      release: 'rilis', deploy: 'deploy', failed: 'gagal', works: 'berhasil',
      broken: 'rusak', task: 'tugas', story: 'cerita', user: 'pengguna',
    },
    jv: {
      the: '', a: '', an: '', is: 'iku', are: 'iku',
      issue: 'isu', sprint: 'sprint', planning: 'rancangan',
      moved: 'pindhah', to: 'menyang', friday: 'jumat', monday: 'senin',
      please: 'tulung', my: 'kula', ready: 'siap', for: 'kanggo',
      testing: 'pengujian', done: 'rampung', and: 'lan', this: 'iki',
      we: 'awake dhewe', i: 'kula', need: 'butuh', works: 'mlaku',
      task: 'tugas', user: 'pangguna',
    },
  },
  id: {
    en: {
      adalah: 'is', isu: 'issue', perbaikan: 'fix', diperbaiki: 'fixed',
      perencanaan: 'planning', rapat: 'meeting', pindah: 'moved',
      ke: 'to', jumat: 'friday', senin: 'monday', tolong: 'please',
      tinjau: 'review', saya: 'my', siap: 'ready', untuk: 'for',
      pengujian: 'testing', selesai: 'done', terhalang: 'blocked',
      oleh: 'by', dan: 'and', tidak: 'not', ini: 'this', kami: 'we',
      perlu: 'need', pembaruan: 'update', rilis: 'release',
      gagal: 'failed', berhasil: 'works', rusak: 'broken',
      tugas: 'task', pengguna: 'user',
    },
  },
};

function preserveCase(source, translated) {
  if (!translated) return translated;
  if (source.charAt(0) === source.charAt(0).toUpperCase() && source.charAt(0) !== source.charAt(0).toLowerCase()) {
    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }
  return translated;
}

/**
 * Translate with the demo dictionary. Word-by-word with punctuation kept.
 * Returns the translated string, or null when no map exists for the pair
 * (so the caller can decide how to degrade).
 */
export function demoTranslate(text, sourceLang, targetLang) {
  if (!text || sourceLang === targetLang) return text;
  const phrases = PHRASES[sourceLang]?.[targetLang];
  const lower = text.trim().toLowerCase();
  if (phrases?.[lower]) return preserveCase(text.trim(), phrases[lower]);

  const words = WORDS[sourceLang]?.[targetLang];
  if (!words) return null;
  return text
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token) || token === '') return token;
      const match = token.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}'-]+)([^\p{L}\p{N}]*)$/u);
      if (!match) return token;
      const [, pre, core, post] = match;
      const hit = words[core.toLowerCase()];
      if (hit === undefined) return token;
      return pre + preserveCase(core, hit) + post;
    })
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Very small heuristic detector covering the languages we ship demos for. */
export function detectLanguage(text) {
  const sample = ` ${String(text || '').toLowerCase()} `;
  const counts = {
    id: [' yang ', ' dan ', ' adalah ', ' untuk ', ' dengan ', ' tidak ', ' saya '].filter((w) => sample.includes(w)).length,
    jv: [' sing ', ' lan ', ' kanggo ', ' menyang ', ' kula ', ' iki '].filter((w) => sample.includes(w)).length,
    en: [' the ', ' is ', ' and ', ' for ', ' with ', ' please '].filter((w) => sample.includes(w)).length,
  };
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'en';
}

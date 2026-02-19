import { useEditorStore } from '../../stores/editorStore';
import { codeTemplates } from '../../services/code-editor-logic';
import { isExecutable } from '../../services/code-executor';

const LANGUAGES = Object.keys(codeTemplates);

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  kotlin: 'Kotlin',
  cpp: 'C++',
  c: 'C',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  swift: 'Swift',
  scala: 'Scala',
  php: 'PHP',
  sql: 'SQL',
};

export default function LanguageSelector() {
  const language = useEditorStore((s) => s.language);
  const setLanguage = useEditorStore((s) => s.setLanguage);

  return (
    <div id="languageSelector">
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        aria-label="Select language"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {isExecutable(lang) ? '\u25B6 ' : ''}{LANGUAGE_LABELS[lang] || lang}
          </option>
        ))}
      </select>
    </div>
  );
}

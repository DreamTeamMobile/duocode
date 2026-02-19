import { useRef, useCallback, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-sql';
import { useEditorStore } from '../../stores/editorStore';
import { getPrismLanguage, dedentLines } from '../../services/code-editor-logic';
import { calculateTextOperation } from '../../services/ot-engine';
import RemoteCursors from './RemoteCursors';

export default function CodeEditor() {
  const code = useEditorStore((s) => s.code);
  const language = useEditorStore((s) => s.language);
  const setCode = useEditorStore((s) => s.setCode);
  const applyLocalOperation = useEditorStore((s) => s.applyLocalOperation);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const prevCodeRef = useRef(code);

  const handleInput = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newCode = e.target.value;
      const oldCode = prevCodeRef.current;

      if (newCode !== oldCode) {
        calculateTextOperation(oldCode, newCode);
        applyLocalOperation();
        setCode(newCode);
        prevCodeRef.current = newCode;
      }
    },
    [setCode, applyLocalOperation],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = inputRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const oldCode = textarea.value;

        if (e.shiftKey) {
          // Shift+Tab: dedent selected lines
          const { text: newCode, newStart, newEnd } = dedentLines(oldCode, start, end);
          if (newCode !== oldCode) {
            calculateTextOperation(oldCode, newCode);
            applyLocalOperation();
            setCode(newCode);
            prevCodeRef.current = newCode;

            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.selectionStart = newStart;
                inputRef.current.selectionEnd = newEnd;
              }
            });
          }
        } else {
          // Tab: insert 4 spaces
          const spaces = '    ';
          const newCode = oldCode.substring(0, start) + spaces + oldCode.substring(end);

          calculateTextOperation(oldCode, newCode);
          applyLocalOperation();
          setCode(newCode);
          prevCodeRef.current = newCode;

          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.selectionStart = start + spaces.length;
              inputRef.current.selectionEnd = start + spaces.length;
            }
          });
        }
      }
    },
    [setCode, applyLocalOperation],
  );

  // Keep prevCodeRef in sync with external code changes (remote operations)
  useEffect(() => {
    prevCodeRef.current = code;
  }, [code]);

  // Sync scroll between textarea and highlight overlay
  const handleScroll = useCallback(() => {
    if (inputRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = inputRef.current.scrollTop;
      highlightRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  }, []);

  // Produce highlighted HTML
  const prismLang = getPrismLanguage(language);
  const grammar = Prism.languages[prismLang];
  const highlighted = grammar
    ? Prism.highlight(code, grammar, prismLang)
    : escapeHtml(code);

  return (
    <div id="codeEditorWrapper">
      <textarea
        id="codeInput"
        ref={inputRef}
        value={code}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-label="Code editor"
      />
      <pre id="codeHighlight" ref={highlightRef} aria-hidden="true">
        <code
          id="codeOutput"
          className={`language-${prismLang}`}
          dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
        />
      </pre>
      <RemoteCursors textareaRef={inputRef} />
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

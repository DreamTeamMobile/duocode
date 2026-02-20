import { useRef, useCallback, useEffect, useLayoutEffect, ChangeEvent, KeyboardEvent } from 'react';
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
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-sql';
import { useEditorStore } from '../../stores/editorStore';
import { useExecutionStore } from '../../stores/executionStore';
import { getPrismLanguage, dedentLines, getLeadingWhitespace } from '../../services/code-editor-logic';
import { isExecutable } from '../../services/code-executor';
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
  const pendingCursorRef = useRef<{ start: number; end: number } | null>(null);

  // Set cursor position after React re-renders (runs before browser paint)
  useLayoutEffect(() => {
    if (pendingCursorRef.current && inputRef.current) {
      inputRef.current.selectionStart = pendingCursorRef.current.start;
      inputRef.current.selectionEnd = pendingCursorRef.current.end;
      pendingCursorRef.current = null;
    }
  });

  const applyEdit = useCallback(
    (oldCode: string, newCode: string, cursorStart: number, cursorEnd: number) => {
      calculateTextOperation(oldCode, newCode);
      applyLocalOperation();
      setCode(newCode);
      prevCodeRef.current = newCode;
      pendingCursorRef.current = { start: cursorStart, end: cursorEnd };
    },
    [setCode, applyLocalOperation],
  );

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
      // Ctrl/Cmd + Enter: run code
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const lang = useEditorStore.getState().language;
        if (isExecutable(lang)) {
          const run = useExecutionStore.getState().runCode;
          run?.();
        }
        return;
      }

      const textarea = inputRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const oldCode = textarea.value;

      if (e.key === 'Tab') {
        e.preventDefault();

        if (e.shiftKey) {
          // Shift+Tab: dedent selected lines
          const { text: newCode, newStart, newEnd } = dedentLines(oldCode, start, end);
          if (newCode !== oldCode) {
            applyEdit(oldCode, newCode, newStart, newEnd);
          }
        } else {
          // Tab: insert 4 spaces
          const spaces = '    ';
          const newCode = oldCode.substring(0, start) + spaces + oldCode.substring(end);
          applyEdit(oldCode, newCode, start + spaces.length, start + spaces.length);
        }
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Enter: auto-indent — new line starts at same indentation as current line
        e.preventDefault();
        const indent = getLeadingWhitespace(oldCode, start);
        const insertion = '\n' + indent;
        const newCode = oldCode.substring(0, start) + insertion + oldCode.substring(end);
        const newCursor = start + insertion.length;
        applyEdit(oldCode, newCode, newCursor, newCursor);
      }
    },
    [applyEdit],
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

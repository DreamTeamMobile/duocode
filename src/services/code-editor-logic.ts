// Code Editor Logic — templates, syntax highlighting helpers, scroll sync utilities
// Pure, framework-agnostic functions extracted from app.js

export interface CursorPosition {
    line: number;
    column: number;
    top: number;
    left: number;
}

export interface SelectionRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

// Sample code templates for different languages
export const codeTemplates: Record<string, string> = {
    javascript: '// Write your code here\nconsole.log(\'Hello, World!\');',
    typescript: '// Write your code here\nconst message: string = \'Hello, World!\';\nconsole.log(message);',
    python: '# Write your code here\nprint(\'Hello, World!\')',
    java: '// Write your code here\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
    kotlin: '// Write your code here\nfun main() {\n    println("Hello, World!")\n}',
    cpp: '// Write your code here\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
    c: '// Write your code here\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
    csharp: '// Write your code here\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}',
    go: '// Write your code here\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}',
    rust: '// Write your code here\nfn main() {\n    println!("Hello, World!");\n}',
    ruby: '# Write your code here\nputs "Hello, World!"',
    swift: '// Write your code here\nimport Foundation\n\nprint("Hello, World!")',
    scala: '// Write your code here\nobject Main extends App {\n    println("Hello, World!")\n}',
    php: '<?php\n// Write your code here\necho "Hello, World!";',
    sql: '-- Write your SQL query here\nSELECT * FROM users WHERE id = 1;'
};

// Map language identifiers to Prism grammar names
// Currently all supported languages use the same identifier,
// but this provides an extension point for future mismatches
export function getPrismLanguage(language: string): string {
    return language;
}

// Calculate cursor position in the editor from a character offset
// Returns { line, column, top, left } relative to the editor
export function calculateCursorPosition(
    text: string,
    offset: number,
    lineHeight: number,
    paddingTop: number,
    paddingLeft: number,
    charWidth: number,
    scrollTop: number,
    scrollLeft: number
): CursorPosition {
    const textBeforeCursor = text.substring(0, offset);
    const lines = textBeforeCursor.split('\n');
    const lineNumber = lines.length - 1;
    const columnNumber = lines[lines.length - 1].length;

    const top = paddingTop + (lineNumber * lineHeight) - scrollTop;
    const left = paddingLeft + (columnNumber * charWidth) - scrollLeft;

    return { line: lineNumber, column: columnNumber, top, left };
}

// Check if a cursor position is visible within the editor viewport
export function isCursorVisible(top: number, left: number, visibleHeight: number, visibleWidth: number): boolean {
    return top >= -20 && top <= visibleHeight && left >= 0 && left <= visibleWidth;
}

// Calculate selection rectangles for a text range in a monospace editor
// Returns an array of { top, left, width, height } rectangles (one per line)
export function calculateSelectionRects(
    text: string,
    selStart: number,
    selEnd: number,
    lineHeight: number,
    paddingTop: number,
    paddingLeft: number,
    charWidth: number,
    scrollTop: number,
    scrollLeft: number,
    editorWidth: number
): SelectionRect[] {
    const textBeforeSelStart = text.substring(0, selStart);
    const selectedText = text.substring(selStart, selEnd);

    const startLines = textBeforeSelStart.split('\n');
    const startLineNum = startLines.length - 1;
    const startCol = startLines[startLines.length - 1].length;

    const selectionLines = selectedText.split('\n');
    const rects: SelectionRect[] = [];

    for (let i = 0; i < selectionLines.length; i++) {
        const lineNum = startLineNum + i;
        const col = i === 0 ? startCol : 0;
        const lineText = selectionLines[i];

        const rectTop = paddingTop + (lineNum * lineHeight) - scrollTop;
        const rectLeft = paddingLeft + (col * charWidth) - scrollLeft;
        const rectWidth = i < selectionLines.length - 1
            ? editorWidth - rectLeft
            : lineText.length * charWidth;

        rects.push({
            top: rectTop,
            left: rectLeft,
            width: Math.max(rectWidth, charWidth),
            height: lineHeight,
        });
    }

    return rects;
}

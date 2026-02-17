/**
 * PDF Export Service
 *
 * Generates a PDF report of the current interview session including
 * session metadata, code, diagram snapshot, and chat messages.
 */

import { jsPDF } from 'jspdf';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Participant {
  name?: string;
  isHost?: boolean;
}

export interface ChatMessage {
  role?: string;
  text?: string;
  content?: string;
  senderName?: string;
  sender?: string;
  epochTime?: number;
  timestamp?: string;
}

export interface PDFExportData {
  sessionId: string;
  peerName: string;
  participants: Record<string, Participant> | null;
  sessionStartTime: number | null;
  code: string;
  language: string;
  messages: ChatMessage[];
  canvasElement: HTMLCanvasElement | null;
}

type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'csharp' | 'go' | 'rust';
type RGBColor = [number, number, number];

interface RenderedTextImage {
  dataUrl: string;
  width: number;
  height: number;
  lines: string[];
}

// ── Unicode helpers ──────────────────────────────────────────────────

function containsNonASCII(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

function renderTextAsImage(
  text: string,
  fontSize: number,
  fontFamily: string,
  maxWidth: number
): RenderedTextImage {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  ctx.font = `${fontSize}px ${fontFamily}`;

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.3;
  const textWidth = Math.min(
    maxWidth,
    Math.max(...lines.map((l) => ctx.measureText(l).width))
  );
  canvas.width = Math.ceil(textWidth) + 4;
  canvas.height = Math.ceil(lines.length * lineHeight) + 4;

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  lines.forEach((line, i) => {
    ctx.fillText(line, 2, 2 + i * lineHeight);
  });

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    lines,
  };
}

interface AddTextOptions {
  fontSize?: number;
  fontFamily?: string;
  maxWidth?: number;
}

function addTextToPDF(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options: AddTextOptions = {}
): number {
  const { fontSize = 9, fontFamily = 'Arial, sans-serif', maxWidth = 150 } = options;

  if (containsNonASCII(text)) {
    const img = renderTextAsImage(text, fontSize * 2, fontFamily, maxWidth * 2);
    doc.addImage(img.dataUrl, 'PNG', x, y - 1, img.width / 2 / 2.83, img.height / 2 / 2.83);
    return img.lines.length * (fontSize * 0.4);
  } else {
    doc.text(text, x, y);
    return fontSize * 0.4;
  }
}

// ── Syntax highlighting keywords ────────────────────────────────────

const KEYWORDS: Record<SupportedLanguage, string[]> = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new', 'this', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined'],
  typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new', 'this', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined', 'interface', 'type', 'enum', 'implements', 'extends', 'private', 'public', 'protected'],
  python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'raise', 'with', 'lambda', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'pass', 'break', 'continue', 'yield', 'async', 'await'],
  java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'new', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'throw', 'throws', 'finally', 'static', 'final', 'void', 'int', 'boolean', 'String', 'true', 'false', 'null', 'this', 'super', 'import', 'package'],
  cpp: ['int', 'void', 'char', 'float', 'double', 'bool', 'class', 'struct', 'public', 'private', 'protected', 'virtual', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'delete', 'try', 'catch', 'throw', 'const', 'static', 'true', 'false', 'nullptr', 'include', 'using', 'namespace', 'std', 'template', 'typename'],
  csharp: ['public', 'private', 'protected', 'class', 'interface', 'struct', 'enum', 'new', 'return', 'if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'throw', 'finally', 'static', 'void', 'int', 'bool', 'string', 'var', 'true', 'false', 'null', 'this', 'base', 'using', 'namespace', 'async', 'await'],
  go: ['func', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'break', 'continue', 'defer', 'select', 'true', 'false', 'nil', 'make', 'new', 'len', 'cap', 'append'],
  rust: ['fn', 'let', 'mut', 'const', 'struct', 'enum', 'impl', 'trait', 'pub', 'mod', 'use', 'return', 'if', 'else', 'for', 'while', 'loop', 'match', 'break', 'continue', 'true', 'false', 'self', 'Self', 'super', 'crate', 'async', 'await', 'move', 'ref', 'where', 'dyn', 'Box', 'Vec', 'String', 'Option', 'Result', 'Some', 'None', 'Ok', 'Err'],
};

const COMMENT_MARKERS: Record<SupportedLanguage, string[]> = {
  javascript: ['//', '/*', '*/'],
  typescript: ['//', '/*', '*/'],
  python: ['#'],
  java: ['//', '/*', '*/'],
  cpp: ['//', '/*', '*/'],
  csharp: ['//', '/*', '*/'],
  go: ['//', '/*', '*/'],
  rust: ['//', '/*', '*/'],
};

const COLORS: Record<string, RGBColor> = {
  keyword: [0, 0, 139],
  string: [163, 21, 21],
  comment: [0, 128, 0],
  number: [9, 134, 88],
  function: [121, 94, 38],
  default: [0, 0, 0],
};

function renderCodeLineWithColors(
  doc: jsPDF,
  line: string,
  x: number,
  y: number,
  language: string
): void {
  const lang = language as SupportedLanguage;
  const commentMarkers = COMMENT_MARKERS[lang] || COMMENT_MARKERS.javascript;
  const trimmedLine = line.trim();
  const isComment = commentMarkers.some((marker) => trimmedLine.startsWith(marker));

  if (isComment) {
    doc.setTextColor(...COLORS.comment);
    doc.setFont('courier', 'normal');
    doc.text(line, x, y);
    doc.setTextColor(0, 0, 0);
    return;
  }

  const langKeywords = KEYWORDS[lang] || KEYWORDS.javascript;
  const tokens = line.split(/(\s+|"[^"]*"|'[^']*'|`[^`]*`|\b)/g).filter((t) => t !== '');

  let currentX = x;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  const charWidth = 2.16;

  tokens.forEach((token) => {
    let color = COLORS.default;

    if (/^\s+$/.test(token)) {
      currentX += token.length * charWidth;
      return;
    } else if (/^["'`].*["'`]$/.test(token)) {
      color = COLORS.string;
    } else if (/^\d+\.?\d*$/.test(token)) {
      color = COLORS.number;
    } else if (langKeywords.includes(token)) {
      color = COLORS.keyword;
    } else if (/^[a-zA-Z_]\w*\s*$/.test(token) && line.includes(token + '(')) {
      color = COLORS.function;
    }

    doc.setTextColor(...color);
    doc.text(token, currentX, y);
    currentX += token.length * charWidth;
  });

  doc.setTextColor(0, 0, 0);
}

// ── Timestamp helper ────────────────────────────────────────────────

function formatEpochToLocalTime(epoch: number): string {
  const d = new Date(epoch);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Main export function ────────────────────────────────────────────

export function exportToPDF({
  sessionId,
  peerName,
  participants,
  sessionStartTime,
  code,
  language,
  messages,
  canvasElement,
}: PDFExportData): string {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  function checkPageBreak(requiredSpace: number): boolean {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  }

  function drawSectionHeader(title: string): void {
    checkPageBreak(15);
    doc.setFillColor(66, 139, 202);
    doc.rect(margin, yPosition, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 3, yPosition + 5.5);
    doc.setTextColor(0, 0, 0);
    yPosition += 12;
  }

  // === HEADER ===
  doc.setFillColor(52, 73, 94);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Interview Session Export', margin, 16);
  doc.setTextColor(0, 0, 0);
  yPosition = 35;

  // === SESSION METADATA ===
  drawSectionHeader('Session Information');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const exportDate = new Date();
  const formattedDate = exportDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const participantNames: string[] = [];
  if (peerName) participantNames.push(peerName + ' (You)');
  if (participants) {
    Object.values(participants).forEach((p) => {
      if (p.name && p.name !== peerName) participantNames.push(p.name);
    });
  }

  let sessionDuration = 'Unknown';
  if (sessionStartTime) {
    const elapsed = Date.now() - sessionStartTime;
    const totalMinutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    sessionDuration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  const metadataLines = [
    `Session ID: ${sessionId}`,
    `Exported by: ${peerName || 'Unknown'}`,
    `Export Date: ${formattedDate}`,
    `Session Duration: ${sessionDuration}`,
    `Programming Language: ${language.charAt(0).toUpperCase() + language.slice(1)}`,
    `Participants (${participantNames.length}): ${participantNames.join(', ')}`,
  ];

  metadataLines.forEach((line) => {
    const splitLines = doc.splitTextToSize(line, contentWidth - 5);
    splitLines.forEach((splitLine: string) => {
      doc.text(splitLine, margin, yPosition);
      yPosition += 5;
    });
  });
  yPosition += 5;

  // === CODE SECTION ===
  drawSectionHeader('Code Editor');

  if (code && code.trim()) {
    doc.setFontSize(9);
    doc.setFont('courier', 'normal');
    const codeLines = doc.splitTextToSize(code, contentWidth - 6);
    const codeHeight = Math.min(
      codeLines.length * 4 + 6,
      pageHeight - yPosition - margin - 10
    );

    checkPageBreak(codeHeight);
    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, yPosition, contentWidth, codeHeight, 'FD');

    yPosition += 4;
    const rawLines = code.split('\n');
    const lineHeight = 4;

    rawLines.forEach((line) => {
      if (yPosition + lineHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin + 4;
        doc.setFillColor(248, 248, 248);
        doc.setDrawColor(200, 200, 200);
      }
      renderCodeLineWithColors(doc, line, margin + 3, yPosition, language);
      yPosition += lineHeight;
    });
    yPosition += 8;
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text('No code content', margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // === DIAGRAM SECTION ===
  checkPageBreak(60);
  drawSectionHeader('Diagram');

  if (canvasElement) {
    try {
      const canvasData = canvasElement.toDataURL('image/png');
      const canvasAspectRatio = canvasElement.width / canvasElement.height;
      let imgWidth = contentWidth;
      let imgHeight = imgWidth / canvasAspectRatio;

      const maxHeight = 80;
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = imgHeight * canvasAspectRatio;
      }

      checkPageBreak(imgHeight + 5);
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, yPosition, imgWidth, imgHeight, 'S');
      doc.addImage(canvasData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    } catch {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(128, 128, 128);
      doc.text('Unable to export diagram', margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 10;
    }
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text('No diagram content', margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // === MESSAGES SECTION ===
  checkPageBreak(30);
  drawSectionHeader('Chat Messages');

  if (messages && messages.length > 0) {
    doc.setFontSize(9);

    messages.forEach((msg) => {
      const isInterviewer = msg.role === 'interviewer';
      const msgContent = msg.text || msg.content || '';
      const hasUnicode = containsNonASCII(msgContent);
      let msgHeight: number;
      let msgText: string | string[];

      if (hasUnicode) {
        const charsPerLine = Math.floor((contentWidth - 20) / 2.5);
        const estimatedLines = Math.ceil(msgContent.length / charsPerLine);
        msgHeight = estimatedLines * 5 + 10;
        msgText = msgContent;
      } else {
        msgText = doc.splitTextToSize(msgContent, contentWidth - 20);
        msgHeight = (msgText as string[]).length * 4 + 8;
      }

      checkPageBreak(msgHeight + 5);

      if (isInterviewer) {
        doc.setFillColor(227, 242, 253);
      } else {
        doc.setFillColor(243, 229, 245);
      }

      const bubbleX = isInterviewer ? margin : margin + 10;
      const bubbleWidth = contentWidth - 10;
      doc.roundedRect(bubbleX, yPosition, bubbleWidth, msgHeight, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const displayName =
        msg.senderName || msg.sender || (msg.role ? msg.role.charAt(0).toUpperCase() + msg.role.slice(1) : 'Unknown');
      if (containsNonASCII(displayName)) {
        addTextToPDF(doc, displayName, bubbleX + 3, yPosition + 4, {
          fontSize: 8,
          maxWidth: bubbleWidth - 40,
        });
      } else {
        doc.text(displayName, bubbleX + 3, yPosition + 4);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128, 128, 128);
      const displayTimestamp = msg.epochTime
        ? formatEpochToLocalTime(msg.epochTime)
        : msg.timestamp || '';
      doc.text(displayTimestamp, bubbleX + bubbleWidth - 25, yPosition + 4);
      doc.setTextColor(0, 0, 0);

      doc.setFontSize(9);
      if (hasUnicode) {
        addTextToPDF(doc, msgContent, bubbleX + 3, yPosition + 9, {
          fontSize: 9,
          maxWidth: bubbleWidth - 10,
        });
      } else {
        doc.text(msgText, bubbleX + 3, yPosition + 9);
      }

      yPosition += msgHeight + 3;
    });
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text('No messages', margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // === FOOTER ===
  const totalPages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${totalPages} | Generated by DuoCode Interview Tool`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Save
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `interview-session-${sessionId}-${timestamp}.pdf`;
  doc.save(filename);

  return filename;
}

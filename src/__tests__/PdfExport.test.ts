import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mock doc instance
const mockDoc = {
  internal: {
    pageSize: {
      getWidth: () => 210,
      getHeight: () => 297,
    },
    getNumberOfPages: () => 1,
  },
  setFillColor: vi.fn(),
  setTextColor: vi.fn(),
  setDrawColor: vi.fn(),
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setPage: vi.fn(),
  text: vi.fn(),
  rect: vi.fn(),
  roundedRect: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
  splitTextToSize: vi.fn((text: string) => text.split('\n')),
  save: vi.fn(),
};

vi.mock('jspdf', () => ({
  jsPDF: function JsPDFMock() {
    return mockDoc;
  },
}));

// Import after mock is set up
const { exportToPDF } = await import('../services/pdf-export');

describe('exportToPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a PDF and returns the filename', () => {
    const filename = exportToPDF({
      sessionId: 'test-session',
      peerName: 'Alice',
      participants: {},
      sessionStartTime: Date.now() - 60000,
      code: 'const x = 1;',
      language: 'javascript',
      messages: [],
      canvasElement: null,
    });

    expect(filename).toMatch(/^interview-session-test-session-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(mockDoc.save).toHaveBeenCalledWith(filename);
  });

  it('includes session metadata in the PDF', () => {
    exportToPDF({
      sessionId: 'meta-test',
      peerName: 'Bob',
      participants: {
        peer1: { name: 'Charlie', isHost: false },
      },
      sessionStartTime: Date.now() - 120000,
      code: '',
      language: 'python',
      messages: [],
      canvasElement: null,
    });

    const textCalls = mockDoc.text.mock.calls.map((call) => call[0]);
    const allText = textCalls.flat().join(' ');

    expect(allText).toContain('meta-test');
    expect(allText).toContain('Bob');
    expect(allText).toContain('Python');
  });

  it('renders code section when code is provided', () => {
    exportToPDF({
      sessionId: 'code-test',
      peerName: 'Dev',
      participants: {},
      sessionStartTime: null,
      code: 'function hello() {\n  return "world";\n}',
      language: 'javascript',
      messages: [],
      canvasElement: null,
    });

    const textCalls = mockDoc.text.mock.calls;
    expect(textCalls.length).toBeGreaterThan(0);
  });

  it('shows no code content placeholder when code is empty', () => {
    exportToPDF({
      sessionId: 'empty-code',
      peerName: 'Dev',
      participants: {},
      sessionStartTime: null,
      code: '',
      language: 'javascript',
      messages: [],
      canvasElement: null,
    });

    const textCalls = mockDoc.text.mock.calls.map((call) => call[0]);
    const allText = textCalls.flat().join(' ');
    expect(allText).toContain('No code content');
  });

  it('shows no diagram content when canvas is null', () => {
    exportToPDF({
      sessionId: 'no-canvas',
      peerName: 'Dev',
      participants: {},
      sessionStartTime: null,
      code: '',
      language: 'javascript',
      messages: [],
      canvasElement: null,
    });

    const textCalls = mockDoc.text.mock.calls.map((call) => call[0]);
    const allText = textCalls.flat().join(' ');
    expect(allText).toContain('No diagram content');
  });

  it('renders messages when provided', () => {
    exportToPDF({
      sessionId: 'msg-test',
      peerName: 'Alice',
      participants: {},
      sessionStartTime: null,
      code: '',
      language: 'javascript',
      messages: [
        {
          sender: 'Alice',
          senderName: 'Alice',
          text: 'Hello world',
          timestamp: '10:30:00',
          role: 'interviewer',
        },
        {
          sender: 'Bob',
          senderName: 'Bob',
          content: 'Hi there',
          timestamp: '10:31:00',
          role: 'candidate',
        },
      ],
      canvasElement: null,
    });

    expect(mockDoc.roundedRect).toHaveBeenCalled();

    const textCalls = mockDoc.text.mock.calls.map((call) => call[0]);
    const allText = textCalls.flat().join(' ');
    expect(allText).toContain('Alice');
  });

  it('shows no messages placeholder when messages array is empty', () => {
    exportToPDF({
      sessionId: 'no-msgs',
      peerName: 'Dev',
      participants: {},
      sessionStartTime: null,
      code: '',
      language: 'javascript',
      messages: [],
      canvasElement: null,
    });

    const textCalls = mockDoc.text.mock.calls.map((call) => call[0]);
    const allText = textCalls.flat().join(' ');
    expect(allText).toContain('No messages');
  });

  it('includes canvas image when canvasElement is provided', () => {
    const mockCanvas = {
      toDataURL: vi.fn(() => 'data:image/png;base64,fakecontent'),
      width: 800,
      height: 600,
    };

    exportToPDF({
      sessionId: 'canvas-test',
      peerName: 'Dev',
      participants: {},
      sessionStartTime: null,
      code: '',
      language: 'javascript',
      messages: [],
      canvasElement: mockCanvas as unknown as HTMLCanvasElement,
    });

    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png');
    expect(mockDoc.addImage).toHaveBeenCalled();
  });

  it('calculates session duration correctly', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000 - 30 * 60 * 1000;

    exportToPDF({
      sessionId: 'duration-test',
      peerName: 'Dev',
      participants: {},
      sessionStartTime: twoHoursAgo,
      code: '',
      language: 'javascript',
      messages: [],
      canvasElement: null,
    });

    const textCalls = mockDoc.text.mock.calls.map((call) => call[0]);
    const allText = textCalls.flat().join(' ');
    expect(allText).toContain('2h 30m');
  });

  it('lists multiple participants', () => {
    exportToPDF({
      sessionId: 'multi-p',
      peerName: 'Alice',
      participants: {
        p1: { name: 'Bob', isHost: false },
        p2: { name: 'Charlie', isHost: false },
      },
      sessionStartTime: null,
      code: '',
      language: 'javascript',
      messages: [],
      canvasElement: null,
    });

    const textCalls = mockDoc.text.mock.calls.map((call) => call[0]);
    const allText = textCalls.flat().join(' ');
    expect(allText).toContain('Alice (You)');
    expect(allText).toContain('Bob');
    expect(allText).toContain('Charlie');
  });
});

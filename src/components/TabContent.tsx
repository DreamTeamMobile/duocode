import { useUIStore } from '../stores/uiStore';
import CodeEditor from './CodeEditor/CodeEditor';
import OutputPanel from './CodeEditor/OutputPanel';
import DiagramCanvas from './DiagramCanvas/DiagramCanvas';

export default function TabContent() {
  const activeTab = useUIStore((s) => s.activeTab);

  return (
    <div id="tabContent">
      <div id="codeCanvas" className={activeTab === 'code' ? 'active' : ''}>
        <CodeEditor />
        <OutputPanel />
      </div>
      <div id="diagramCanvas" className={activeTab === 'canvas' ? 'active' : ''}>
        <DiagramCanvas />
      </div>
    </div>
  );
}

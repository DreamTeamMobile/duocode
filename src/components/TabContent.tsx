import { useUIStore } from '../stores/uiStore';
import CodeEditor from './CodeEditor/CodeEditor';
import DiagramCanvas from './DiagramCanvas/DiagramCanvas';

export default function TabContent() {
  const activeTab = useUIStore((s) => s.activeTab);

  return (
    <div id="tabContent">
      <div id="codeCanvas" className={activeTab === 'code' ? 'active' : ''}>
        <CodeEditor />
      </div>
      <div id="diagramCanvas" className={activeTab === 'canvas' ? 'active' : ''}>
        <DiagramCanvas />
      </div>
    </div>
  );
}

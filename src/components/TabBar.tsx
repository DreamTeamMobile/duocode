import { useUIStore } from '../stores/uiStore';
import LanguageSelector from './CodeEditor/LanguageSelector';

export default function TabBar() {
  const activeTab = useUIStore((s) => s.activeTab);
  const switchTab = useUIStore((s) => s.switchTab);

  return (
    <div id="tabBarWrapper">
      <div id="tabBar">
        <button
          className={`tab-btn${activeTab === 'code' ? ' active' : ''}`}
          onClick={() => switchTab('code')}
        >
          Code
        </button>
        <button
          className={`tab-btn${activeTab === 'canvas' ? ' active' : ''}`}
          onClick={() => switchTab('canvas')}
        >
          Diagram
        </button>
      </div>
      {activeTab === 'code' && <LanguageSelector />}
    </div>
  );
}

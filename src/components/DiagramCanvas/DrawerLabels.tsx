import { RefObject } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';

const PEER_COLORS = [
  '#e74c3c',
  '#2ecc71',
  '#3498db',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
];

function getPeerColor(index: number): string {
  return PEER_COLORS[index % PEER_COLORS.length];
}

interface DrawerLabelsProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export default function DrawerLabels({ canvasRef }: DrawerLabelsProps) {
  const remoteDrawers = useCanvasStore((s) => s.remoteDrawers);

  if (!remoteDrawers || Object.keys(remoteDrawers).length === 0) {
    return null;
  }

  const canvas = canvasRef?.current;
  if (!canvas) return null;

  const { zoom, panOffset } = useCanvasStore.getState();
  const rect = canvas.getBoundingClientRect();
  const cssScaleX = rect.width / canvas.width;
  const cssScaleY = rect.height / canvas.height;

  const entries = Object.entries(remoteDrawers).filter(([, data]) => data.active);

  return (
    <>
      {entries.map(([peerId, data], index) => {
        const bufferX = data.x * zoom + panOffset.x;
        const bufferY = data.y * zoom + panOffset.y;
        const left = bufferX * cssScaleX + 10;
        const top = bufferY * cssScaleY - 20;

        return (
          <div
            key={peerId}
            className="drawer-label"
            style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              background: getPeerColor(index),
              color: 'white',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: 500,
              pointerEvents: 'none',
              zIndex: 1000,
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            {data.name}
          </div>
        );
      })}
    </>
  );
}

import { useConnectionStore } from '../../stores/connectionStore';

interface RetryBannerProps {
  onCancel?: () => void;
  onRetry?: () => void;
}

export default function RetryBanner({ onCancel, onRetry }: RetryBannerProps) {
  const connectionState = useConnectionStore((s) => s.connectionState);
  const peerConnections = useConnectionStore((s) => s.peerConnections);

  const isReconnecting = connectionState === 'reconnecting';
  const isFailed = connectionState === 'error';

  if (!isReconnecting && !isFailed) return null;

  // Derive attempt count from peer connections or default
  const attempt = Object.values(peerConnections).reduce(
    (max, p) => Math.max(max, (p as unknown as Record<string, number>)?.retryAttempt || 0),
    0
  ) || 1;
  const maxAttempts = 5;

  return (
    <div
      className={`retry-banner${isFailed ? ' retry-failed' : ''}`}
      data-testid="retry-banner"
    >
      <div className="retry-content">
        <span className="retry-spinner" />
        <span className="retry-message">
          {isFailed
            ? 'Connection failed after multiple attempts.'
            : 'Reconnecting...'}
        </span>
        {isReconnecting && (
          <span className="retry-attempt">
            Attempt {attempt} of {maxAttempts}
          </span>
        )}
      </div>
      <div className="retry-actions">
        {isReconnecting && (
          <button className="retry-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        {isFailed && (
          <button className="retry-manual-btn" onClick={onRetry}>
            Retry Now
          </button>
        )}
      </div>
    </div>
  );
}

import type { ConnectionStatus } from '../types';
import { FEATURES } from '../data/features';

interface HeaderProps {
  connected: boolean;
  agentCount: number;
  onSettingsClick?: () => void;
}

export function Header({ connected, agentCount, onSettingsClick }: HeaderProps) {
  const status: ConnectionStatus = connected ? 'connected' : 'disconnected';

  return (
    <header className="pg-header">
      <div className="pg-header-left">
        <h1 className="pg-header-title">⚡ Gauss Playground</h1>
        <span className="pg-header-version">v1.0.0</span>
      </div>
      <div className="pg-header-right">
        <span className="pg-header-features">{FEATURES.length} features</span>
        <span className="pg-header-agents">{agentCount} agent{agentCount !== 1 ? 's' : ''}</span>
        <button
          className="pg-header-settings-btn"
          onClick={onSettingsClick}
          title="API Settings"
          style={{
            background: 'none', border: '1px solid #313244', borderRadius: 8,
            color: '#cdd6f4', cursor: 'pointer', padding: '4px 10px', fontSize: 16,
          }}
        >⚙️</button>
        <span className={`pg-connection-badge pg-connection-badge--${status}`}>
          <span className="pg-connection-dot" />
          {status === 'connected' ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </header>
  );
}

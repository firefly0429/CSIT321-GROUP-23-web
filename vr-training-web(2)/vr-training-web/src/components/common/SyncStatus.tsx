import { useTrainingStore } from '../../store/useTrainingStore';
export function SyncStatus() {
  const status = useTrainingStore(s => s.syncStatus); const error = useTrainingStore(s => s.error);
  const user = useTrainingStore(s => s.currentUser);
  if (!user && !error) return null;
  return <div className="border-b border-border bg-surface px-6 py-2 text-xs" role="status">
    {error ? <span className="text-warning">{error}</span> : status === 'local' ? 'Demo mode · saved in this browser only' : status === 'saving' ? 'Syncing training records…' : status === 'saved' ? 'Training records synced' : 'Sync pending'}
    {user?.authMode === 'cloud' && <button className="ml-4 underline" onClick={() => void useTrainingStore.getState().sync()}>Refresh / retry sync</button>}
  </div>;
}

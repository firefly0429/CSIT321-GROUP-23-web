import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useTrainingStore } from '../store/useTrainingStore';
import { authService, cloudConfigured } from '../services/authService';
export default function RoleSelectionPage() {
  const navigate = useNavigate(); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try { const user = await authService.login(email, password); useTrainingStore.getState().setUser(user); navigate(user.role === 'educator' ? '/educator' : '/home'); }
    catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
  }
  async function register() {
    setBusy(true); setMessage('');
    try { await authService.register(email, password); setMessage('Account created. If email confirmation is enabled, confirm your email before signing in.'); }
    catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="text-3xl font-bold">Industrial Safety Training</h1><p className="mb-8 mt-3 text-muted">Train in Unity, review your results, and track progress.</p>
    <Card><h2 className="mb-4 text-lg font-semibold">Sign in</h2>
      {cloudConfigured ? <form onSubmit={login} className="space-y-4">
        <label className="block">Email<input required type="email" autoComplete="username" className="mt-1 block w-full rounded bg-raised p-3" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="block">Password<input required type="password" minLength={8} autoComplete="current-password" className="mt-1 block w-full rounded bg-raised p-3" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <div className="flex gap-3"><Button disabled={busy} type="submit">Sign in</Button><Button disabled={busy || !email || password.length < 8} variant="secondary" type="button" onClick={() => void register()}>Create trainee account</Button></div>
      </form> : <p className="text-sm text-muted">Cloud accounts are not configured for this installation. Use the local demo below.</p>}
      {message && <p role="status" className="mt-3 text-sm text-warning">{message}</p>}
    </Card>
    <Card className="mt-5"><h2 className="mb-2 font-semibold">Explore the demo</h2><p className="mb-4 text-sm text-muted">Demo records stay in this browser and are separate from cloud accounts.</p><div className="flex gap-3">{(['trainee','educator'] as const).map(role => <Button key={role} variant="secondary" disabled={busy} onClick={() => {
      try { useTrainingStore.getState().selectRole(role, role === 'trainee' ? 'Trainee01' : 'Educator01'); navigate(role === 'educator' ? '/educator' : '/home'); } catch (e) { setMessage((e as Error).message); }
    }}>{role === 'trainee' ? 'Trainee demo' : 'Educator demo'}</Button>)}</div></Card>
  </main>;
}

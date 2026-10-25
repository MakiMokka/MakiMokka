import { login } from '@/app/actions';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main style={{ maxWidth: 380, paddingTop: '20vh' }}>
      <p className="sub">Mantequilla Social Club</p>
      <h1>Robot de reservación</h1>
      <form action={login} className="card stack" style={{ marginTop: 20 }}>
        <label className="stack">
          <span className="label">Contraseña</span>
          <input type="password" name="password" autoComplete="current-password" required autoFocus />
        </label>
        {error && <p className="sub" style={{ color: 'var(--bad)' }}>Contraseña incorrecta.</p>}
        <button className="primary">Entrar</button>
      </form>
    </main>
  );
}

import { FormEvent, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';

interface LoginPageProps {
  hasAccount: boolean;
  onLogin: (email: string, password: string, remember: boolean) => Promise<void>;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
}

export function LoginPage({ hasAccount, onLogin, onRegister }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isRegistering, setIsRegistering] = useState(!hasAccount);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    try {
      if (isRegistering) {
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        if (password !== confirmPassword) throw new Error('The passwords do not match.');
        await onRegister(name, email, password);
      } else {
        await onLogin(email, password, form.get('remember') === 'on');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-backdrop" aria-hidden="true" />
      <a className="login-brand" href="/" aria-label="TaskFlow home">
        <span className="login-brand-mark"><Check size={25} strokeWidth={3} /></span>
        <span>TaskFlow</span>
      </a>

      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card-heading">
          <span className="login-eyebrow">YOUR SPACE, IN FOCUS</span>
          <h1 id="login-title">{isRegistering ? 'Create your account' : 'Welcome back'}</h1>
          <p>{isRegistering ? 'Set up your private TaskFlow account on this device.' : 'Sign in to open your TaskFlow workspace.'}</p>
        </div>

        <form onSubmit={(event) => { void handleSubmit(event); }}>
          {isRegistering && <>
            <label className="login-label" htmlFor="login-name">Your name</label>
            <div className="login-input-wrap">
              <input id="login-name" name="name" type="text" autoComplete="name" placeholder="Your name" required maxLength={80} />
            </div>
          </>}
          <label className="login-label" htmlFor="login-email">Email address</label>
          <div className="login-input-wrap">
            <Mail size={18} aria-hidden="true" />
            <input id="login-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </div>

          <div className="login-password-heading">
            <label className="login-label" htmlFor="login-password">Password</label>
            {!isRegistering && <button type="button" className="login-text-button" onClick={() => setMessage('This local account has no email recovery. Your workspace backup can protect your data if you forget the password.')}>Forgot password?</button>}
          </div>
          <div className="login-input-wrap">
            <LockKeyhole size={18} aria-hidden="true" />
            <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegistering ? 'new-password' : 'current-password'} placeholder={isRegistering ? 'At least 8 characters' : 'Enter your password'} required minLength={isRegistering ? 8 : undefined} />
            <button type="button" className="login-reveal" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {isRegistering && <>
            <label className="login-label" htmlFor="login-confirm">Confirm password</label>
            <div className="login-input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input id="login-confirm" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter your password again" required minLength={8} />
            </div>
          </>}

          {!isRegistering && <label className="login-remember"><input type="checkbox" name="remember" defaultChecked /> <span>Keep me signed in on this browser</span></label>}
          <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button>
        </form>

        {message && <p className="login-message" role="alert">{message}</p>}
        {hasAccount && <p className="login-switch">{isRegistering ? 'Already set up?' : 'New to TaskFlow?'} <button type="button" onClick={() => { setMessage(''); setIsRegistering((value) => !value); }}>{isRegistering ? 'Sign in' : 'Create an account'}</button></p>}
        <p className="login-local-note">This account is stored on this device only. It does not sync to other devices. Keep a workspace backup in case you forget your password.</p>
      </section>
      <footer className="login-footer">PLAN WITH INTENTION · MAKE ROOM FOR WHAT MATTERS</footer>
    </main>
  );
}

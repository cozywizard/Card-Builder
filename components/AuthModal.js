import { h } from 'https://esm.sh/preact@10.19.6';
import { useState } from 'https://esm.sh/preact@10.19.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { auth } from '../utils/firebase.js';

const html = htm.bind(h);

function formatAuthError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next) => { setMode(next); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
        onClose();
      } else if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        onClose();
      } else {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
      }
    } catch (err) {
      setError(formatAuthError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return html`
    <div class="modal-overlay z-index-top" onClick=${handleOverlayClick}>
      <div class="modal-content glass-panel animate-zoom-in auth-modal">

        <button class="auth-close-btn" onClick=${onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div class="auth-modal-logo">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <path d="M12 8l4 4-4 4-4-4z"/>
          </svg>
        </div>

        <h2 class="auth-modal-title">
          ${mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password'}
        </h2>

        ${mode !== 'reset' && html`
          <div class="auth-mode-tabs">
            <button class="auth-mode-tab ${mode === 'login' ? 'active' : ''}" onClick=${() => switchMode('login')}>Sign In</button>
            <button class="auth-mode-tab ${mode === 'signup' ? 'active' : ''}" onClick=${() => switchMode('signup')}>Sign Up</button>
          </div>
        `}

        ${resetSent ? html`
          <p class="auth-success-msg">Reset email sent — check your inbox.</p>
          <button class="primary-glow-btn auth-submit-btn" onClick=${() => { switchMode('login'); setResetSent(false); }}>
            Back to Sign In
          </button>
        ` : html`
          <form class="auth-form" onSubmit=${handleSubmit}>
            <div class="auth-field">
              <label class="input-label">Email</label>
              <input
                class="form-text-input"
                type="email"
                value=${email}
                onInput=${(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autocomplete="email"
              />
            </div>

            ${mode !== 'reset' && html`
              <div class="auth-field">
                <label class="input-label">Password</label>
                <input
                  class="form-text-input"
                  type="password"
                  value=${password}
                  onInput=${(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minlength="6"
                  autocomplete=${mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            `}

            ${mode === 'signup' && html`
              <div class="auth-field">
                <label class="input-label">Confirm Password</label>
                <input
                  class="form-text-input"
                  type="password"
                  value=${confirmPassword}
                  onInput=${(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minlength="6"
                  autocomplete="new-password"
                />
              </div>
            `}

            ${error && html`<p class="auth-error-msg">${error}</p>`}

            <button type="submit" class="primary-glow-btn auth-submit-btn" disabled=${loading}>
              ${loading
                ? 'Please wait...'
                : mode === 'login' ? 'Sign In'
                : mode === 'signup' ? 'Create Account'
                : 'Send Reset Email'}
            </button>

            ${mode === 'login' && html`
              <button type="button" class="auth-text-link" onClick=${() => switchMode('reset')}>
                Forgot password?
              </button>
            `}

            ${mode === 'reset' && html`
              <button type="button" class="auth-text-link" onClick=${() => switchMode('login')}>
                Back to sign in
              </button>
            `}
          </form>
        `}
      </div>
    </div>
  `;
}

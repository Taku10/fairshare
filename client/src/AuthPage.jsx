// client/src/AuthPage.jsx
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useState } from "react";
import { useAuth } from "./AuthContext";
import { auth } from "./firebase";

function AuthPage({ onBack }) {
  const { currentUser, authConfigured } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!authConfigured) {
      setError("Sign-in is unavailable until Firebase web app settings are configured.");
      return;
    }

    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  }

  if (currentUser) {
    return <p>You are logged in as {currentUser.email}</p>;
  }

  return (
    <div className="auth-shell">
      <div className="auth-glow auth-glow-1" aria-hidden="true" />
      <div className="auth-glow auth-glow-2" aria-hidden="true" />
      <div className="auth-card">
        <div className="auth-head">
          {onBack && (
            <button type="button" className="auth-back" onClick={onBack}>
              ← Back
            </button>
          )}
          <div className="auth-pill">Fair Share</div>
        </div>
        <h1 className="auth-title">{isRegister ? "Create your home" : "Welcome back"}</h1>
        <p className="auth-subtitle">
          {isRegister
            ? "Spin up a space for your house and invite everyone to keep chores, expenses, and chat aligned."
            : "Log in to sync chores, track expenses, and keep the house in flow."}
        </p>

        {!authConfigured && (
          <div className="auth-alert auth-alert--config" role="status">
            Add your Firebase web app settings to <code>client/.env</code> to enable sign-in.
            The landing page can be previewed without them.
          </div>
        )}
        {error && <div className="auth-alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="auth-field">
              <span>Display name</span>
              <input
                type="text"
                className="form-input"
                placeholder="Roomie nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" className="btn btn-primary auth-submit" disabled={!authConfigured}>
            {isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="auth-footer">
          <span>{isRegister ? "Already have an account?" : "New here?"}</span>
          <button type="button" className="auth-toggle" onClick={() => setIsRegister((b) => !b)} disabled={!authConfigured}>
            {isRegister ? "Switch to sign in" : "Switch to create one"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;

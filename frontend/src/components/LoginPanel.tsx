import { FormEvent, useState } from "react";

import { completeNewPassword, signIn } from "../auth";
import type { AuthSession } from "../types";

type LoginPanelProps = {
  authSession: AuthSession | null;
  onSignIn: (session: AuthSession) => void;
  onSignOut: () => void;
};

export function LoginPanel({ authSession, onSignIn, onSignOut }: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [password, setPassword] = useState("");
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    try {
      const session = requiresNewPassword ? await completeNewPassword(newPassword) : await signIn(email, password);
      onSignIn(session);
      setNewPassword("");
      setPassword("");
      setRequiresNewPassword(false);
      setStatus("Signed in.");
    } catch (error) {
      if (error instanceof Error && error.message === "NEW_PASSWORD_REQUIRED") {
        setRequiresNewPassword(true);
        setStatus("Choose a permanent password to finish first sign-in.");
      } else {
        setStatus(error instanceof Error ? error.message : "Sign in failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authSession) {
    return (
      <section className="login-panel">
        <div>
          <p className="sidebar-label">Signed in</p>
          <h2>{authSession.email || "Hospital user"}</h2>
          <p>{authSession.groups.length ? authSession.groups.join(", ") : "No team assigned"}</p>
        </div>
        <button className="clear-filters" onClick={onSignOut} type="button">
          Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="login-panel">
      <div>
        <p className="sidebar-label">Staff access</p>
        <h2>Sign in to manage hospital photos</h2>
        <p>
          Use an invited staff account to upload photos, review permissions, and update searchable details. Public
          self-signup is intentionally disabled for managed pilot workspaces.
        </p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@hospital.org"
            type="email"
            value={email}
          />
        </label>
        <label>
          <span>Password</span>
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Staff password"
            type="password"
            value={password}
          />
        </label>
        {requiresNewPassword ? (
          <label>
            <span>New permanent password</span>
            <input
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Set a permanent password"
              type="password"
              value={newPassword}
            />
          </label>
        ) : null}
        <button className="search-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Signing in..." : requiresNewPassword ? "Set password and sign in" : "Sign in"}
        </button>
      </form>
      {status ? <p className="curator-status">{status}</p> : null}
    </section>
  );
}

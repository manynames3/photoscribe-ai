import { FormEvent, useState } from "react";

import {
  completeNewPassword,
  confirmPasswordReset,
  requestPasswordReset,
  signIn,
} from "../auth";
import type { AuthSession } from "../types";

type LoginPanelProps = {
  authSession: AuthSession | null;
  onSignIn: (session: AuthSession) => void;
  onSignOut: () => void;
};

type RecoveryStep = "request" | "confirm" | null;

function cognitoErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const candidate = error as { code?: unknown; name?: unknown };
  return typeof candidate.code === "string" ? candidate.code : typeof candidate.name === "string" ? candidate.name : "";
}

async function requestRecoveryCode(email: string) {
  try {
    await requestPasswordReset(email);
  } catch (error) {
    if (!["UserNotFoundException", "InvalidParameterException"].includes(cognitoErrorCode(error))) throw error;
  }
}

export function LoginPanel({ authSession, onSignIn, onSignOut }: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirmation, setRecoveryPasswordConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>(null);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function returnToSignIn() {
    setRecoveryStep(null);
    setRecoveryCode("");
    setRecoveryPassword("");
    setRecoveryPasswordConfirmation("");
    setStatus("");
    setIsError(false);
  }

  async function handleRecoveryRequest() {
    setIsSubmitting(true);
    setRecoveryCode("");
    setStatus("");
    setIsError(false);

    try {
      await requestRecoveryCode(email);
      setRecoveryStep("confirm");
      setStatus("If an account exists for this email, a recovery code was sent to its verified address.");
    } catch (error) {
      setIsError(true);
      const code = cognitoErrorCode(error);
      setStatus(
        code === "LimitExceededException" || code === "TooManyRequestsException"
          ? "Too many recovery requests. Wait a few minutes and try again."
          : "Password recovery is temporarily unavailable. Try again or contact your administrator.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRecoveryRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleRecoveryRequest();
  }

  async function handleRecoveryConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsError(false);

    if (recoveryPassword !== recoveryPasswordConfirmation) {
      setIsError(true);
      setStatus("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(email, recoveryCode, recoveryPassword);
      setPassword("");
      setRecoveryStep(null);
      setRecoveryCode("");
      setRecoveryPassword("");
      setRecoveryPasswordConfirmation("");
      setStatus("Password updated. Sign in with your new password.");
    } catch (error) {
      const code = cognitoErrorCode(error);
      setIsError(true);
      setStatus(
        code === "CodeMismatchException"
          ? "That code is incorrect. Check it and try again."
          : code === "ExpiredCodeException"
            ? "That code has expired. Request a new one."
            : code === "InvalidPasswordException" && error instanceof Error
              ? error.message
              : "We couldn't reset your password. Check the code and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");
    setIsError(false);

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
        setPassword("");
        setStatus("Choose a permanent password to finish first sign-in.");
      } else {
        setIsError(true);
        setPassword("");
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
          <h2>{authSession.email || "Briar staff user"}</h2>
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
      <div className="login-panel-copy">
        <p>Use the account issued by your CareFrame administrator.</p>
      </div>

      {recoveryStep === "request" ? (
        <form className="login-form" onSubmit={handleRecoveryRequestSubmit}>
          <label>
            <span>Work email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@briar.example"
              required
              type="email"
              value={email}
            />
          </label>
          <p className="login-recovery-help">We'll send a code to the verified email address for your staff account.</p>
          <button className="search-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Sending code..." : "Send recovery code"}
          </button>
          <div className="login-form-secondary">
            <button className="login-text-button" onClick={returnToSignIn} type="button">Back to sign in</button>
          </div>
        </form>
      ) : recoveryStep === "confirm" ? (
        <form className="login-form" onSubmit={handleRecoveryConfirm}>
          <p className="login-recovery-help">Enter the recovery code and choose a new password for your staff account.</p>
          <label>
            <span>Recovery code</span>
            <input
              autoComplete="one-time-code"
              onChange={(event) => setRecoveryCode(event.target.value)}
              placeholder="Enter the code from your email"
              required
              value={recoveryCode}
            />
          </label>
          <label>
            <span>New password</span>
            <input
              autoComplete="new-password"
              minLength={12}
              onChange={(event) => setRecoveryPassword(event.target.value)}
              placeholder="Create a new password"
              required
              type="password"
              value={recoveryPassword}
            />
          </label>
          <p className="login-recovery-help">Use 12 or more characters, including uppercase, lowercase, a number, and a symbol.</p>
          <label>
            <span>Confirm new password</span>
            <input
              autoComplete="new-password"
              minLength={12}
              onChange={(event) => setRecoveryPasswordConfirmation(event.target.value)}
              placeholder="Enter the new password again"
              required
              type="password"
              value={recoveryPasswordConfirmation}
            />
          </label>
          <button className="search-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Updating password..." : "Reset password"}
          </button>
          <div className="login-form-secondary">
            <button className="login-text-button" disabled={isSubmitting} onClick={() => void handleRecoveryRequest()} type="button">
              Send a new code
            </button>
            <button className="login-text-button" onClick={returnToSignIn} type="button">Back to sign in</button>
          </div>
        </form>
      ) : (
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Work email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@briar.example"
              required
              type="email"
              value={email}
            />
          </label>
          {!requiresNewPassword ? (
            <label>
              <div className="login-label-row">
                <span>Password</span>
                <button
                  className="login-text-button"
                  onClick={() => {
                    setRecoveryStep("request");
                    setPassword("");
                    setStatus("");
                    setIsError(false);
                  }}
                  type="button"
                >
                  Forgot password?
                </button>
              </div>
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                type="password"
                value={password}
              />
            </label>
          ) : null}
          {requiresNewPassword ? (
            <label>
              <span>New permanent password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Set a permanent password"
                required
                type="password"
                value={newPassword}
              />
            </label>
          ) : null}
          <button className="search-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : requiresNewPassword ? "Set password and sign in" : "Sign in"}
          </button>
        </form>
      )}
      {status ? (
        <p aria-live={isError ? "assertive" : "polite"} className="curator-status" role={isError ? "alert" : "status"}>
          {status}
        </p>
      ) : null}
    </section>
  );
}

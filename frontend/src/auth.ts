import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";

import type { AuthSession } from "./types";

const AUTH_TOKEN_KEY = "photoscribe.authToken";
const AUTH_EMAIL_KEY = "photoscribe.authEmail";
const AUTH_GROUPS_KEY = "photoscribe.authGroups";
let pendingNewPasswordUser: CognitoUser | null = null;

function cognitoConfig() {
  return {
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID?.trim() ?? "",
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim() ?? "",
  };
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(window.atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function groupsFromToken(token: string) {
  const payload = decodeJwtPayload(token);
  const groups = payload["cognito:groups"];
  return Array.isArray(groups) ? groups.map(String) : [];
}

function emailFromToken(token: string) {
  const payload = decodeJwtPayload(token);
  return String(payload.email ?? payload.username ?? "");
}

function saveSession(token: string): AuthSession {
  const session = {
    email: emailFromToken(token),
    groups: groupsFromToken(token),
    idToken: token,
  };

  window.localStorage.setItem(AUTH_TOKEN_KEY, session.idToken);
  window.localStorage.setItem(AUTH_EMAIL_KEY, session.email);
  window.localStorage.setItem(AUTH_GROUPS_KEY, JSON.stringify(session.groups));
  return session;
}

function userPool() {
  const { clientId, userPoolId } = cognitoConfig();
  if (!clientId || !userPoolId) {
    throw new Error("Staff sign-in is not set up for this site yet.");
  }

  return new CognitoUserPool({
    ClientId: clientId,
    UserPoolId: userPoolId,
  });
}

function sessionFromCognito(cognitoSession: CognitoUserSession) {
  return saveSession(cognitoSession.getIdToken().getJwtToken());
}

export function currentAuthSession(): AuthSession | null {
  const idToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!idToken) {
    return null;
  }

  let storedGroups: string[] = [];
  try {
    storedGroups = JSON.parse(window.localStorage.getItem(AUTH_GROUPS_KEY) ?? "[]") as string[];
  } catch {
    storedGroups = groupsFromToken(idToken);
  }

  return {
    email: window.localStorage.getItem(AUTH_EMAIL_KEY) ?? emailFromToken(idToken),
    groups: storedGroups,
    idToken,
  };
}

export function signOut() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_EMAIL_KEY);
  window.localStorage.removeItem(AUTH_GROUPS_KEY);
}

export function signIn(email: string, password: string): Promise<AuthSession> {
  const pool = userPool();
  const user = new CognitoUser({
    Pool: pool,
    Username: email.trim().toLowerCase(),
  });
  const authDetails = new AuthenticationDetails({
    Password: password,
    Username: email.trim().toLowerCase(),
  });

  return new Promise((resolve, reject) => {
    user.authenticateUser(authDetails, {
      newPasswordRequired: () => {
        pendingNewPasswordUser = user;
        reject(new Error("NEW_PASSWORD_REQUIRED"));
      },
      onFailure: (error) => reject(error),
      onSuccess: (session) => resolve(sessionFromCognito(session)),
    });
  });
}

export function completeNewPassword(newPassword: string): Promise<AuthSession> {
  if (!pendingNewPasswordUser) {
    return Promise.reject(new Error("No pending temporary-password session."));
  }

  return new Promise((resolve, reject) => {
    pendingNewPasswordUser?.completeNewPasswordChallenge(
      newPassword,
      {},
      {
        onFailure: (error) => reject(error),
        onSuccess: (session) => {
          pendingNewPasswordUser = null;
          resolve(sessionFromCognito(session));
        },
      },
    );
  });
}

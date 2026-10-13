import { FormEvent, useState } from "react";

import { inviteAdminUser } from "../api";

const ROLE_OPTIONS = ["admin", "reviewer", "marketing", "hr", "compliance", "facilities"];

function roleLabel(role: string) {
  return role === "hr" ? "HR" : `${role[0]?.toUpperCase() ?? ""}${role.slice(1)}`;
}

type AdminPanelProps = {
  canAdmin: boolean;
};

export function AdminPanel({ canAdmin }: AdminPanelProps) {
  const [email, setEmail] = useState("");
  const [groups, setGroups] = useState<string[]>(["reviewer"]);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!canAdmin) {
    return null;
  }

  function toggleGroup(group: string) {
    setGroups((currentGroups) =>
      currentGroups.includes(group) ? currentGroups.filter((item) => item !== group) : [...currentGroups, group],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatus("Enter a staff email before sending an invite.");
      return;
    }

    setIsSubmitting(true);
    setStatus("");

    try {
      const result = await inviteAdminUser(trimmedEmail, groups);
      setStatus(`${result.email} invited with ${result.groups.join(", ")} access.`);
      setEmail("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "User invite failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="ops-panel">
      <div>
        <p className="sidebar-label">New invitation</p>
        <h2>Invite staff</h2>
        <p>Choose one or more roles for this Briar staff member.</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="reviewer@briar.example"
            type="email"
            value={email}
          />
        </label>
        <fieldset className="invite-role-options">
          <legend>Staff roles</legend>
          {ROLE_OPTIONS.map((role) => (
            <label key={role}>
              <input type="checkbox" checked={groups.includes(role)} onChange={() => toggleGroup(role)} />
              <span>{roleLabel(role)}</span>
            </label>
          ))}
        </fieldset>
        <button className="search-button" disabled={isSubmitting || !groups.length || !email.trim()} type="submit">
          {isSubmitting ? "Inviting..." : "Invite user"}
        </button>
      </form>

      {status ? <p className="curator-status">{status}</p> : null}
    </section>
  );
}

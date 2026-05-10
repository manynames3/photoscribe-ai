import { FormEvent, useState } from "react";

import { inviteAdminUser } from "../api";

const ROLE_OPTIONS = ["admin", "reviewer", "marketing", "hr", "compliance", "facilities"];

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
    setIsSubmitting(true);
    setStatus("");

    try {
      const result = await inviteAdminUser(email, groups);
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
        <p className="sidebar-label">Admin</p>
        <h2>User access</h2>
        <p>Invite hospital staff and choose what kind of photo work they can do.</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="reviewer@hospital.org"
            type="email"
            value={email}
          />
        </label>
        <div className="filter-pill-row">
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role}
              aria-pressed={groups.includes(role)}
              className={`filter-pill${groups.includes(role) ? " is-active" : ""}`}
              onClick={() => toggleGroup(role)}
              type="button"
            >
              {role}
            </button>
          ))}
        </div>
        <button className="search-button" disabled={isSubmitting || !groups.length} type="submit">
          {isSubmitting ? "Inviting..." : "Invite user"}
        </button>
      </form>

      {status ? <p className="curator-status">{status}</p> : null}
    </section>
  );
}

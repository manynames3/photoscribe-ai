type EmptyStateProps = {
  submittedQuery: string;
};

export function EmptyState({ submittedQuery }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <p className="sidebar-label">No matches yet</p>
      <h3>{submittedQuery ? `Nothing matched “${submittedQuery}”.` : "Start with a descriptive search."}</h3>
      <p>
        Try broader wording like <strong>clinical team</strong>, <strong>community outreach</strong>, or{" "}
        <strong>executive portrait</strong>. Newly uploaded assets must finish indexing before they appear.
      </p>
    </section>
  );
}

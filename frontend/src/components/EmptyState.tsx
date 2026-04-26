type EmptyStateProps = {
  submittedQuery: string;
};

export function EmptyState({ submittedQuery }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <p className="sidebar-label">No matches yet</p>
      <h3>{submittedQuery ? `Nothing matched “${submittedQuery}”.` : "Start with a descriptive search."}</h3>
      <p>
        Try broader wording like <strong>golden sunlight</strong>, <strong>garden harvest</strong>, or{" "}
        <strong>playful portrait</strong>.
      </p>
    </section>
  );
}

type EmptyStateProps = {
  submittedQuery: string;
};

export function EmptyState({ submittedQuery }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <h3>No photos found for “{submittedQuery}”.</h3>
      <p>Try fewer filters or a broader phrase. Recently uploaded photos may take a few minutes to appear.</p>
    </section>
  );
}

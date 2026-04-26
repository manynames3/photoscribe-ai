import type { PhotoResult } from "../types";
import { EmptyState } from "./EmptyState";
import { PhotoCard } from "./PhotoCard";

type PhotoGridProps = {
  isLoading: boolean;
  onOpen: (result: PhotoResult) => void;
  results: PhotoResult[];
  submittedQuery: string;
};

export function PhotoGrid({ isLoading, onOpen, results, submittedQuery }: PhotoGridProps) {
  if (isLoading) {
    return (
      <section aria-label="Loading results" className="photo-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <article key={`loading-${index + 1}`} className="photo-card photo-card-skeleton">
            <div className="photo-thumb skeleton-block" />
            <div className="photo-card-body">
              <div className="skeleton-line skeleton-line-short" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line-medium" />
            </div>
          </article>
        ))}
      </section>
    );
  }

  if (!results.length) {
    return <EmptyState submittedQuery={submittedQuery} />;
  }

  return (
    <section aria-label="Search results" className="photo-grid">
      {results.map((result) => (
        <PhotoCard key={result.id} onOpen={onOpen} result={result} />
      ))}
    </section>
  );
}

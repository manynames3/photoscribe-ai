import { useEffect, useRef, useState } from "react";

import { searchPhotos } from "./api";
import { FilterPanel } from "./components/FilterPanel";
import { PhotoGrid } from "./components/PhotoGrid";
import { PhotoModal } from "./components/PhotoModal";
import { SearchBar } from "./components/SearchBar";
import type { PhotoResult, SearchFilters } from "./types";

const SAMPLE_QUERIES = ["cherries in hands", "abstract sunlight", "playful garden harvest"];

export function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState<PhotoResult[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [status, setStatus] = useState("Search the library by meaning, mood, or scene.");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoResult | null>(null);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const isTypingTarget =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (event.key === "/" && !isTypingTarget) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  async function handleSearch(nextQuery = query, nextFilters = filters) {
    const trimmedQuery = nextQuery.trim();

    if (!trimmedQuery) {
      setError("Enter a search phrase first.");
      setStatus("Search needs a query.");
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await searchPhotos(trimmedQuery, nextFilters);
      setResults(response.results);
      setSubmittedQuery(response.query);
      setStatus(`${response.message} ${response.results.length} result${response.results.length === 1 ? "" : "s"}.`);
    } catch (caughtError) {
      setResults([]);
      setSubmittedQuery(trimmedQuery);
      setStatus("Search request failed.");
      setError(caughtError instanceof Error ? caughtError.message : "Unknown error.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleFilterChange(nextFilters: SearchFilters) {
    setFilters(nextFilters);
    if (submittedQuery) {
      void handleSearch(query, nextFilters);
    }
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <>
      <main className="app-shell">
        <div className="app-ambient app-ambient-left" />
        <div className="app-ambient app-ambient-right" />

        <section className="hero-panel">
          <p className="eyebrow">PhotoScribe AI</p>
          <h1>Search photos by meaning instead of filenames.</h1>
          <p className="hero-copy">
            A semantic photo library that turns natural-language queries into ranked image matches
            with mood, scene, and lighting metadata.
          </p>

          <div className="chip-row">
            {SAMPLE_QUERIES.map((sample) => (
              <button
                key={sample}
                className="sample-chip"
                onClick={() => {
                  setQuery(sample);
                  void handleSearch(sample, filters);
                }}
                type="button"
              >
                {sample}
              </button>
            ))}
          </div>

          <SearchBar
            disabled={isLoading}
            onChange={setQuery}
            onSubmit={(nextQuery) => {
              void handleSearch(nextQuery);
            }}
            searchInputRef={searchInputRef}
            value={query}
          />
        </section>

        <section className="content-grid">
          <aside className="sidebar-panel">
            <div className="sidebar-header">
              <div>
                <p className="sidebar-label">Refine</p>
                <h2>Filter by metadata</h2>
              </div>
              {activeFilterCount ? <span className="filter-count">{activeFilterCount}</span> : null}
            </div>

            <FilterPanel
              disabled={isLoading}
              filters={filters}
              onChange={handleFilterChange}
              onClear={() => handleFilterChange({})}
            />
          </aside>

          <section className="results-panel">
            <div className="results-summary">
              <div>
                <p className="sidebar-label">Results</p>
                <h2>{submittedQuery ? `“${submittedQuery}”` : "Waiting for your first search"}</h2>
                <p className="status-copy">{status}</p>
              </div>
              <span className="mode-pill">{import.meta.env.VITE_API_URL ? "Live API" : "Preview mode"}</span>
            </div>

            {error ? <p className="error-banner">{error}</p> : null}

            <PhotoGrid
              isLoading={isLoading}
              onOpen={setSelectedPhoto}
              results={results}
              submittedQuery={submittedQuery}
            />
          </section>
        </section>

        <footer className="site-footer">
          <p>©2026 SUPREME AI VENTURES LLC</p>
        </footer>
      </main>

      <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
    </>
  );
}

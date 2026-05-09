import { useEffect, useRef, useState } from "react";

import { searchPhotos } from "./api";
import { currentAuthSession, signOut } from "./auth";
import { AdminPanel } from "./components/AdminPanel";
import { FilterPanel } from "./components/FilterPanel";
import { LoginPanel } from "./components/LoginPanel";
import { PhotoGrid } from "./components/PhotoGrid";
import { PhotoModal } from "./components/PhotoModal";
import { ReviewQueue } from "./components/ReviewQueue";
import { SearchBar } from "./components/SearchBar";
import { UploadPanel } from "./components/UploadPanel";
import type { AuthSession, PhotoResult, SearchFilters } from "./types";

const SAMPLE_QUERIES = [
  "physician at nurses station",
  "community health event",
  "sterile procedure room",
  "hospital executive headshot",
];

const CONTROL_CARDS = [
  {
    label: "Departments",
    value: "Comms, HR, Compliance",
  },
  {
    label: "Asset governance",
    value: "Review status + visibility",
  },
  {
    label: "Discovery",
    value: "Semantic clinical-media search",
  },
  {
    label: "Security posture",
    value: "Private S3 + signed access",
  },
];

const DEPARTMENT_WORKFLOWS = [
  {
    label: "Marketing",
    value: "Find campaign-ready event, staff, and facility images without chasing shared folders.",
  },
  {
    label: "Human Resources",
    value: "Locate employee portraits and recruiting imagery by role, mood, date, or setting.",
  },
  {
    label: "Compliance",
    value: "Review visibility, policy status, and potentially sensitive media before release.",
  },
  {
    label: "Facilities",
    value: "Search campus, renovation, and operations documentation from one governed library.",
  },
];

export function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState<PhotoResult[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [status, setStatus] = useState("Search approved hospital media by department need, subject, setting, or visual tone.");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoResult | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => currentAuthSession());
  const [securityContext, setSecurityContext] = useState({
    authMode: "anonymous",
    deniedResults: 0,
    groups: [] as string[],
  });

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
      setSecurityContext(response.securityContext ?? { authMode: "anonymous", deniedResults: 0, groups: [] });
      setSubmittedQuery(response.query);
      setStatus(`${response.message} ${response.results.length} result${response.results.length === 1 ? "" : "s"}.`);
    } catch (caughtError) {
      setResults([]);
      setSecurityContext({ authMode: "anonymous", deniedResults: 0, groups: [] });
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
  const userGroups = authSession?.groups ?? [];
  const canReview = userGroups.includes("admin") || userGroups.includes("reviewer");
  const canAdmin = userGroups.includes("admin");
  const isSignedIn = Boolean(authSession);

  return (
    <>
      <main className="app-shell">
        <div className="app-ambient app-ambient-left" />
        <div className="app-ambient app-ambient-right" />

        <section className="hero-panel">
          <p className="eyebrow">CareFrame Media Intelligence</p>
          <h1>Internal media search for hospital departments.</h1>
          <p className="hero-copy">
            A governed visual asset hub for Marketing, HR, Compliance, Facilities, and leadership
            teams that need to find approved hospital imagery without digging through shared drives.
          </p>

          <div className="control-grid" aria-label="Production control summary">
            {CONTROL_CARDS.map((card) => (
              <div className="control-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            ))}
          </div>

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

          <div className="department-grid" aria-label="Hospital department workflows">
            {DEPARTMENT_WORKFLOWS.map((workflow) => (
              <article className="department-card" key={workflow.label}>
                <span>{workflow.label}</span>
                <p>{workflow.value}</p>
              </article>
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

        <LoginPanel
          authSession={authSession}
          onSignIn={(session) => {
            setAuthSession(session);
            setSecurityContext({ authMode: "jwt", deniedResults: 0, groups: session.groups });
          }}
          onSignOut={() => {
            signOut();
            setAuthSession(null);
            setResults([]);
            setSecurityContext({ authMode: "anonymous", deniedResults: 0, groups: [] });
            setStatus("Sign in to search the private hospital media library.");
          }}
        />

        {isSignedIn ? (
          <>
            <UploadPanel
              onUploaded={(uploadedCount) => {
                setStatus(
                  `${uploadedCount} upload${uploadedCount === 1 ? "" : "s"} accepted. Assets enter the review queue after AI metadata extraction finishes.`,
                );
              }}
            />
            <ReviewQueue canReview={canReview} onOpen={setSelectedPhoto} />
            <AdminPanel canAdmin={canAdmin} />
          </>
        ) : null}

        <section className="content-grid">
          <aside className="sidebar-panel">
            <div className="sidebar-header">
              <div>
                <p className="sidebar-label">Find</p>
                <h2>Asset finder</h2>
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
              <div className="mode-stack">
                <span className="mode-pill">{import.meta.env.VITE_API_URL ? "Hospital asset API" : "Sample catalog"}</span>
                <span className="mode-subtle">
                  {authSession
                    ? `${authSession.groups.join(", ") || "no role groups"}`
                    : "Sign in required for live assets"}
                </span>
                {securityContext.deniedResults ? (
                  <span className="mode-subtle">{securityContext.deniedResults} policy-filtered</span>
                ) : null}
              </div>
            </div>

            {error ? <p className="error-banner">{error}</p> : null}
            <p className="indexing-note">
              Recent uploads appear only after image analysis writes metadata into the searchable index.
              If newly uploaded hospital images are missing, the ingest queue or AI model access needs attention.
            </p>

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

      <PhotoModal
        authSession={authSession}
        canCurate={canReview}
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
    </>
  );
}

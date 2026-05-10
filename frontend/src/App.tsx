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

const NAV_ITEMS = ["Photos", "Needs review", "Uploads", "Departments", "Approvals"];

const DEPARTMENT_WORKFLOWS = [
  {
    detail: "Marketing-ready images cleared for presentations, intranet, and department requests.",
    label: "Campaign photos",
    query: "approved campaign assets",
    status: "Approved",
  },
  {
    detail: "Portraits searchable by staff member, department owner, campaign, and consent status.",
    label: "Staff headshots",
    query: "hospital executive headshot",
    status: "People",
  },
  {
    detail: "Photos requiring consent, usage-rights, or release-readiness verification.",
    label: "Needs review",
    query: "needs compliance review",
    status: "Review",
  },
  {
    detail: "Campus, interior, renovation, and operations imagery organized by location and asset type.",
    label: "Facilities",
    query: "hospital facilities documentation",
    status: "Location",
  },
];

export function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [resultView, setResultView] = useState<"grid" | "list">("grid");
  const [results, setResults] = useState<PhotoResult[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [status, setStatus] = useState("Search by person, department, event, location, or description.");
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

  function handleSignOut() {
    signOut();
    setAuthSession(null);
    setResults([]);
    setSecurityContext({ authMode: "anonymous", deniedResults: 0, groups: [] });
    setStatus("Sign in to view and manage private hospital photos.");
  }

  function handleWorkflowSearch(workflowQuery: string) {
    setQuery(workflowQuery);
    void handleSearch(workflowQuery, filters);
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const userGroups = authSession?.groups ?? [];
  const canReview = userGroups.includes("admin") || userGroups.includes("reviewer");
  const canAdmin = userGroups.includes("admin");
  const isSignedIn = Boolean(authSession);
  const hasSubmittedSearch = Boolean(submittedQuery);
  const pendingReviewCount = results.filter((result) => result.reviewStatus === "pending_review").length;
  const approvedCount = results.filter((result) => result.reviewStatus === "approved").length;
  const missingConsentCount = results.filter((result) => !result.consentStatus || result.consentStatus === "missing").length;
  const restrictedCount = results.filter((result) => result.visibility === "restricted").length;
  const resultsLabel = hasSubmittedSearch ? "Matching photos" : "Browse";
  const resultsTitle = hasSubmittedSearch ? `“${submittedQuery}”` : "Photo library";
  const resultsMessage =
    hasSubmittedSearch || isLoading || error
      ? status
      : "Search above or choose a shortcut to find photos by person, department, event, or location.";
  const metricCards = [
    {
      label: "Photos found",
      tone: "neutral",
      value: hasSubmittedSearch ? results.length : "Ready",
    },
    {
      label: "Approved",
      tone: "approved",
      value: hasSubmittedSearch ? approvedCount : "—",
    },
    {
      label: "Needs review",
      tone: "warning",
      value: hasSubmittedSearch ? pendingReviewCount : "—",
    },
    {
      label: "Missing consent",
      tone: "risk",
      value: hasSubmittedSearch ? missingConsentCount : "—",
    },
    {
      label: "Restricted",
      tone: "neutral",
      value: hasSubmittedSearch ? restrictedCount : "—",
    },
  ];

  return (
    <>
      <main className="app-shell institutional-shell">
        <div className="app-ambient app-ambient-left" />
        <div className="app-ambient app-ambient-right" />

        <aside className="app-rail" aria-label="Institutional navigation">
          <div className="rail-brand">
            <span className="brand-mark">CF</span>
            <div>
              <strong>CareFrame</strong>
              <span>Media desk</span>
            </div>
          </div>

          <nav className="rail-nav">
            {NAV_ITEMS.map((item, index) => (
              <button className={`rail-link${index === 0 ? " is-active" : ""}`} key={item} type="button">
                <span>{item}</span>
                {item === "Needs review" && pendingReviewCount ? <strong>{pendingReviewCount}</strong> : null}
              </button>
            ))}
          </nav>

          <div className="rail-assurance">
            <span>Private workspace</span>
            <p>Staff can upload, review, and manage hospital photos in one place.</p>
          </div>
        </aside>

        <div className="app-workspace">
          <header className="command-bar">
            <div>
              <p className="eyebrow">Emory University Hospital</p>
            </div>
            <div className="command-actions">
              <button
                className="auth-trigger"
                onClick={() => {
                  if (authSession) {
                    handleSignOut();
                    return;
                  }
                  setIsAuthPanelOpen((current) => !current);
                }}
                type="button"
              >
                {authSession ? "Sign out" : "Staff sign in"}
              </button>
            </div>
          </header>

          <section className="hero-panel command-panel">
            <div className="command-head">
              <p className="eyebrow">Search</p>
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

            <div className="metric-strip" aria-label="Photo library status">
              {metricCards.map((metric) => (
                <div className={`metric-card is-${metric.tone}`} key={metric.label}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
            </div>
          </section>

          {!isSignedIn && isAuthPanelOpen ? (
            <LoginPanel
              authSession={authSession}
              onSignIn={(session) => {
                setAuthSession(session);
                setIsAuthPanelOpen(false);
                setSecurityContext({ authMode: "jwt", deniedResults: 0, groups: session.groups });
              }}
              onSignOut={handleSignOut}
            />
          ) : null}

          {isSignedIn ? (
            <>
              <UploadPanel
                onUploaded={(uploadedCount) => {
                  setStatus(
                    `${uploadedCount} photo${uploadedCount === 1 ? "" : "s"} uploaded. New photos may take a few minutes to become searchable.`,
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
                  <p className="sidebar-label">Filters</p>
                  <h2>Refine photos</h2>
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
                  <p className="sidebar-label">{resultsLabel}</p>
                  <h2>{resultsTitle}</h2>
                  <p className="status-copy">{resultsMessage}</p>
                </div>
                <div className="results-actions">
                  <div className="view-toggle" aria-label="Result display mode">
                    <button
                      aria-pressed={resultView === "grid"}
                      className={resultView === "grid" ? "is-active" : ""}
                      onClick={() => setResultView("grid")}
                      type="button"
                    >
                      Grid
                    </button>
                    <button
                      aria-pressed={resultView === "list"}
                      className={resultView === "list" ? "is-active" : ""}
                      onClick={() => setResultView("list")}
                      type="button"
                    >
                      List
                    </button>
                  </div>
                  {securityContext.deniedResults ? (
                    <span className="mode-subtle">{securityContext.deniedResults} hidden by access rules</span>
                  ) : null}
                </div>
              </div>

              {error ? <p className="error-banner">{error}</p> : null}

              {!hasSubmittedSearch && !isLoading && !error ? (
                <section className="browse-start" aria-label="Common photo requests">
                  <div className="browse-start-header">
                    <h3>Common requests</h3>
                    <p>Choose a starting point, then narrow the results with filters.</p>
                  </div>
                  <div className="browse-card-grid">
                    {DEPARTMENT_WORKFLOWS.map((workflow) => (
                      <button
                        className="browse-card"
                        key={workflow.label}
                        onClick={() => handleWorkflowSearch(workflow.query)}
                        type="button"
                      >
                        <span>{workflow.status}</span>
                        <strong>{workflow.label}</strong>
                        <p>{workflow.detail}</p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <PhotoGrid
                isLoading={isLoading}
                onOpen={setSelectedPhoto}
                results={results}
                viewMode={resultView}
                submittedQuery={submittedQuery}
              />
            </section>
          </section>

          <footer className="site-footer">
            <p>©2026 SUPREME AI VENTURES LLC</p>
          </footer>
        </div>
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

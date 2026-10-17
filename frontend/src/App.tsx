import { useEffect, useRef, useState, type MouseEvent } from "react";

import { searchPhotos } from "./api";
import { assetClearance } from "./assetClearance";
import { currentAuthSession, signOut } from "./auth";
import { LandingPage } from "./components/LandingPage";
import { Brand } from "./components/Brand";
import { AdminPanel } from "./components/AdminPanel";
import { FilterPanel } from "./components/FilterPanel";
import { LoginPanel } from "./components/LoginPanel";
import { PhotoGrid } from "./components/PhotoGrid";
import { PhotoModal } from "./components/PhotoModal";
import { ReviewQueue } from "./components/ReviewQueue";
import { SearchBar } from "./components/SearchBar";
import { UploadPanel } from "./components/UploadPanel";
import type { AuthSession, PhotoResult, SearchFilters } from "./types";

type RouteView = "landing" | "workspace";
type WorkspaceView = "library" | "upload" | "review" | "access";

const WORKSPACE_PATH = "/app";

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

const API_URL = import.meta.env.VITE_API_URL?.trim() ?? "";
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? "";
const IS_PREVIEW_MODE = !API_URL;
const WORKSPACE_HOSPITAL_NAME = "Briar University Hospital";
const DEFAULT_PREVIEW_QUERY = "approved hospital";

function getRouteView(): RouteView {
  return window.location.pathname.replace(/\/$/, "") === WORKSPACE_PATH ? "workspace" : "landing";
}

function getWorkspaceView(): WorkspaceView {
  const view = window.location.hash.slice(1);
  return view === "upload" || view === "review" || view === "access" ? view : "library";
}

export function App() {
  const didSeedPreviewRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRequestRef = useRef(0);

  const [routeView, setRouteView] = useState<RouteView>(() => getRouteView());
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(getWorkspaceView);
  const [hasOpenedUpload, setHasOpenedUpload] = useState(() => getWorkspaceView() === "upload");
  const [reviewRevision, setReviewRevision] = useState(0);
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [resultView, setResultView] = useState<"grid" | "list">("grid");
  const [clearanceView, setClearanceView] = useState("all");
  const [results, setResults] = useState<PhotoResult[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [status, setStatus] = useState("Ready to search.");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoResult | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => currentAuthSession());
  const authSessionRef = useRef(authSession);
  authSessionRef.current = authSession;
  const [securityContext, setSecurityContext] = useState({
    authMode: "anonymous",
    deniedResults: 0,
    groups: [] as string[],
  });

  useEffect(() => {
    window.addEventListener("photoscribe:session-expired", handleSignOut);
    return () => window.removeEventListener("photoscribe:session-expired", handleSignOut);
  }, []);

  useEffect(() => {
    function handlePopState() {
      setRouteView(getRouteView());
      const view = getWorkspaceView();
      setWorkspaceView(view);
      if (view === "upload") setHasOpenedUpload(true);
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (routeView !== "landing") {
      return;
    }

    function scrollToCurrentHash() {
      const targetId = window.location.hash.slice(1);
      if (!targetId) {
        return;
      }

      const scrollToTarget = () => {
        document.getElementById(decodeURIComponent(targetId))?.scrollIntoView({ block: "start" });
      };

      window.requestAnimationFrame(scrollToTarget);
      window.setTimeout(scrollToTarget, 150);
    }

    scrollToCurrentHash();
    window.addEventListener("hashchange", scrollToCurrentHash);
    return () => window.removeEventListener("hashchange", scrollToCurrentHash);
  }, [routeView]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const isTypingTarget =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (event.key === "/" && !isTypingTarget && routeView === "workspace" && authSession) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [authSession, routeView]);

  useEffect(() => {
    if (
      didSeedPreviewRef.current ||
      routeView !== "workspace" ||
      !authSession ||
      submittedQuery ||
      isLoading
    ) {
      return;
    }

    const initialQuery = new URLSearchParams(window.location.search).get("q") || (IS_PREVIEW_MODE ? DEFAULT_PREVIEW_QUERY : "");
    if (!initialQuery) return;
    didSeedPreviewRef.current = true;
    setQuery(initialQuery);
    void handleSearch(initialQuery, filters);
  }, [authSession, filters, isLoading, routeView, submittedQuery]);

  function navigateToWorkspace() {
    if (window.location.pathname !== WORKSPACE_PATH) {
      window.history.pushState({}, "", WORKSPACE_PATH);
    }

    setRouteView("workspace");
    window.scrollTo({ top: 0 });
  }

  function navigateToLanding() {
    if (window.location.pathname !== "/") {
      window.history.pushState({}, "", "/");
    }

    setRouteView("landing");
    setSelectedPhoto(null);
    setError("");
    window.scrollTo({ top: 0 });
  }

  function handleWorkspaceLink(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    navigateToWorkspace();
  }

  function handleLandingLink(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    navigateToLanding();
  }

  async function handleSearch(nextQuery = query, nextFilters = filters) {
    if (!authSession) return;
    const requestId = ++searchRequestRef.current;
    const trimmedQuery = nextQuery.trim();

    if (!trimmedQuery) {
      setError("Enter a search phrase first.");
      setStatus("Search needs a query.");
      setResults([]);
      setSubmittedQuery("");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await searchPhotos(trimmedQuery, nextFilters);
      if (requestId !== searchRequestRef.current) return;
      setResults(response.results);
      setSecurityContext(response.securityContext ?? { authMode: "anonymous", deniedResults: 0, groups: [] });
      setSubmittedQuery(response.query);
      if (window.location.pathname === WORKSPACE_PATH) {
        const url = new URL(window.location.href);
        url.searchParams.set("q", response.query);
        window.history.replaceState({}, "", url);
      }
      setStatus(`${response.message} ${response.results.length} result${response.results.length === 1 ? "" : "s"}.`);
    } catch (caughtError) {
      if (requestId !== searchRequestRef.current) return;
      setResults([]);
      setSecurityContext({ authMode: "anonymous", deniedResults: 0, groups: [] });
      setSubmittedQuery(trimmedQuery);
      setStatus("Search request failed.");
      setError(caughtError instanceof Error ? caughtError.message : "Unknown error.");
    } finally {
      if (requestId === searchRequestRef.current) setIsLoading(false);
    }
  }

  function handleFilterChange(nextFilters: SearchFilters) {
    setFilters(nextFilters);
    if (authSession && submittedQuery) {
      void handleSearch(submittedQuery, nextFilters);
    }
  }

  function handleSignOut() {
    searchRequestRef.current += 1;
    signOut();
    didSeedPreviewRef.current = false;
    setAuthSession(null);
    setQuery("");
    setSubmittedQuery("");
    setFilters({});
    setResults([]);
    setSelectedPhoto(null);
    setError("");
    setIsLoading(false);
    setHasOpenedUpload(false);
    setWorkspaceView("library");
    setSecurityContext({ authMode: "anonymous", deniedResults: 0, groups: [] });
    setStatus("Sign in to view and manage private hospital photos.");
  }

  function handleWorkflowSearch(workflowQuery: string) {
    if (!authSession) {
      return;
    }

    setQuery(workflowQuery);
    void handleSearch(workflowQuery, filters);
  }

  function handlePhotoUpdated(updatedPhoto: PhotoResult) {
    if (!authSession || authSessionRef.current?.idToken !== authSession.idToken) return;
    setReviewRevision((current) => current + 1);
    setSelectedPhoto((current) => current?.key === updatedPhoto.key ? updatedPhoto : current);
    setResults((currentResults) =>
      currentResults.map((result) => {
        const sameAsset = result.key === updatedPhoto.key || (Boolean(updatedPhoto.s3Key) && result.s3Key === updatedPhoto.s3Key);
        return sameAsset ? { ...result, ...updatedPhoto } : result;
      }),
    );
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const userGroups = authSession?.groups ?? [];
  const canReview = userGroups.includes("admin") || userGroups.includes("reviewer");
  const canAdmin = userGroups.includes("admin");
  const permittedWorkspaceView =
    (workspaceView === "review" && !canReview) || (workspaceView === "access" && !canAdmin)
      ? "library"
      : workspaceView;
  const isSignedIn = Boolean(authSession);
  const hasSubmittedSearch = Boolean(submittedQuery);
  const showMetrics = isSignedIn && (hasSubmittedSearch || isLoading);
  const approvedCount = results.filter((result) => assetClearance(result).tone === "approved").length;
  const pendingReviewCount = results.filter((result) => assetClearance(result).tone !== "approved" && result.visibility !== "restricted").length;
  const restrictedCount = results.filter((result) => result.visibility === "restricted").length;
  const visibleResults = results.filter((result) => clearanceView === "all" ||
    (clearanceView === "cleared" && assetClearance(result).tone === "approved") ||
    (clearanceView === "review" && assetClearance(result).tone !== "approved" && result.visibility !== "restricted") ||
    (clearanceView === "restricted" && result.visibility === "restricted"));
  const resultsLabel = hasSubmittedSearch ? "Matching photos" : "Browse";
  const resultsTitle = hasSubmittedSearch ? `“${submittedQuery}”` : "Common requests";
  const resultsMessage =
    hasSubmittedSearch || isLoading || error
      ? status
      : "Ready to search.";
  const primaryRole = userGroups[0] === "hr" ? "HR" : userGroups[0]?.replace(/_/g, " ") || "staff";
  const accountInitials = (authSession?.email ?? "Briar staff")
    .split(/[@.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const workspaceNavItems: Array<{ label: string; view: WorkspaceView }> = [
    { label: "Library", view: "library" },
    { label: "Upload", view: "upload" },
    ...(canReview ? [{ label: "Review", view: "review" as const }] : []),
    ...(canAdmin ? [{ label: "Access", view: "access" as const }] : []),
  ];
  const workspaceViewCopy: Record<WorkspaceView, { eyebrow: string; title: string; description: string }> = {
    library: {
      eyebrow: "Media library",
      title: "Photo library",
      description: "Find approved assets and verify release context before reuse.",
    },
    upload: {
      eyebrow: "Intake",
      title: "Upload photos",
      description: "Add files to the private library for indexing and review.",
    },
    review: {
      eyebrow: "Governance",
      title: "Review queue",
      description: "Resolve consent, rights, visibility, and approval status for new assets.",
    },
    access: {
      eyebrow: "Administration",
      title: "User access",
      description: "Invite staff and assign the roles they need for media work.",
    },
  };
  const activeWorkspaceCopy = workspaceViewCopy[permittedWorkspaceView];
  useEffect(() => {
    document.title = routeView === "landing" ? "CareFrame | Hospital Media Library" :
      `${isSignedIn ? activeWorkspaceCopy.title : "Staff sign in"} | CareFrame`;
  }, [routeView, isSignedIn, activeWorkspaceCopy.title]);
  const metricCards = [
    {
      label: "Photos shown",
      tone: "neutral",
      value: hasSubmittedSearch ? results.length : "Ready",
    },
    {
      label: "Cleared",
      tone: "approved",
      value: hasSubmittedSearch ? approvedCount : "-",
    },
    {
      label: "Needs review",
      tone: "warning",
      value: hasSubmittedSearch ? pendingReviewCount : "-",
    },
    {
      label: "Restricted",
      tone: "neutral",
      value: hasSubmittedSearch ? restrictedCount : "-",
    },
  ];

  const signedOutWorkspacePage = (
    <main className="workspace-access-page" id="app">
      <header className="workspace-access-header">
        <a className="workspace-brand" href="/" onClick={handleLandingLink}>
          <Brand />
        </a>
        <a className="workspace-about-link" href="/" onClick={handleLandingLink}>
          About CareFrame
        </a>
      </header>

      <section className="workspace-access-stage">
        <div className="workspace-access-context">
          <div>
            <p className="workspace-overline">{WORKSPACE_HOSPITAL_NAME}</p>
            <h1>Staff sign in</h1>
            <p className="workspace-access-lede">
              Your hospital's photo library, for authorized staff.
            </p>
          </div>

        </div>

        <div className="workspace-login-column">
          <LoginPanel
            authSession={authSession}
            onSignIn={(session) => {
              setAuthSession(session);
              setSecurityContext({ authMode: "jwt", deniedResults: 0, groups: session.groups });
            }}
            onSignOut={handleSignOut}
          />
          <p className="workspace-login-help">Need an account? Contact your media library administrator.</p>
        </div>
      </section>

      <footer className="workspace-access-footer">
        <span>CareFrame</span>
        <span>Private hospital media workspace</span>
      </footer>
    </main>
  );

  const signedInWorkspacePage = (
    <main className="workspace-v2" id="app">
      <header className="workspace-topbar">
        <div className="workspace-topbar-branding">
          <a className="workspace-brand" href={WORKSPACE_PATH} onClick={(event) => handleWorkspaceLink(event)}>
            <Brand />
          </a>
          <span className="workspace-topbar-divider" />
          <div className="workspace-hospital-name">
            <span>Library</span>
            <strong>{WORKSPACE_HOSPITAL_NAME}</strong>
          </div>
        </div>

        <div className="workspace-account">
          <span className="workspace-avatar" aria-hidden="true">
            {accountInitials || "BS"}
          </span>
          <span className="workspace-account-copy">
            <strong title={authSession?.email}>{authSession?.email}</strong>
            <small>{primaryRole}</small>
          </span>
          <button className="workspace-signout" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </header>

      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <div>
            <p className="workspace-sidebar-label">Workspace</p>
            <nav aria-label="Workspace sections">
              {workspaceNavItems.map((item) => (
                <button
                  aria-current={permittedWorkspaceView === item.view ? "page" : undefined}
                  className={permittedWorkspaceView === item.view ? "is-active" : ""}
                  key={item.view}
                  onClick={() => {
                    setSelectedPhoto(null);
                    setWorkspaceView(item.view);
                    if (item.view === "upload") setHasOpenedUpload(true);
                    window.history.pushState({}, "", `${WORKSPACE_PATH}${window.location.search}#${item.view}`);
                    window.scrollTo({ top: 0 });
                  }}
                  type="button"
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

        </aside>

        <section className={`workspace-stage${selectedPhoto && permittedWorkspaceView === "library" ? " has-inspector" : ""}`}>
          <header className="workspace-page-header">
            <div>
              <h1>{activeWorkspaceCopy.title}</h1>
            </div>
            {permittedWorkspaceView === "library" ? (
              <div className="library-heading-actions"><span className={`workspace-environment${IS_PREVIEW_MODE ? " is-sample" : ""}`}>
                {IS_PREVIEW_MODE ? "Sample data" : "Private library"}
              </span><button className="library-upload" type="button" onClick={() => {
                setSelectedPhoto(null); setWorkspaceView("upload"); setHasOpenedUpload(true);
                window.history.pushState({}, "", `${WORKSPACE_PATH}${window.location.search}#upload`);
              }}>Upload photos</button></div>
            ) : null}
          </header>
          {IS_PREVIEW_MODE && permittedWorkspaceView === "library" ? (
            <p className="sample-library-note">Illustrative photography and fictional policy records. These are not hospital staff or patient assets.</p>
          ) : null}

          {permittedWorkspaceView === "library" ? (
            <div className="workspace-library" id="library">
              <section className="workspace-search-surface" aria-label="Photo search">
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

              {showMetrics && hasSubmittedSearch && !isLoading ? (
                <div className="workspace-metric-strip" aria-label="Status of the results shown">
                  {metricCards.map((metric, index) => (
                    <button type="button" aria-pressed={clearanceView === ["all", "cleared", "review", "restricted"][index]}
                      onClick={() => setClearanceView(["all", "cleared", "review", "restricted"][index])}
                      className={`workspace-metric is-${metric.tone}`} key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </button>
                  ))}
                </div>
              ) : null}

              <section className="content-grid product-workspace">
                <aside className="sidebar-panel">
                  <div className="sidebar-header">
                    <div>
                      <p className="sidebar-label">Filters</p>
                      <h2>Refine</h2>
                    </div>
                    <div className="filter-header-actions">
                      {activeFilterCount ? <span className="filter-count">{activeFilterCount}</span> : null}
                      <button
                        aria-expanded={isFiltersOpen}
                        className="mobile-filter-toggle"
                        onClick={() => setIsFiltersOpen((current) => !current)}
                        type="button"
                      >
                        {isFiltersOpen ? "Done" : "Filters"}
                      </button>
                    </div>
                  </div>

                  <div className={`mobile-filter-content${isFiltersOpen ? " is-open" : ""}`}>
                    <FilterPanel
                      disabled={isLoading}
                      filters={filters}
                      onChange={handleFilterChange}
                      onClear={() => handleFilterChange({})}
                    />
                  </div>
                </aside>

                <section className="results-panel">
                  <div className="results-summary">
                    <div>
                      <p className="sidebar-label">{resultsLabel}</p>
                      <h2>{resultsTitle}</h2>
                      <p className="status-copy" role="status" aria-live="polite">{resultsMessage}</p>
                    </div>
                    {hasSubmittedSearch || isLoading ? (
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
                    ) : null}
                  </div>

                  {hasSubmittedSearch ? (
                    <section className="request-strip" aria-label="Common photo request shortcuts">
                      <span>Shortcuts</span>
                      <div className="request-chip-row">
                        {DEPARTMENT_WORKFLOWS.map((workflow) => (
                          <button
                            className="request-chip"
                            key={workflow.label}
                            onClick={() => handleWorkflowSearch(workflow.query)}
                            type="button"
                          >
                            {workflow.label}
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {error ? (
                    <div className="error-banner" role="alert">
                      <strong>Search could not finish.</strong>
                      <p>{error}</p>
                    </div>
                  ) : null}

                  {!hasSubmittedSearch && !isLoading && !error ? (
                    <section className="browse-start" aria-label="Common photo requests">
                      <div className="browse-card-grid">
                        {DEPARTMENT_WORKFLOWS.map((workflow) => (
                          <button
                            className="browse-card"
                            key={workflow.label}
                            onClick={() => handleWorkflowSearch(workflow.query)}
                            type="button"
                          >
                            <strong>{workflow.label}</strong>
                            <p>{workflow.query}</p>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <PhotoGrid
                    selectedKey={selectedPhoto?.key}
                    isLoading={isLoading}
                    onOpen={setSelectedPhoto}
                    results={visibleResults}
                    viewMode={resultView}
                    submittedQuery={submittedQuery}
                  />
                </section>
              </section>
            </div>
          ) : null}

          {hasOpenedUpload ? (
            <div hidden={permittedWorkspaceView !== "upload"}>
              <UploadPanel
              onUploaded={(uploadedCount) => {
                setStatus(
                  `${uploadedCount} photo${uploadedCount === 1 ? "" : "s"} uploaded. New photos may take a few minutes to become searchable.`,
                );
              }}
              />
            </div>
          ) : null}

          {permittedWorkspaceView === "review" && canReview ? (
            <div className={`review-workbench${selectedPhoto ? " has-photo" : ""}`}>
              <ReviewQueue canReview={canReview} onOpen={setSelectedPhoto} revision={reviewRevision} selectedKey={selectedPhoto?.key} />
              {selectedPhoto ? <PhotoModal authSession={authSession} canCurate={canReview} initialTab="edit"
                presentation="review" photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} onPhotoUpdated={handlePhotoUpdated} /> :
                <p className="review-selection-hint">Select a photo to check its owner, consent and usage rights.</p>}
            </div>
          ) : null}

          {permittedWorkspaceView === "access" && canAdmin ? <AdminPanel canAdmin={canAdmin} /> : null}
        </section>
      </div>
    </main>
  );

  const workspacePage = isSignedIn ? signedInWorkspacePage : signedOutWorkspacePage;

  return (
    <>
      {routeView === "landing" ? <LandingPage onWorkspace={handleWorkspaceLink} contactEmail={CONTACT_EMAIL} /> : null}
      {routeView === "workspace" || isSignedIn ? <div hidden={routeView !== "workspace"}>{workspacePage}</div> : null}
      <PhotoModal
        authSession={authSession}
        canCurate={canReview}
        initialTab={permittedWorkspaceView === "review" ? "edit" : "overview"}
        presentation="inspector"
        onPhotoUpdated={handlePhotoUpdated}
        photo={permittedWorkspaceView === "library" ? selectedPhoto : null}
        onClose={() => setSelectedPhoto(null)}
      />
    </>
  );
}

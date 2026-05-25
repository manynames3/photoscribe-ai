import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";

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

type RouteView = "landing" | "workspace";

const WORKSPACE_PATH = "/app";

const NAV_ITEMS = [
  { href: "#problem", label: "Problem" },
  { href: "#workflow", label: "Workflow" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#trust", label: "Trust" },
  { href: "#pilot", label: "Pilot" },
];

const HERO_PROOF_POINTS = [
  "Private hospital media library",
  "Staff-only upload and review",
  "AWS serverless implementation",
];

const SUPPORTED_TRUST_SIGNALS = [
  {
    label: "Access",
    value: "Cognito staff sign-in and role groups",
  },
  {
    label: "Storage",
    value: "Private S3 originals with signed image links",
  },
  {
    label: "Review",
    value: "Pending-review defaults and asset policy table",
  },
  {
    label: "Operations",
    value: "SQS, DLQ, CloudWatch alarms, and smoke test script",
  },
];

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

const QUICK_START_STEPS = [
  {
    label: "Ask for the image",
    text: "Search the way a hospital team actually asks: “physician speaking with family” or “approved executive headshot.”",
  },
  {
    label: "Check if it is usable",
    text: "Open a result and review owner department, consent, usage rights, campaign, location, and staff context.",
  },
  {
    label: "Route new uploads",
    text: "Authorized staff upload photos, hold them for review, and add the human context AI cannot infer.",
  },
];

const PROBLEM_CARDS = [
  {
    copy: "Approved photos live across shared drives, inboxes, desktop exports, and project folders instead of one searchable library.",
    label: "Photos are scattered",
  },
  {
    copy: "Teams need consent, usage rights, department owner, campaign, and release readiness before reusing an image.",
    label: "Review context is missing",
  },
  {
    copy: "Manual tags rarely stay consistent, and filenames like IMG_4872.jpg do not match how staff describe what they need.",
    label: "Manual tagging breaks down",
  },
];

const PILOT_ITEMS = [
  {
    label: "Best first customer",
    text: "Hospital marketing or communications team with approved photos scattered across shared drives.",
  },
  {
    label: "Pilot workflow",
    text: "Load one private media library, review a first batch, and prove faster reuse for campaign and department requests.",
  },
  {
    label: "Commercial model",
    text: "Managed setup plus a monthly private workspace with approved staff accounts, upload limits, and review controls.",
  },
];

const PRODUCT_CARDS = [
  {
    copy: "Search by person, department, event, location, campaign, or natural-language description instead of guessing folder names.",
    label: "Find photos by meaning",
  },
  {
    copy: "New uploads move through a review queue before they become broadly searchable.",
    label: "Hold uploads for review",
  },
  {
    copy: "Staff can add the human context AI cannot infer: names, departments, campaigns, locations, consent, and rights.",
    label: "Add human metadata",
  },
  {
    copy: "Approved media becomes reusable for communications, HR, facilities, leadership, and compliance requests.",
    label: "Reuse with policy context",
  },
];

const FEATURE_CARDS = [
  {
    copy: "Amazon Bedrock Nova Lite describes each upload, Titan Embeddings turns the description into a vector, and S3 Vectors powers meaning-based search.",
    label: "AI metadata and vectors",
  },
  {
    copy: "Reviewers assign department, usage rights, consent status, campaign, location, staff names, visibility, and approval state.",
    label: "Curated governance fields",
  },
  {
    copy: "Browser uploads go directly to private S3 with signed URLs and SHA-256 duplicate checks before Bedrock processing.",
    label: "Direct private uploads",
  },
  {
    copy: "SQS buffers ingest events, a DLQ retains failures, and CloudWatch alarms surface Lambda, API, and queue issues.",
    label: "Operational guardrails",
  },
];

const SECURITY_ITEMS = [
  "Private S3 objects with signed image URLs",
  "Cognito JWT auth and role groups",
  "DynamoDB asset policy and audit tables",
  "Pending-review defaults for new assets",
  "CloudWatch alarms with SNS email notification",
  "GitHub Actions secrets for deploy credentials",
];

const INTEGRATIONS = [
  "Amazon S3",
  "Amazon Bedrock",
  "Titan Embeddings",
  "Amazon S3 Vectors",
  "AWS Lambda",
  "API Gateway",
  "Amazon Cognito",
  "DynamoDB",
  "SQS",
  "CloudWatch",
  "Cloudflare Pages",
  "GitHub Actions",
];

const API_URL = import.meta.env.VITE_API_URL?.trim() ?? "";
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? "";
const IS_PREVIEW_MODE = !API_URL;
const DEFAULT_PREVIEW_QUERY = "approved hospital";

const EMPTY_PILOT_REQUEST = {
  email: "",
  name: "",
  organization: "",
  role: "",
  useCase: "",
  volume: "",
};

function requestAccessHref() {
  return "/#pilot-request";
}

function getRouteView(): RouteView {
  return window.location.pathname.replace(/\/$/, "") === WORKSPACE_PATH ? "workspace" : "landing";
}

export function App() {
  const didSeedPreviewRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [routeView, setRouteView] = useState<RouteView>(() => getRouteView());
  const [query, setQuery] = useState("");
  const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [resultView, setResultView] = useState<"grid" | "list">("grid");
  const [results, setResults] = useState<PhotoResult[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [status, setStatus] = useState("Choose a common request below or search in plain language.");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pilotRequest, setPilotRequest] = useState(EMPTY_PILOT_REQUEST);
  const [pilotRequestStatus, setPilotRequestStatus] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoResult | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => currentAuthSession());
  const [securityContext, setSecurityContext] = useState({
    authMode: "anonymous",
    deniedResults: 0,
    groups: [] as string[],
  });

  useEffect(() => {
    function handlePopState() {
      setRouteView(getRouteView());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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
    if (didSeedPreviewRef.current || routeView !== "workspace" || !IS_PREVIEW_MODE || submittedQuery || isLoading) {
      return;
    }

    didSeedPreviewRef.current = true;
    setQuery(DEFAULT_PREVIEW_QUERY);
    void handleSearch(DEFAULT_PREVIEW_QUERY, filters);
  }, [filters, isLoading, routeView, submittedQuery]);

  function navigateToWorkspace(openAuthPanel = false) {
    if (window.location.pathname !== WORKSPACE_PATH) {
      window.history.pushState({}, "", WORKSPACE_PATH);
    }

    setRouteView("workspace");
    setIsAuthPanelOpen(openAuthPanel && !authSession);
    window.scrollTo({ top: 0 });
  }

  function navigateToLanding() {
    if (window.location.pathname !== "/") {
      window.history.pushState({}, "", "/");
    }

    setRouteView("landing");
    setIsAuthPanelOpen(false);
    setSelectedPhoto(null);
    window.scrollTo({ top: 0 });
  }

  function handleWorkspaceLink(event: MouseEvent<HTMLAnchorElement>, openAuthPanel = false) {
    event.preventDefault();
    navigateToWorkspace(openAuthPanel);
  }

  function handleLandingLink(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    navigateToLanding();
  }

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
    didSeedPreviewRef.current = false;
    setAuthSession(null);
    setQuery("");
    setSubmittedQuery("");
    setResults([]);
    setSecurityContext({ authMode: "anonymous", deniedResults: 0, groups: [] });
    setStatus("Sign in to view and manage private hospital photos.");
  }

  function handleWorkflowSearch(workflowQuery: string) {
    setQuery(workflowQuery);
    void handleSearch(workflowQuery, filters);
  }

  function handlePilotRequestChange(field: keyof typeof EMPTY_PILOT_REQUEST, value: string) {
    setPilotRequest((current) => ({ ...current, [field]: value }));
    setPilotRequestStatus("");
  }

  function handlePilotRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pilotRequest.name.trim() || !pilotRequest.email.trim() || !pilotRequest.organization.trim()) {
      setPilotRequestStatus("Add your name, work email, and organization before requesting access.");
      return;
    }

    const summary = [
      `Name: ${pilotRequest.name}`,
      `Email: ${pilotRequest.email}`,
      `Organization: ${pilotRequest.organization}`,
      `Role: ${pilotRequest.role || "Not specified"}`,
      `Asset volume: ${pilotRequest.volume || "Not specified"}`,
      `Use case: ${pilotRequest.useCase || "Not specified"}`,
    ].join("\n");

    if (!CONTACT_EMAIL) {
      setPilotRequestStatus("Pilot request summary prepared. Set VITE_CONTACT_EMAIL to send requests directly.");
      return;
    }

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      "CareFrame pilot request",
    )}&body=${encodeURIComponent(summary)}`;
    setPilotRequestStatus("Opening your email client with the pilot request.");
  }

  function handlePhotoUpdated(updatedPhoto: PhotoResult) {
    setSelectedPhoto(updatedPhoto);
    setResults((currentResults) =>
      currentResults.map((result) => {
        const sameAsset = result.key === updatedPhoto.key || (Boolean(updatedPhoto.s3Key) && result.s3Key === updatedPhoto.s3Key);
        return sameAsset ? { ...result, ...updatedPhoto } : result;
      }),
    );
  }

  function handleAuthClick() {
    if (authSession) {
      handleSignOut();
      return;
    }

    setIsAuthPanelOpen((current) => !current);
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const userGroups = authSession?.groups ?? [];
  const canReview = userGroups.includes("admin") || userGroups.includes("reviewer");
  const canAdmin = userGroups.includes("admin");
  const isSignedIn = Boolean(authSession);
  const hasSubmittedSearch = Boolean(submittedQuery);
  const showMetrics = hasSubmittedSearch || isLoading;
  const pendingReviewCount = results.filter((result) => result.reviewStatus === "pending_review").length;
  const approvedCount = results.filter((result) => result.reviewStatus === "approved").length;
  const missingConsentCount = results.filter((result) => !result.consentStatus || result.consentStatus === "missing").length;
  const restrictedCount = results.filter((result) => result.visibility === "restricted").length;
  const resultsLabel = hasSubmittedSearch ? "Matching photos" : "Browse";
  const resultsTitle = hasSubmittedSearch ? `“${submittedQuery}”` : "Start with a common request";
  const resultsMessage =
    hasSubmittedSearch || isLoading || error
      ? status
      : "Choose a card below or search above. New uploads may take a few minutes to finish indexing.";
  const accessHref = requestAccessHref();
  const metricCards = [
    {
      label: "Photos found",
      tone: "neutral",
      value: hasSubmittedSearch ? results.length : "Ready",
    },
    {
      label: "Approved",
      tone: "approved",
      value: hasSubmittedSearch ? approvedCount : "-",
    },
    {
      label: "Needs review",
      tone: "warning",
      value: hasSubmittedSearch ? pendingReviewCount : "-",
    },
    {
      label: "Missing consent",
      tone: "risk",
      value: hasSubmittedSearch ? missingConsentCount : "-",
    },
    {
      label: "Restricted",
      tone: "neutral",
      value: hasSubmittedSearch ? restrictedCount : "-",
    },
  ];

  const landingPage = (
    <main className="app-shell marketing-shell" id="top">
      <header className="site-nav" aria-label="Primary navigation">
        <a className="nav-brand" href="/" onClick={handleLandingLink}>
          <span className="brand-mark">CF</span>
          <span>CareFrame</span>
        </a>

        <nav className="nav-links" aria-label="Page sections">
          {NAV_ITEMS.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <a className="nav-auth-button" href={WORKSPACE_PATH} onClick={(event) => handleWorkspaceLink(event)}>
          Open workspace
        </a>
      </header>

      <section className="landing-hero">
        <div className="hero-copy-block">
          <p className="eyebrow">CareFrame for hospital media teams</p>
          <h1>Make approved hospital photos searchable before teams recreate them.</h1>
          <p className="hero-copy">
            CareFrame turns scattered hospital image folders into a private, searchable, review-ready media library for
            communications, HR, facilities, leadership, and compliance requests.
          </p>

          <div className="hero-actions">
            <a className="primary-cta" href={WORKSPACE_PATH} onClick={(event) => handleWorkspaceLink(event)}>
              Open workspace
            </a>
            <a className="secondary-cta" href={accessHref}>
              Request managed pilot
            </a>
          </div>

          <div className="hero-proof" aria-label="Platform summary">
            {HERO_PROOF_POINTS.map((point) => (
              <span key={point}>{point}</span>
            ))}
          </div>
        </div>

        <div className="hero-product-card" aria-label="CareFrame product preview">
          <div className="product-browser-bar">
            <span />
            <span />
            <span />
            <strong>CareFrame workspace</strong>
          </div>
          <div className="product-console-card">
            <div className="product-shot-header">
              <div>
                <p className="eyebrow">Product preview</p>
                <h2>Search by meaning. Reuse with confidence.</h2>
              </div>
              <span className="workspace-status">Private workspace</span>
            </div>

            <div className="visual-search-row" aria-label="Example search">
              <span>physician speaking with family</span>
              <strong>Search</strong>
            </div>

            <div className="asset-preview-grid">
              <article className="asset-preview-card">
                <div className="asset-preview-thumb">
                  <span>Clinical communications</span>
                </div>
                <div>
                  <strong>Approved physician photo</strong>
                  <p>Owner: Communications</p>
                  <p>Rights: Internal and campaign use</p>
                </div>
              </article>
              <aside className="policy-preview-card">
                <span>Release check</span>
                <strong>Approved for department reuse</strong>
                <dl>
                  <div>
                    <dt>Consent</dt>
                    <dd>Approved</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>Library</dd>
                  </div>
                  <div>
                    <dt>Campaign</dt>
                    <dd>Community health</dd>
                  </div>
                </dl>
              </aside>
            </div>

            <div className="product-preview-grid">
              <div className="product-preview-card">
                <strong>Meaning search</strong>
                <span>Find the asset without knowing filename or folder.</span>
              </div>
              <div className="product-preview-card">
                <strong>Review queue</strong>
                <span>Hold uploads until rights and consent are checked.</span>
              </div>
              <div className="product-preview-card">
                <strong>Curator fields</strong>
                <span>Add staff names, campaign, location, and owner.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-proof-strip" aria-label="Implemented trust signals">
        {SUPPORTED_TRUST_SIGNALS.map((signal) => (
          <article key={signal.label}>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </article>
        ))}
      </section>

      <section className="landing-section problem-section" id="problem">
        <div className="section-kicker">Problem</div>
        <div className="section-heading">
          <h2>The photo exists. The team still cannot find or clear it in time.</h2>
          <p>
            Hospital media teams lose time searching shared drives, asking coworkers, and checking whether an image is
            actually approved for reuse.
          </p>
        </div>
        <div className="editorial-grid">
          {PROBLEM_CARDS.map((card) => (
            <article className="editorial-card" key={card.label}>
              <strong>{card.label}</strong>
              <p>{card.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section workflow-flow-section" id="workflow">
        <div className="section-heading">
          <span className="section-kicker">Workflow</span>
          <h2>From scattered folder to governed media request.</h2>
          <p>
            The workspace focuses on one practical workflow: find a usable image, inspect release context, and route new
            uploads through review before broad staff access.
          </p>
        </div>
        <div className="step-grid">
          {QUICK_START_STEPS.map((step, index) => (
            <article className="step-card" key={step.label}>
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section product-section" id="product">
        <div className="section-heading">
          <span className="section-kicker">Product</span>
          <h2>A working media desk for approved hospital imagery.</h2>
          <p>
            The public page explains the product. The separate staff workspace at `/app` lets authorized users search,
            upload, review, and manage library assets.
          </p>
        </div>

        <div className="landing-product-grid">
          {PRODUCT_CARDS.map((card) => (
            <article className="landing-product-card" key={card.label}>
              <strong>{card.label}</strong>
              <p>{card.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section use-case-section" id="use-cases">
        <div className="section-heading">
          <span className="section-kicker">Use cases</span>
          <h2>Built around the hospital teams that ask for images every week.</h2>
          <p>
            The same asset library supports communications, HR, compliance, facilities, and executive requests without
            exposing internal storage paths to end users.
          </p>
        </div>
        <div className="use-case-grid">
          {DEPARTMENT_WORKFLOWS.map((workflow) => (
            <article className="use-case-card" key={workflow.label}>
              <span>{workflow.status}</span>
              <strong>{workflow.label}</strong>
              <p>{workflow.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section architecture-section" id="architecture">
        <div className="section-heading">
          <span className="section-kicker">Implementation</span>
          <h2>Serverless AWS backend without an always-on search cluster.</h2>
          <p>
            The implementation emphasizes low idle cost, private storage, role-scoped access, and operational guardrails
            without adding an always-on search cluster.
          </p>
        </div>
        <div className="feature-grid">
          {FEATURE_CARDS.map((feature) => (
            <article className="feature-card" key={feature.label}>
              <strong>{feature.label}</strong>
              <p>{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section security-section" id="trust">
        <div className="section-heading is-narrow">
          <span className="section-kicker">Security and trust</span>
          <h2>Designed for private institutional media, not public photo hosting.</h2>
          <p>
            Search results are governed before signed URLs are issued, and new uploads default into review instead of
            broad release.
          </p>
        </div>
        <div className="security-list">
          {SECURITY_ITEMS.map((item) => (
            <div className="security-item" key={item}>
              <span aria-hidden="true">OK</span>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section pilot-section" id="pilot">
        <div className="section-heading">
          <span className="section-kicker">Pilot access</span>
          <h2>Start with one private library and one measurable workflow.</h2>
          <p>
            The first rollout is intentionally focused: one hospital media team, one approved asset library, and one
            measurable outcome: fewer duplicate shoots and faster access to approved imagery.
          </p>
        </div>
        <div className="pilot-grid">
          {PILOT_ITEMS.map((item) => (
            <article className="pilot-card" key={item.label}>
              <strong>{item.label}</strong>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <div className="pilot-callout">
          <div>
            <strong>Private upload access is provisioned for approved pilots.</strong>
            <p>
              AI ingest creates real AWS cost, so staff accounts, upload limits, and review permissions are configured
              deliberately for each private workspace.
            </p>
          </div>
          <a className="primary-cta" href={accessHref}>
            Request pilot access
          </a>
        </div>
        <form className="pilot-request-form" id="pilot-request" onSubmit={handlePilotRequestSubmit}>
          <div>
            <span className="section-kicker">Pilot request</span>
            <h3>Tell us what library you want to make searchable.</h3>
            <p>
              This starts a managed pilot conversation. It is not a public signup and does not request payment details.
            </p>
          </div>

          <div className="pilot-form-grid">
            <label>
              <span>Name</span>
              <input
                autoComplete="name"
                onChange={(event) => handlePilotRequestChange("name", event.target.value)}
                placeholder="Avery Johnson"
                value={pilotRequest.name}
              />
            </label>
            <label>
              <span>Work email</span>
              <input
                autoComplete="email"
                onChange={(event) => handlePilotRequestChange("email", event.target.value)}
                placeholder="avery@hospital.org"
                type="email"
                value={pilotRequest.email}
              />
            </label>
            <label>
              <span>Organization</span>
              <input
                autoComplete="organization"
                onChange={(event) => handlePilotRequestChange("organization", event.target.value)}
                placeholder="Regional Medical Center"
                value={pilotRequest.organization}
              />
            </label>
            <label>
              <span>Role</span>
              <input
                onChange={(event) => handlePilotRequestChange("role", event.target.value)}
                placeholder="Marketing, HR, Compliance"
                value={pilotRequest.role}
              />
            </label>
            <label>
              <span>Asset volume</span>
              <select onChange={(event) => handlePilotRequestChange("volume", event.target.value)} value={pilotRequest.volume}>
                <option value="">Choose range</option>
                <option value="100-500 photos">100-500 photos</option>
                <option value="500-2,000 photos">500-2,000 photos</option>
                <option value="2,000+ photos">2,000+ photos</option>
              </select>
            </label>
            <label>
              <span>Primary use case</span>
              <select onChange={(event) => handlePilotRequestChange("useCase", event.target.value)} value={pilotRequest.useCase}>
                <option value="">Choose workflow</option>
                <option value="Marketing asset search">Marketing asset search</option>
                <option value="Staff headshots">Staff headshots</option>
                <option value="Consent and usage review">Consent and usage review</option>
                <option value="Facilities documentation">Facilities documentation</option>
              </select>
            </label>
          </div>

          <button className="primary-cta" type="submit">
            Request managed pilot
          </button>
          {pilotRequestStatus ? <p className="pilot-form-status">{pilotRequestStatus}</p> : null}
        </form>
      </section>

      <section className="landing-section integrations-section" id="integrations">
        <div className="section-heading">
          <span className="section-kicker">Integrations</span>
          <h2>Implemented on the same cloud services used by the working app.</h2>
          <p>These are the services behind the deployed app, ingest pipeline, search API, auth, and CI/CD path.</p>
        </div>
        <div className="integration-grid" aria-label="Implemented services">
          {INTEGRATIONS.map((integration) => (
            <span key={integration}>{integration}</span>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow">Operational workspace</p>
        <h2>See how a hospital team would find, review, and reuse approved media.</h2>
        <div className="hero-actions">
          <a className="primary-cta" href={WORKSPACE_PATH} onClick={(event) => handleWorkspaceLink(event)}>
            Open workspace
          </a>
          <a className="secondary-cta" href={accessHref}>
            Request managed pilot
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <p>©2026 SUPREME AI VENTURES LLC</p>
      </footer>
    </main>
  );

  const workspacePage = (
    <main className="app-shell marketing-shell workspace-shell" id="app">
      <header className="site-nav workspace-nav" aria-label="Application navigation">
        <a className="nav-brand" href={WORKSPACE_PATH} onClick={(event) => handleWorkspaceLink(event)}>
          <span className="brand-mark">CF</span>
          <span>CareFrame</span>
        </a>

        <nav className="nav-links" aria-label="Workspace sections">
          <a href="/" onClick={handleLandingLink}>
            Overview
          </a>
          <a href="#library">Library</a>
          <a href="#manage">Staff tools</a>
        </nav>

        <button className="nav-auth-button" onClick={handleAuthClick} type="button">
          {authSession ? "Sign out" : "Staff sign in"}
        </button>
      </header>

      <section className="workspace-command" id="search">
        <div className="workspace-command-header">
          <div className="workspace-command-copy">
            <p className="eyebrow">Hospital photo library</p>
            <h1>Find the usable image, then check whether it is cleared.</h1>
            <p>
              Search by person, department, event, location, or description. Open a result to inspect owner, consent,
              rights, visibility, and review state before reuse.
            </p>
          </div>

          <div className="workspace-status-panel" aria-label="Workspace status">
            <div>
              <span>Library</span>
              <strong>{IS_PREVIEW_MODE ? "Preview" : "Private"}</strong>
            </div>
            <div>
              <span>Session</span>
              <strong>{authSession ? authSession.email : "Visitor"}</strong>
            </div>
            <div>
              <span>Controls</span>
              <strong>{authSession ? userGroups.join(", ") || "Staff" : "Locked"}</strong>
            </div>
          </div>
        </div>

        {isSignedIn ? (
          <SearchBar
            disabled={isLoading}
            onChange={setQuery}
            onSubmit={(nextQuery) => {
              void handleSearch(nextQuery);
            }}
            searchInputRef={searchInputRef}
            value={query}
          />
        ) : (
          <div className="locked-search-panel" role="status">
            <div>
              <span>Staff search locked</span>
              <p>Sign in to search by person, department, event, location, or description.</p>
            </div>
            <button className="primary-cta" onClick={() => setIsAuthPanelOpen(true)} type="button">
              Staff sign in
            </button>
          </div>
        )}

        {IS_PREVIEW_MODE ? (
          <div className="preview-notice" role="status">
            <strong>Preview mode</strong>
            <span>Using bundled sample photos. Connect the AWS backend to search a private hospital library.</span>
          </div>
        ) : null}

        {showMetrics ? (
          <div className="metric-strip" aria-label="Photo library status">
            {metricCards.map((metric) => (
              <div className={`metric-card is-${metric.tone}`} key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        ) : null}
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

      <section className="content-grid product-workspace" id="library">
        <aside className="sidebar-panel">
          <div className="sidebar-header">
            <div>
              <p className="sidebar-label">Filters</p>
              <h2>Refine results</h2>
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

          {isSignedIn ? (
            <section className="request-strip" aria-label="Common photo request shortcuts">
              <div>
                <span>Shortcuts</span>
                <p>Run a realistic hospital media search.</p>
              </div>
              <div className="request-chip-row">
                {DEPARTMENT_WORKFLOWS.map((workflow) => (
                  <button
                    className="request-chip"
                    key={workflow.label}
                    onClick={() => handleWorkflowSearch(workflow.query)}
                    type="button"
                  >
                    <span>{workflow.status}</span>
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
              <div className="browse-start-header">
                <div>
                  <h3>New here? Start with one of these requests.</h3>
                  <p>Each card runs a realistic hospital media search. Open a result to inspect rights and review context.</p>
                </div>
                <ol className="quick-start-list" aria-label="Suggested workflow">
                  {QUICK_START_STEPS.map((step) => (
                    <li key={step.label}>{step.label}</li>
                  ))}
                </ol>
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

      {isSignedIn ? (
        <section className="landing-section management-section workspace-management" id="manage">
          <div className="section-heading is-narrow">
            <span className="section-kicker">Staff tools</span>
            <h2>Upload, review, and administer the library.</h2>
            <p>Signed-in staff can add files, classify new assets, and invite users based on role.</p>
          </div>
          <UploadPanel
            onUploaded={(uploadedCount) => {
              setStatus(
                `${uploadedCount} photo${uploadedCount === 1 ? "" : "s"} uploaded. New photos may take a few minutes to become searchable.`,
              );
            }}
          />
          <ReviewQueue canReview={canReview} onOpen={setSelectedPhoto} />
          <AdminPanel canAdmin={canAdmin} />
        </section>
      ) : (
        <section className="staff-gate-panel" id="manage">
          <div>
            <p className="eyebrow">Staff tools</p>
            <h2>Sign in to upload, review, and manage assets.</h2>
            <p>Upload controls, review queues, and admin tools are hidden until an authorized staff member signs in.</p>
          </div>
          <ul className="staff-gate-list" aria-label="Staff-only capabilities">
            <li>
              <strong>Upload intake</strong>
              <span>Direct image upload with duplicate checks before ingest.</span>
            </li>
            <li>
              <strong>Review queue</strong>
              <span>Approve, restrict, or route photos that need policy context.</span>
            </li>
            <li>
              <strong>User access</strong>
              <span>Invite staff by admin, reviewer, marketing, HR, compliance, or facilities role.</span>
            </li>
          </ul>
          <div className="staff-gate-actions">
            <button className="primary-cta" onClick={() => setIsAuthPanelOpen(true)} type="button">
              Staff sign in
            </button>
            <a className="secondary-cta" href={accessHref}>
              Request pilot access
            </a>
          </div>
        </section>
      )}

      <footer className="site-footer">
        <p>©2026 SUPREME AI VENTURES LLC</p>
      </footer>
    </main>
  );

  return (
    <>
      {routeView === "workspace" ? workspacePage : landingPage}
      <PhotoModal
        authSession={authSession}
        canCurate={canReview}
        onPhotoUpdated={handlePhotoUpdated}
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
    </>
  );
}

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";

import "../landing.css";
import { Brand } from "./Brand";

export interface LandingPageProps {
  onWorkspace: (event: MouseEvent<HTMLAnchorElement>) => void;
  contactEmail: string;
}

type FieldName = "name" | "email" | "hospital";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAV_ITEMS = [
  { href: "#workflow", label: "Workflow" },
  { href: "#policy", label: "Policy details" },
  { href: "#privacy", label: "Privacy" },
  { href: "#pilot", label: "Managed pilot" },
];

const WORKFLOW_STEPS = [
  {
    number: "01",
    title: "Find",
    image: "/media/portrait.jpg",
    imageAlt: "Illustrative staff portrait",
    text: "Search by what is in the photo, not what someone named the file. Try “physician speaking with a family,” then narrow the results by department, location, or review status.",
  },
  {
    number: "02",
    title: "Check",
    image: "/media/campus.jpg",
    imageAlt: "Illustrative hospital campus photograph",
    text: "See the recorded consent status, usage rights, and responsible department. Check those details against your intended use before sharing the photo.",
  },
  {
    number: "03",
    title: "Review",
    image: "/media/team.jpg",
    imageAlt: "Illustrative team photograph",
    text: "New uploads start in review. Reviewers record consent and usage rights, then decide whether to approve the photo and who can access it.",
  },
];

const AUDIENCES = [
  { team: "Marketing and communications", need: "Campaign, intranet, and department requests." },
  { team: "Human resources", need: "Staff portraits and event photos with context attached." },
  { team: "Facilities", need: "Campus, interior, and renovation documentation." },
];

const POLICY_DETAILS = [
  { term: "Owner department", detail: "Who is responsible for the image and who to ask about it." },
  { term: "Consent status", detail: "The consent status recorded by your reviewers, including missing or unknown consent." },
  { term: "Usage rights", detail: "Recorded permissions and restrictions, such as internal-only or campaign-specific use." },
  { term: "Campaign and location", detail: "The project, event, or place the photo belongs to." },
  { term: "Visibility and approval", detail: "Whether an asset is approved, pending, or restricted to certain roles." },
];

const PRIVACY_ITEMS = [
  {
    title: "Private library",
    text: "Photo files are stored privately. Staff must sign in and have the required access to view them.",
  },
  {
    title: "Staff accounts and roles",
    text: "Administrators assign access for searching, uploading, reviewing, and managing staff accounts.",
  },
  {
    title: "Pending review by default",
    text: "Reviewers can access new uploads while they are pending. Other staff cannot view them until they are approved and their access allows it.",
  },
  {
    title: "Public page, private library",
    text: "Photography on this page is public and illustrative. No hospital media appears here, and the workspace is set up around the fictional Briar University Hospital.",
  },
];

const TEAM_OPTIONS = ["Marketing and communications", "Human resources", "Facilities", "Other"];

const USE_CASE_OPTIONS = [
  "Campaign and department requests",
  "Staff portraits and event photos",
  "Campus and facilities documentation",
  "Not sure yet",
];

const EMPTY_FORM = { name: "", email: "", hospital: "", team: "", useCase: "" };

export function LandingPage({ onWorkspace, contactEmail }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState("");
  const [prepared, setPrepared] = useState<{ summary: string; viaEmail: boolean } | null>(null);
  const [copyNote, setCopyNote] = useState("");

  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);

  const trimmedContactEmail = contactEmail.trim();
  const hasContactEmail = EMAIL_PATTERN.test(trimmedContactEmail);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMenuOpen]);

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === "name" || name === "email" || name === "hospital") {
      setFieldErrors((current) => ({ ...current, [name]: undefined }));
    }
    // Any edit makes a prepared summary stale.
    setFormError("");
    setPrepared(null);
    setCopyNote("");
  }

  function handleWorkspaceClick(event: MouseEvent<HTMLAnchorElement>) {
    setIsMenuOpen(false);
    onWorkspace(event);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const values = {
      name: form.name.trim(),
      email: form.email.trim(),
      hospital: form.hospital.trim(),
    };
    const errors: Partial<Record<FieldName, string>> = {};
    if (!values.name) errors.name = "Enter your name.";
    if (!values.email) errors.email = "Enter your work email.";
    else if (!EMAIL_PATTERN.test(values.email)) errors.email = "Enter an email address like name@hospital.org.";
    if (!values.hospital) errors.hospital = "Enter your hospital.";

    setFieldErrors(errors);
    setPrepared(null);
    setCopyNote("");

    const firstInvalid = (["name", "email", "hospital"] as FieldName[]).find((field) => errors[field]);
    if (firstInvalid) {
      setFormError("Check the highlighted fields before continuing.");
      const control = formRef.current?.elements.namedItem(firstInvalid);
      if (control instanceof HTMLElement) control.focus();
      return;
    }

    setFormError("");
    const summary = [
      "CareFrame managed pilot request",
      "",
      `Name: ${values.name}`,
      `Work email: ${values.email}`,
      `Hospital: ${values.hospital}`,
      `Team: ${form.team || "Not specified"}`,
      `First use case: ${form.useCase || "Not specified"}`,
    ].join("\n");

    setPrepared({ summary, viaEmail: hasContactEmail });

    if (hasContactEmail) {
      window.location.href = `mailto:${trimmedContactEmail}?subject=${encodeURIComponent(
        "CareFrame managed pilot request",
      )}&body=${encodeURIComponent(summary)}`;
    }
  }

  async function handleCopy() {
    if (!prepared) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(prepared.summary);
      setCopyNote("Copied to your clipboard.");
    } catch {
      summaryRef.current?.focus();
      summaryRef.current?.select();
      setCopyNote("Copying is not available in this browser. The request text is selected so you can copy it.");
    }
  }

  const fieldProps = (field: FieldName) => ({
    "aria-describedby": fieldErrors[field] ? `cfl-${field}-error` : undefined,
    "aria-invalid": fieldErrors[field] ? (true as const) : undefined,
    onChange: handleFieldChange,
  });

  return (
    <div className="careframe-landing" id="top">
      <a className="cfl-skip" href="#content">
        Skip to content
      </a>

      <header className="cfl-nav" ref={headerRef}>
        <div className="cfl-wrap cfl-nav-bar">
          <a className="cfl-brand" href="#top" aria-label="CareFrame Media desk, top of page">
            <Brand />
          </a>

          <button
            aria-controls="cfl-menu"
            aria-expanded={isMenuOpen}
            className="cfl-menu-button"
            onClick={() => setIsMenuOpen((open) => !open)}
            ref={menuButtonRef}
            type="button"
          >
            Menu
            <span className="cfl-chevron" aria-hidden="true" />
          </button>

          <nav aria-label="Primary" className={isMenuOpen ? "cfl-menu is-open" : "cfl-menu"} id="cfl-menu">
            <ul>
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <a href={item.href} onClick={() => setIsMenuOpen(false)}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <a className="cfl-staff-access" href="/app" onClick={handleWorkspaceClick}>
            Staff sign in
          </a>
        </div>
      </header>

      <main id="content">
        <section aria-labelledby="cfl-hero-title" className="cfl-hero">
          <img
            alt="Illustrative photograph of a hospital campus"
            className="cfl-hero-image"
            decoding="async"
            height={1000}
            src="/media/campus.jpg"
            width={1600}
          />
          <div className="cfl-hero-scrim" />
          <div className="cfl-wrap cfl-hero-content">
            <p className="cfl-eyebrow">The hospital media library</p>
            <h1 id="cfl-hero-title">CareFrame</h1>
            <p className="cfl-hero-lede">
              Find the right photo. Check its usage rights.
              A private media library for hospital communications, HR, and facilities.
            </p>
            <div className="cfl-actions">
              <a className="cfl-btn cfl-btn-primary" href="#pilot">
                Request a managed pilot
              </a>
              <a className="cfl-btn cfl-btn-outline" href="#workflow">
                See the workflow
              </a>
            </div>
          </div>
          <p className="cfl-caption cfl-caption-hero">Public illustrative photography. Staff media stays private.</p>
        </section>

        <section aria-labelledby="cfl-workflow-title" className="cfl-section" id="workflow">
          <div className="cfl-wrap">
            <div className="cfl-heading">
              <p className="cfl-eyebrow cfl-eyebrow-dark">How it works</p>
              <h2 id="cfl-workflow-title">From photo request to approved image.</h2>
              <p className="cfl-lead">
                Search one library, check the recorded permissions, and keep review decisions with the photo.
              </p>
            </div>
            <ol className="cfl-steps">
              {WORKFLOW_STEPS.map((step) => (
                <li key={step.number}>
                  <img className="cfl-step-image" src={step.image} alt={step.imageAlt} loading="lazy" width={640} height={426} />
                  <span className="cfl-step-number" aria-hidden="true">
                    {step.number}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
            <ul aria-label="Teams served" className="cfl-audience">
              {AUDIENCES.map((audience) => (
                <li key={audience.team}>
                  <strong>{audience.team}</strong>
                  <span>{audience.need}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cfl-policy-title" className="cfl-section cfl-section-tint" id="policy">
          <div className="cfl-wrap cfl-split">
            <figure className="cfl-figure">
              <img
                alt="Illustrative photograph of a hospital corridor"
                height={1000}
                loading="lazy"
                decoding="async"
                src="/media/corridor.jpg"
                width={800}
              />
              <figcaption className="cfl-caption">Illustrative campus photography</figcaption>
            </figure>
            <div className="cfl-split-copy">
              <p className="cfl-eyebrow cfl-eyebrow-dark">Policy details</p>
              <h2 id="cfl-policy-title">Every photo carries its context.</h2>
              <p className="cfl-lead">
                Keep consent status, usage rights, and the responsible department alongside each image.
                Your team can check the record without retracing an email conversation.
              </p>
              <dl className="cfl-details">
                {POLICY_DETAILS.map((item) => (
                  <div key={item.term}>
                    <dt>{item.term}</dt>
                    <dd>{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section aria-labelledby="cfl-privacy-title" className="cfl-section cfl-section-forest" id="privacy">
          <div className="cfl-wrap cfl-privacy">
            <div className="cfl-heading">
              <p className="cfl-eyebrow">Privacy and access</p>
              <h2 id="cfl-privacy-title">A private library for authorized staff.</h2>
              <p className="cfl-lead">
                Your hospital decides who can access photos and how they are approved.
                CareFrame records those decisions; it does not verify consent or replace your approval process.
              </p>
              <a className="cfl-btn cfl-btn-light" href="/app" onClick={handleWorkspaceClick}>
                Staff sign in
              </a>
            </div>
            <ul className="cfl-privacy-list">
              {PRIVACY_ITEMS.map((item) => (
                <li key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cfl-pilot-title" className="cfl-section" id="pilot">
          <div className="cfl-wrap cfl-split cfl-split-pilot">
            <div className="cfl-split-copy">
              <p className="cfl-eyebrow cfl-eyebrow-dark">Managed pilot</p>
              <h2 id="cfl-pilot-title">Start with your team.</h2>
              <p className="cfl-lead">
                Tell us how your team finds and approves photos today. Start a conversation about a managed pilot
                built around your library, reviewers, and first use case.
              </p>
              <p className="cfl-note">
                {hasContactEmail
                  ? "Prepare an email request, then send it from your email app. Nothing is sent from this page."
                  : "Prepare a request summary to share with your CareFrame contact. Nothing is sent from this page."}
              </p>
            </div>

            <div className="cfl-form-panel" id="pilot-request">
              <form noValidate onSubmit={handleSubmit} ref={formRef}>
                <div className="cfl-field">
                  <label htmlFor="cfl-name">Name (required)</label>
                  <input
                    autoComplete="name"
                    id="cfl-name"
                    name="name"
                    required
                    type="text"
                    value={form.name}
                    {...fieldProps("name")}
                  />
                  {fieldErrors.name ? (
                    <p className="cfl-field-error" id="cfl-name-error">
                      {fieldErrors.name}
                    </p>
                  ) : null}
                </div>

                <div className="cfl-field">
                  <label htmlFor="cfl-email">Work email (required)</label>
                  <input
                    autoComplete="email"
                    id="cfl-email"
                    inputMode="email"
                    name="email"
                    required
                    type="email"
                    value={form.email}
                    {...fieldProps("email")}
                  />
                  {fieldErrors.email ? (
                    <p className="cfl-field-error" id="cfl-email-error">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </div>

                <div className="cfl-field">
                  <label htmlFor="cfl-hospital">Hospital (required)</label>
                  <input
                    autoComplete="organization"
                    id="cfl-hospital"
                    name="hospital"
                    required
                    type="text"
                    value={form.hospital}
                    {...fieldProps("hospital")}
                  />
                  {fieldErrors.hospital ? (
                    <p className="cfl-field-error" id="cfl-hospital-error">
                      {fieldErrors.hospital}
                    </p>
                  ) : null}
                </div>

                <div className="cfl-field-row">
                  <div className="cfl-field">
                    <label htmlFor="cfl-team">Your team (optional)</label>
                    <select id="cfl-team" name="team" onChange={handleFieldChange} value={form.team}>
                      <option value="">Select a team</option>
                      {TEAM_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="cfl-field">
                    <label htmlFor="cfl-use-case">First use case (optional)</label>
                    <select id="cfl-use-case" name="useCase" onChange={handleFieldChange} value={form.useCase}>
                      <option value="">Select a use case</option>
                      {USE_CASE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button className="cfl-btn cfl-btn-forest cfl-submit" type="submit">
                  {hasContactEmail ? "Continue in email" : "Prepare request"}
                </button>
              </form>

              <div aria-atomic="true" aria-live="polite" className="cfl-result" role="status">
                {formError ? <p className="cfl-form-error">{formError}</p> : null}
                {prepared && prepared.viaEmail ? (
                  <p>
                    Request prepared; it has not been sent. If your email app opened, review the draft there and send
                    it when ready. Otherwise, copy the request below.
                  </p>
                ) : null}
                {prepared && !prepared.viaEmail ? <p>Request prepared; it has not been sent.</p> : null}
                {copyNote ? <p>{copyNote}</p> : null}
              </div>

              {prepared ? (
                <div className="cfl-summary">
                  <label htmlFor="cfl-summary">Request summary</label>
                  <textarea id="cfl-summary" readOnly ref={summaryRef} rows={8} value={prepared.summary} />
                  <button className="cfl-btn cfl-btn-quiet" onClick={handleCopy} type="button">
                    Copy request
                  </button>
                  {prepared.viaEmail ? null : (
                    <p className="cfl-note">Copy this summary and send it to your CareFrame contact.</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="cfl-footer">
        <div className="cfl-wrap cfl-footer-bar">
          <p className="cfl-footer-name">
            <strong>CareFrame</strong> / SUPREME AI VENTURES LLC
          </p>
          <ul>
            <li>
              <a href="/app" onClick={handleWorkspaceClick}>
                Staff sign in
              </a>
            </li>
            {hasContactEmail ? (
              <li>
                <a href={`mailto:${trimmedContactEmail}`}>Contact</a>
              </li>
            ) : null}
            <li>
              <a href="#top">Back to top</a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

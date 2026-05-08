# Use Cases

> Enterprise media intelligence for organizations that can't afford to lose assets in a folder.

PhotoScribe AI is built around a common operational problem: large organizations create thousands of visual assets, then lose the value of those assets because they are stored across shared drives, email threads, SharePoint folders, Google Drive folders, and individual desktops with filenames like `IMG_4872.jpg`.

The result is repeated photo shoots, slow campaign production, manual renaming work, inconsistent metadata, and weak visibility into whether a released image should have gone through compliance review.

## Who Needs This

PhotoScribe is designed for organizations that manage large volumes of visual assets across departments with different governance needs. Healthcare is the clearest reference scenario, but the same architecture applies to any enterprise with a distributed media library.

## Healthcare Reference Scenario

This is a hypothetical reference scenario based on a 750-bed academic medical center. It is not a claim that this repo is deployed at, endorsed by, or affiliated with any specific hospital.

| Department | Their problem | How PhotoScribe solves it |
|---|---|---|
| Marketing and Communications | Can't locate the right photo for a campaign without emailing multiple departments | Semantic search: `diverse staff outdoors community event` returns relevant assets without needing exact filenames |
| Investor Relations | Annual report photo shoots get repeated because prior-year assets are hard to locate | Metadata by year, scene type, subject, and mood makes approved assets reusable across reporting cycles |
| Human Resources | Employee headshots are inconsistently named, duplicated, and hard to audit | AI metadata and date filters let HR pull queries like `all 2024 employee portraits` |
| Compliance and Risk | Limited visibility into whether released images contain identifiable patient data | Structured metadata such as `people_count`, `scene_type`, and `subjects` supports pre-release filtering and audit review |
| Facilities and Operations | Facility documentation photos are siloed by project | Scene-type metadata such as `architectural`, `interior`, and `exterior` enables unified search across projects |
| Research and Academic Affairs | Lab and research photos are buried in local folders and inaccessible to communications teams | S3-based ingest lets teams upload assets centrally while preserving searchable AI-generated descriptions |
| Executive Office | Leadership headshots are recreated for press releases because previous versions cannot be found | Portrait-tagged, mood-tagged, date-indexed assets are discoverable in plain language |

## Corporate And Enterprise Variants

The same pipeline works for any large corporate media library. The content changes, but the architecture stays the same.

| Function | Use case |
|---|---|
| Brand and Creative | Reuse campaign assets, find seasonal images, and reduce duplicate shoots |
| Corporate Communications | Locate executive portraits, all-hands events, office openings, and product launch photos |
| Legal and Compliance | Review released assets, track access, and support audit trails for image governance |
| Real Estate and Facilities | Search property documentation, renovation progress, office interiors, and inspection images |
| HR and Recruiting | Organize employee portraits, career-site photos, onboarding events, and culture content |
| Field Operations | Search inspection photos, safety documentation, equipment images, and site reports |

## Why Semantic Search Beats Manual Tagging

Traditional media libraries require someone to manually tag every image. That usually fails over time: tagging is inconsistent, stale, incomplete, and dependent on users guessing the exact keyword.

PhotoScribe uses a meaning-based pipeline:

1. Nova Lite describes the photo like a human reviewer, including subject, mood, lighting, composition, and context.
2. Titan Embeddings converts that description into a vector that represents the concept of the image, not just keywords.
3. S3 Vectors finds images by semantic proximity, so `doctor reviewing results` can match assets described as `physician`, `clinician`, `reviewing chart`, or similar language.

A marketing coordinator can search for `warm outdoor photo with staff in navy uniforms` without knowing the folder path, camera filename, or internal tag taxonomy.

## Example Workflow

1. A department uploads approved or review-pending images to the private S3 photo bucket.
2. Uploads can come from the browser upload panel, CLI bulk upload, or another S3-backed source.
3. The ingest Lambda generates AI descriptions and structured metadata with Amazon Bedrock.
4. Titan Embeddings converts the generated description into a search vector.
5. S3 Vectors stores the vector and metadata for pay-per-use semantic search.
6. DynamoDB stores review status, visibility, and audit metadata.
7. The React UI lets users search in plain language and filter by metadata.
8. The search Lambda checks asset policy before issuing a short-lived signed S3 URL.

## Recruiter-Relevant Takeaway

PhotoScribe is not just a photo gallery. It demonstrates a cloud engineering pattern for turning unstructured enterprise content into governed, searchable assets using serverless AWS infrastructure, infrastructure as code, least-privilege IAM, CI/CD, and cost-aware service selection.

# Cloudflare Pages

This project can use Cloudflare Pages for free static frontend hosting while keeping the AWS search backend.

## What changes

- The frontend continues to build from `/frontend`.
- The AWS API stays at `https://4clxdxecw3.execute-api.us-east-1.amazonaws.com`.
- Terraform can now allow additional frontend origins and can disable the AWS S3 plus CloudFront frontend stack after cutover.

## Recommended cutover

1. Deploy the frontend to a Pages project.
2. Add the Pages origin to Terraform CORS.
3. Verify search works from the Pages URL.
4. Disable AWS frontend hosting and apply Terraform to destroy the S3 plus CloudFront frontend resources.

## Cloudflare Pages dashboard settings

If you use Git integration in the Cloudflare dashboard, use:

- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `VITE_API_URL=https://4clxdxecw3.execute-api.us-east-1.amazonaws.com`

Use Git integration if you want Cloudflare to build from your repository automatically. Direct Upload projects are separate from Git-integrated projects.

## Direct upload from local

From the repository root:

```bash
cd frontend
npm ci
VITE_API_URL=https://4clxdxecw3.execute-api.us-east-1.amazonaws.com npm run build
npx wrangler@latest pages project create
npx wrangler@latest pages deploy dist
```

Cloudflare will return a `*.pages.dev` URL after the first deploy.

Use this path if you want to deploy from your machine or GitHub Actions with Wrangler. Per Cloudflare's Pages docs, a Direct Upload project cannot later be switched to Git integration, so choose that project type deliberately.

## CORS update for the Pages domain

Once you know the Pages URL, add it to Terraform. Example:

```hcl
# terraform/envs/dev.cloudflare.tfvars
extra_frontend_origins = [
  "https://your-project.pages.dev",
]

enable_aws_frontend_hosting = false
```

Apply with:

```bash
cd terraform
terraform plan \
  -var-file=envs/dev.tfvars \
  -var-file=envs/dev.cloudflare.tfvars.example
terraform apply \
  -var-file=envs/dev.tfvars \
  -var-file=envs/dev.cloudflare.tfvars.example
```

For a real deployment, replace the example file with your actual Pages domain before applying.

## GitHub Actions option

The repository includes `.github/workflows/cloudflare-pages.yml` for direct-upload deployments with Wrangler.

It is configured to deploy on every push:

- pushes to `main` update the production Pages site
- pushes to other branches create or update branch preview deployments in Pages

Set these GitHub repository variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `VITE_API_URL`

Set this GitHub repository secret:

- `CLOUDFLARE_API_TOKEN`

The workflow builds `frontend/dist` and deploys it with `wrangler pages deploy`.

GitHub Actions still needs access to the repository, and Cloudflare still needs a Pages project with the same project name. The current production branch for the live site is `main`.

## Official references

- Cloudflare Pages getting started: https://developers.cloudflare.com/pages/get-started/
- Cloudflare Pages direct upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages CI with Wrangler: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/

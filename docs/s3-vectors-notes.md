# S3 Vectors Notes

## Provider choice

PhotoScribe uses the `hashicorp/awscc` provider for S3 Vectors resources in Phase 1.

Reason:

- As of April 24, 2026, the official Terraform Registry docs clearly expose `awscc_s3vectors_vector_bucket` and `awscc_s3vectors_index`.
- Current official `hashicorp/aws` registry docs do not clearly expose native S3 Vectors resources.
- AWS CloudFormation documents `AWS::S3Vectors::VectorBucket` and `AWS::S3Vectors::Index`, and the `awscc` provider is generated from Cloud Control / CloudFormation coverage.

## Metadata model

S3 Vectors treats metadata keys as filterable by default. The index configuration only needs the non-filterable keys:

- `description`
- `alt_text`
- `seo_caption`
- `s3_key`
- `s3_uri`
- `subjects_csv`
- `colors_csv`
- `objects_csv`

The README's filterable keys remain filterable because they are omitted from `non_filterable_metadata_keys`.

## Sources checked

- AWS S3 Vectors user guide: `Working with S3 Vectors and vector buckets`
- AWS CloudFormation reference: `AWS::S3Vectors::VectorBucket`
- AWS CloudFormation reference: `AWS::S3Vectors::Index`
- AWS CloudFormation reference: `AWS::S3Vectors::Index MetadataConfiguration`
- HashiCorp `awscc` provider release notes showing `awscc_s3vectors_*` resource support


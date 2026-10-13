# ADR 0012: Complete Curated Search Before Applying Its Result Limit

## Status

Accepted, 2026-10-13.

## Context

Live staff verification found that an exact tag was returned with the normal
search size but missed with `top_k=1`. The policy scan used the requested result
count as its row evaluation limit and never followed its pagination cursor.
Curated matches also bypassed the selected metadata filters.

## Decision

Keep the existing policy table and search endpoint. Page through the filtered
scan using `LastEvaluatedKey` / `ExclusiveStartKey`, including empty pages, until
the requested number of authorized, filter-matching results is collected or
the scan is exhausted. Use a 100-row minimum page size to avoid one network
round trip per evaluated row for small result requests.

Apply the same simple metadata filters to curated results as to vector results.
Use the policy metadata returned by authorization when rendering a curated hit.
Never infer missing lighting or time-of-day values. Retain the vector-search
path and the existing duplicate-asset suppression.

[DynamoDB scan semantics](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html)
explain why a filtered empty page is not necessarily the end of a scan and why
the row evaluation limit cannot serve as a matching-result limit.

## Consequences

Exact staff names and tags no longer depend on their position in the first
database page. Tests cover empty pages, later matches, selected filters, and
the matching-result cap; deployed checks verify an exact QA tag with `top_k=1`.

This remains a pilot-scale scan, with read cost and latency proportional to the
rows examined. A larger library should use a purpose-built metadata index;
that is not silently claimed as part of this release.

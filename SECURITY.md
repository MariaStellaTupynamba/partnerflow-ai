# Security Policy

PartnerFlow AI is a public portfolio project. It does not process real user data — all sample
data, credentials, and documents in this repository are fictional.

## Reporting a Vulnerability

If you find a security issue in this repository (e.g. a dependency vulnerability, an
authentication flaw, or an injection vector), please open a private report via GitHub's
[Security Advisories](../../security/advisories/new) feature for this repository rather than
filing a public issue.

Please include:

- A description of the issue and its potential impact
- Steps to reproduce
- Affected files or endpoints

## Scope

Since this is a portfolio project rather than a production service, there is no bug bounty and
no guaranteed response time. That said, reports are genuinely welcome and will be reviewed.

## Handling of secrets

- No secrets are committed to this repository. `.env` files are git-ignored; `.env.example`
  contains placeholder values only.
- JWT signing secrets, database credentials, and AI provider API keys must always be supplied via
  environment variables, never hardcoded.

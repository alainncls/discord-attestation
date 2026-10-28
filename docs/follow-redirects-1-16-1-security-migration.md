# follow-redirects 1.16.1 security migration

`axios` 1.20.0 resolves `follow-redirects` 1.16.0 through the functions
package and the Reown/AppKit graph. Two high-severity advisories affect that
version: GHSA-q3jh-wrc6-jgq8 and GHSA-8r9p-f939-6h3c.

`follow-redirects` 1.16.1 is the first patched release and had been published
for more than three days when this override was introduced. The exact pnpm
override keeps the installed graph secure while upstream packages retain their
current dependency ranges.

The migration must retain frozen-install reproducibility, remove the two high
findings from the production audit, and pass local/CI/browser deployment gates
before production is accepted.

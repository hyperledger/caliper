# Release Process

## Code
1. Generate the change log using the script changelog.sh. The script must be run from the repo root directory (ie ./scripts/changelog.sh <commit to start from> <new version>)
2. Update all package.json files to define the new version, eg 0.7.0 and regen package-lock.json (PR 1)
3. create a release on Github with the changelog details and mark it pre-release
4. Update all the package.json files to define a new unstable version, eg 0.7.1-unstable and regen package-lock.json (PR 2)

## Docs
1. from the gh-pages branch, edit the docs in vNext to point to the next caliper versions (eg 0.7.0 and 0.7.1-unstable etc)
2. update docs.json with the new caliper version and run the script bump-docs.js (PR 3)

## Caliper benchmarks
1. Create a release in caliper-benchmarks corresponding to the new release, eg 0.7.0



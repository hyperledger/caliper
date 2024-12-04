# Release Process

## Code
1. Generate the change log using the script changelog.sh. The script must be run from the repo root directory (ie ./scripts/changelog.sh <commit to start from> <new version>)
2. Update all package.json files to define the new version, eg 0.7.0 and regen package-lock.json (PR 1)
3. create a release on Github with the changelog details and mark it pre-release
4. Update all the package.json files to define a new unstable version, eg 0.7.1-unstable and regen package-lock.json (PR 2)

## Caliper benchmarks
1. Create a release in caliper-benchmarks corresponding to the new release, eg 0.7.0

## Docs

There are 2 aspects here
1. update an existing version
2. publishing a new version and make it the default

One final point to note is that although the `mike` tool manages all the documentation we still have to maintain the /assets/img directory. This is required for Caliper 0.6.0 to find a hyperledger logo in it's report.html template.
The old documentation is also currently kept in the `.OldDocs` directory

### Updating an existing version

1. create branch newdocs based off of gh-pages
2. switch to branch that contains the doc changes and change to docs directory
3. run `mike deploy -b newdocs <version>` (note the commit won't be signed) - specify appropriate version for <version>, eg `0.6.0`
4. switch to newdocs and amend the last commit to sign it
5. submit pr of newdocs to gh-pages

## Publishing a new version

1. create branch newdocs
2. switch to branch that contains the doc changes and change to docs directory
3. run `mike deploy -b newdocs <version>` (note the commit won't be signed) - specify appropriate version for <version>, eg `0.7.0`
4. switch to newdocs and amend the last commit to sign it
5. switch back to branch that contains the doc changes
6. run `mike set-default <version> -b newdocs` (note the commit won't be signed) - specify same version used for the deploy
7. switch to newdocs and amend the last commit to sign it
8. submit pr of newdocs to gh-pages

(see  https://stackoverflow.com/questions/13043357/git-sign-off-previous-commits for a way to sign multiple commits in the future)

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

## Documentation Deployment

This repository uses GitHub Actions to automate the deployment of documentation to GitHub Pages whenever a new version is tagged. Follow the steps below to change the version and deploy updated documentation.

### Steps to Change Version and Deploy Documentation

1. Create a Git Tag for the New Version

To deploy a new version of the documentation, start by creating a Git tag. For example:

```bash
git tag v1.2
```

2. Push the Tag to GitHub
Once the tag is created, push it to GitHub:

```bash
git push origin v1.2.3
```

Pushing the tag will automatically trigger the GitHub Actions CI pipeline defined in the .github/workflows/publish-doc.yml file.

3. CI Pipeline Actions
When the tag is pushed, the CI pipeline will execute the following steps:

Checkout Code: The latest version of the repository is pulled.
Setup Python: Python 3.x is set up and the required dependencies are installed from the docs/pip-requirements.txt.
Deploy Documentation: The mike deploy command is used to deploy the documentation to the gh-pages branch under the new version folder (/v1.2.3/).
Create Pull Request: A new branch is created to update the docs folder, and a pull request is opened to merge the changes into the main branch.

4. Merge the Pull Request
After the pull request is created, review the changes and merge it into the main branch. This ensures the documentation for the new version is available on the main repository.

5. Access the Documentation
Once the pull request is merged, the updated documentation can be accessed through GitHub Pages. The URL format will be:

```bash
https://hyperledger-caliper.github.io/caliper/
```
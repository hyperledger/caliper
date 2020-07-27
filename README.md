## Caliper pages

Welcome to the GitHub pages for Caliper. These documents serve to explain the configuration and use of Caliper for testing the performance of your blockchain networks. This static site is hosted on an organization static site in GitHub (https://github.com/hyperledger/caliper).

## Achitecture
Jekyl is used to publish the site,

The jekyll template and files are stored in this tree

```
├── jekylldocs
│   ├── _includes
│   ├── _layouts
│   ├── assets
│   ├── docs
│   ├── _config.yml
│   ├── Gemfile
│   ├── favicon.ico
│   ├── 404.html
│   ├── index.html
```

* 404 and index.html are the 404 and index.html page as pure html
* assets hold the resources referenced by the pages, such as images and css
* docs hold the pages within the site, as markdown (`md`) files
* \_Gemfile manages the versions of jekyll that are used for the site
* \_config.yml is the configuration of jekyll.
* \_includes has files that are pulled into the templates at key points. This is primarily the header, resource, and the footer.
* \_layouts are the liquid templates that control the overall structure of each page.

## Building Locally
This couldn't be simpler, there is a useful [GitHub guide](https://help.github.com/articles/setting-up-your-github-pages-site-locally-with-jekyll/) that explains the full process, but for those in a rush:

* Install [Ruby 2.1.0 or higher](https://www.ruby-lang.org/en/downloads/)
* Install Bundler: `gem install bundler`
* Install Jekyll: `gem install jekyll`
* Publish the site locally with `bundle exec jekyll serve`
* Navigate to the site, default `http://127.0.0.1:4000/caliper/`

## Contributing

If you would like to help us document Caliper, please feel free to raise a PR. You may wish to edit a page, or add a new page, but please ensure that the site builds before submitting the PR.

All pages are contained wihtin the `/docs` folder as markdown files, and any resources that they require (such as png images) are held within the `/assets` folder. Please stick to this convention.

### Editing Pages

There is nothing in particular to consider when editing a page; markdown files are used for which there are numerous online guides, such as the [GitHub guide](https://guides.github.com/features/mastering-markdown/)

### Adding Pages

Adding a new page requires the addition of a header to the markdown file, so that when built, the page is placed in the correct location.

At the top of existing markdown files, you will see a section similar to:

```
---
layout: page
title:  "Getting Started"
categories: docs
order: 1
---
```

* layout links to a html template within `_layouts` that the page is to use
* tile is the title of the page, that will appear under a menu category
* categories names the category under which the page will appear and is one of [docs, config, reference, opensource]
* order specifies the order in which the page title will appear within the category list

## Bumping the docs
When releasing new docs (moving vNext content to a versioned release) use the `bumpDocs` npm script. It relies on information within the root level `docs.json` file that indicates the candidate version that will be used to place the content from the vNext folder.
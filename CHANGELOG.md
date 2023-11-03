# Changelog

## 2.9.0 (2023-11-03)

Sitemaps now appear as XML source rather than awkwardly rendered text when viewed in the browser. There was never a problem with the XML from Google's perspective, but this improves the developer experience. Thanks to [norbie-nagy](https://github.com/norbie-nagy) for contributing this improvement.

## 2.8.0 (2021-02-22)

Adds new `getPageTree` method that returns the nested pages in the right order with pieces that are also pages. To be able to build a sitemap page from any project.

## 2.6.0 (2021-10-13)

Introduced a `rewriteUrl` method, which project developers can override to customize the URLs being output in the sitemap.

## 2.5.3

Disables the `siteMapPriority` schema field on the `trash` page to prevent an "unarranged field" warning about it.

## 2.5.1

Fixes a bug in the `exclude-types` argument usage.

## 2.5.0

Added a configuration option to remove `siteMapPriority` field globally

## 2.4.7

per Google's guidelines a `<link>` should contain an `<xhtml:link hreflang>` for every locale, including the locale of the `<link>` itself, which was formerly excluded. Thanks to Fredrik Ekelund for this contribution.

## 2.4.6

never generate a priority below 0.1.

## 2.4.5

clone the priority field before adding it so we do not get into issues with `arrangeFields`.

## 2.4.4

Fixes issue where children of unpublished top-level pages were left out of the site map. Additional documentation improvements.

## 2.4.3

fix for apps not using apostrophe-workflow, removing workflow-related xml tags that were left in the sitemap.

## 2.4.1

fix for static sitemap generation of workflow-driven sites without the `perLocale` option, along with new unit tests to verify this has no negative impact on "simple" sites. Also uses the newly exported `destroy` mechanism in its unit testing so we can use Mocha 5 and know that Apostrophe is truly freeing all resources in `apos.destroy`.

## 2.4.0

adds ability to exclude page types in addition to piece types.

## 2.3.3

a bug that broke static sitemap file generation in the absence of workflow was fixed.

## 2.3.2

a bug that broke the sitemap generator in the absence of workflow was fixed. Thanks to Peter Shaw.

## 2.3.1

a bug that broke the sitemap generator in the presence of private workflow locales was fixed. Thanks to Albert R. Timashev.

## 2.3.0

sitemaps for sites localized with the `apostrophe-workflow` module now include pointers to alternate language versions of each document.

## 2.2.1

* The command line `node app apostrophe-site-map:map --update-cache` can be used to update the sitemap that will be sent from Apostrophe's internal cache without waiting for the cache to expire. If the task is scheduled to run more often then once an hour, then a search engine will never be asked to wait a long time to generate it. For sites with many pages and pieces this can be critical.

## 2.2.0

* `piecesPerBatch` option for performance. Still defaults to processing 100 pieces at a time.
* Support for the `hostname` option of `apostrophe-workflow`.

## 2.1.1

short-lived bug affecting command line tasks.

## 2.1.0

sitemaps are now served dynamically. They are stored in Apostrophe's cache for a configurable period of time. There is no need to run a command line task, or mess around with static files. Please note that you must remove existing static sitemap files first. See the documentation for important recommendations. Thanks to Michelin for their support of this work.

The documentation has also been overhauled thoroughly to be completely accurate for Apostrophe 2.x.

## 2.0.4

workflow-aware; new features providing compatibility with the apostrophe-workflow module.

## 2.0.3

documentation updates.

## 2.0.1-2.0.2

minor bug fixes.

## 2.0.0

initial port to Apostrophe 2.x.

## 2.2.0

enhance performances with many pieces

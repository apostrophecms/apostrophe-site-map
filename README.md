# apostrophe-site-map

This module generates XML and plaintext sitemaps for sites powered by the [Apostrophe](https://apostrophenow.org) CMS.

It serves two purposes: [white-hat SEO](https://support.google.com/webmasters/answer/183668?hl=en&ref_topic=6080646&rd=1) and content strategy.

## SEO with sitemaps

A frequently updated and accurate XML sitemap allows search engines to index your content more quickly and spot new pages immediately. But *an out-of-date sitemap is worse than nothing and will damage your site's SEO.*

This module generates a sitemap that includes all of the pages on your site that are visible to the public, including "pieces" such as events, and blog posts. And it does so dynamically, with a short cache lifetime, so your sitemap is not out of date.

## How to use it

* Install the module.

`npm install --save apostrophe-site-map`

* Configure it in `app.js`, as one of your modules.

```javascript
{
  // You should configure `baseUrl` to ensure full URLs in your sitemap
  baseUrl: 'http://example.com',
  modules: {
    'apostrophe-site-map': {
      // array of doc types you do NOT want
      // to include, even though they are
      // accessible on the site. You can also
      // do this at the command line.
      excludeTypes: []
    }
  }
}
```

#### Alternative configuration

If you don't like to modify/overwrite the baseUrl for the site or keep the site without a baseUrl, you can add baseUrl in the configuration of the module:

```javascript
{
  // No baseUrl here
  modules: {
    'apostrophe-site-map': {
      baseUrl: 'http://example.com',
      excludeTypes: []
    }
  }
}
```

* Just launch your site as you normally would. In development that might just be:

```
node app
```

* Access `http://localhost:3000/sitemap.xml` (in production, of course, the hostname is different).

> **AN IMPORTANT WARNING: if you ALREADY have a STATIC public/sitemap.xml file, THAT FILE WILL BE SENT INSTEAD.** Remove it. Also, SITEMAPS ARE CACHED for one hour by default, so you won't see changes instantly. Read on for how to change the cache lifetime, and what you can realistically expect from Google.

### Clearing the cache, and changing the cache lifetime

To better support multiple-server environments, this module now serves sitemaps directly and caches them in your database. That way we don't have to worry about whether a static file exists in a given environment, running the same task on multiple servers, etc.

By default sitemaps are cached for 1 hour. You can change this by specifying the `cacheLifetime` option to this module, in seconds. However, don't get too excited: Google [usually does not check a sitemap more often than a few times a month](https://webmasters.stackexchange.com/questions/43874/how-often-does-gwt-check-dynamic-sitemaps).

You can clear the cache at any time with this command line task:

```
node app apostrophe-site-map:clear
```

This will force a new sitemap to be generated on the next request.

### Generating the sitemap ahead of time

You can use this command line task to update the sitemap in Apostrophe's cache at any time, rather than waiting for it to expire after an hour and generate again on the next request:

```
node app apostrophe-site-map:map --update-cache
```

If your site has many pages and pieces, generating the sitemap dynamically may take a long time. Scheduling the above task to run at least twice an hour via a [cron job](https://www.howtogeek.com/101288/how-to-schedule-tasks-on-linux-an-introduction-to-crontab-files/) guarantees that a search engine will never be forced to wait when requesting your sitemap. If you have enough content, search engines may hang up before your sitemap is generated, so this task is very useful.

### Generating sitemaps as static files

If you wish, you can generate a sitemap as a static file.

Just run this task:

```
node app apostrophe-site-map:map
```

When `--update-cache` is not given, this task generates an XML sitemap and displays it on the console. This is mostly useful for content strategy purposes. If your goal is to serve the sitemap to search engines, see above for a better way.

## How to tell Google about your sitemap

Create a `public/robots.txt` file if you do not already have one and add a Sitemap line. Here is a valid example for a site that doesn't have any other `robots.txt` rules:

```
Sitemap: http://EXAMPLE.com/sitemap.xml
```

You can also have other `robots.txt` directives if you wish.

On Google's next crawl of your site it should pick up on the presence of the sitemap.

## Changing the priority of pages and pieces

By default, an XML sitemap will assign a priority to a page based on its depth. The home page has a priority of 1.0 (the highest), a subpage of the home page 0.9, and so on.

Pieces receive a priority of 0.7; however if they have a `startDate` property (i.e. they are events) in the future, they bump up to 0.8, and if they have a `startDate` in the past they bump down to 0.6.

**You can also set the priority yourself.** Once you install this module you will discover that there is a new "sitemap priority" field in "page settings," and when editing a piece via the edit dialog box. You can set this field to any number between 0.0 and 1.0, with 1.0 being the highest.

As of this writing, Google suggests that they may use the priority to rank the importance of pages *relatively within your site.* **Please do not set all the priorities to 1.0. It will only hurt your chances of communicating which pages are most important to Google.**

## Content strategy

You can also use this module just to generate a map of your site for your own study:

```
node app apostrophe-site-map:map --format=text --indent
```

The result is a very informative depth-first list of pages. Note the use of leading spaces to indicate depth:

```
/
  /about
    /about/people
    /about/ducklings
/products
  /products/cheesemaker
```

You'll want to pipe that to a text file and consider printing it.

*The displayed "depth" of pieces won't always correspond directly to the pieces-pages that display them.* You might want to exclude them when generating content strategy maps.

## Warning: watch out for your custom stuff!

This module does the best it can.

It'll list your published pages, and your published pieces. And it'll rank future events higher than past events.

But it doesn't know anything about the custom URLs, independent of Apostrophe's usual mechanisms, that you're generating in your own creative and amazing modules.

If that's a concern for you, create `lib/modules/apostrophe-site-map/index.js` in your project, subclass the module, and override the `custom` method to output information about **additional** URLs. *Note: if you have multiple locales via `apostrophe-workflow` this method is called once per locale.* This method now receives `req, locale, callback` if written to accept three arguments.

It's straightforward: all you have to do is pass Apostrophe page objects, or anything else with an `_url` property and a `siteMapPriority` property, to `self.output`.

Here's a simple example. Note the use of `self.host` to get the "stem" of the URL (`http://mysite.com`).

For regular pages in the page tree, `level` starts at `0` (the home page) and increments from there for nested pages. For your own "pages," just keep that in mind. The higher the `level`, the lower the `priority` will be in the XML sitemap. Or pass the`siteMapPriority` property explicitly.

> This feature is **not** for changing priorities of existing pages and pieces. It is for your custom routes and dispatch URLs that the module cannot discover on its own. See the "page settings" dialog box or the edit dialog box for a field that lets you set the priority of an ordinary page or piece.

```javascript
// lib/modules/apostrophe-site-map/index.js, at project level, not in node_modules
module.exports = {
  construct: function(self, options) {
    self.custom = function(req, locale, callback) {
      // Discover something via the database, then...
      self.output({
        _url: 'http://mysite.com/myspecialplace',
        // Defaults to 0.5 if not set and a `level` property
        // cannot be used to infer it
        siteMapPriority: 0.9
      });
      return callback(null);
    };
  }
};
```

Note that `req` only has the same privileges as an anonymous site visitor. If you call `find` methods with it, you will only see what typical site visitors see. This is good, because **you don't want Google to index restricted pages.**

## How to exclude stuff

"I don't want thousands of blog posts in my sitemaps." OK, so do this in `app.js` when configuring the module:

Or do it in `app.js` when configuring the module:

```javascript
  {
    'apostrophe-site-map': {
      excludeTypes: [ 'apostrophe-blog-post' ]
    }
  }
```

You may specify multiple doc types to exclude. You may also exclude page types the same way by adding their doc type to the array, e.g., `styleguide`.

You can also do this at the command line, which is helpful when generating a map just for content strategy purposes:

```
node app apostrophe-site-map:map --format=text --indent --exclude-types=apostrophe-blog
```

Alternatively, you can set the `sitemap` option to `false` when configuring any module that extends `apostrophe-custom-pages` or `apostrophe-pieces`.

You can also explicitly set it to `true` if you wish to have sitemaps for a piece type that is normally excluded, like `apostrophe-users`. Of course this will only help if they have a `_url` property when fetched, usually via a corresponding module that extends `apostrophe-pieces-pages`.

## Integration with the `apostrophe-workflow` module

If you are using the `apostrophe-workflow` module, the sitemap module will automatically fetch content for the live versions of all configured locales.

By default, the result will be emitted as a single sitemap. [According to Google, this is OK, although you must claim all of the sites under a single identity in the Google webmaster console.](https://support.google.com/webmasters/answer/75712?hl=en) However, if you would prefer a separate sitemap file for each hostname found in the absolute URLs, you can set the `perLocale` option to `true` when configuring the module.

Or, if you're generating static sitemaps at the command line, you can pass the `--per-locale` option.

When you set the `perLocale` option, sitemaps are served by the module from `/sitemaps/fr.xml`, `/sitemaps/en.xml`, etc., and a sitemap index is served from `/sitemaps/index.xml`. **Make sure you list `/sitemaps/index.xml` for your Sitemap directive in `robots.txt`**.

> If you generate static files instead with the `apostrophe-site-map:map` task, a physical `public/sitemap` folder is created. **IF YOU CHANGE YOUR MIND AND WISH TO LET THE MODULE SERVE SITEMAPS FOR YOU, REMOVE THIS FOLDER.** Otherwise the static files will always "win."

If the `perLocale` option is set to `true` for the module or the `--per-locale` command line parameter is passed, the `--file` command line parameter is ignored unless `--format=text` is also present. This allows you to still use the module for content strategy.

## Performance

If you have thousands of pieces, building the sitemap may take a long time. By default, this module processes 100 pieces at a time, to avoid using too much memory. You can adjust this by setting the `piecesPerBatch` option to a larger number. However, be aware that if you have many fields and joins, it is possible to use a great deal of memory this way.

```javascript
modules: {
  {
    'apostrophe-site-map': {
      piecesPerBatch: 500
    }
  }
}
```

## Changelog

2.4.4: Fixes issue where children of unpublished top-level pages were left out of the site map. Additional documentation improvements.

2.4.3: fix for apps not using apostrophe-workflow, removing workflow-related xml tags that were left in the sitemap.

2.4.1: fix for static sitemap generation of workflow-driven sites without the `perLocale` option, along with new unit tests to verify this has no negative impact on "simple" sites. Also uses the newly exported `destroy` mechanism in its unit testing so we can use Mocha 5 and know that Apostrophe is truly freeing all resources in `apos.destroy`.

2.4.0: adds ability to exclude page types in addition to piece types.

2.3.3: a bug that broke static sitemap file generation in the absence of workflow was fixed.

2.3.2: a bug that broke the sitemap generator in the absence of workflow was fixed. Thanks to Peter Shaw.

2.3.1: a bug that broke the sitemap generator in the presence of private workflow locales was fixed. Thanks to Albert R. Timashev.

2.3.0: sitemaps for sites localized with the `apostrophe-workflow` module now include pointers to alternate language versions of each document.

2.2.1:

* The command line `node app apostrophe-site-map:map --update-cache` can be used to update the sitemap that will be sent from Apostrophe's internal cache without waiting for the cache to expire. If the task is scheduled to run more often then once an hour, then a search engine will never be asked to wait a long time to generate it. For sites with many pages and pieces this can be critical.

2.2.0:

* `piecesPerBatch` option for performance. Still defaults to processing 100 pieces at a time.
* Support for the `hostname` option of `apostrophe-workflow`.

2.1.1: short-lived bug affecting command line tasks.

2.1.0: sitemaps are now served dynamically. They are stored in Apostrophe's cache for a configurable period of time. There is no need to run a command line task, or mess around with static files. Please note that you must remove existing static sitemap files first. See the documentation for important recommendations. Thanks to Michelin for their support of this work.

The documentation has also been overhauled thoroughly to be completely accurate for Apostrophe 2.x.

2.0.4: workflow-aware; new features providing compatibility with the apostrophe-workflow module.

2.0.3: documentation updates.

2.0.1-2.0.2: minor bug fixes.

2.0.0: initial port to Apostrophe 2.x.

2.2.0: enhance performances with many pieces

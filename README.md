# apostrophe-site-map

This module generates XML and plaintext sitemaps for sites powered by the [Apostrophe](https://apostrophenow.org) CMS.

It serves two purposes: [white-hat SEO](https://support.google.com/webmasters/answer/183668?hl=en&ref_topic=6080646&rd=1) and content strategy.

## SEO with sitemaps

A **frequently-updated and accurate** XML sitemap allows search engines to index your content more quickly and spot new pages immediately. But an out-of-date sitemap is worse than nothing and will damage your site's SEO.

This module attempts to generate a sitemap that includes all of the pages on your site that are visible to the public, including "snippets" such as events, blog posts and people.

## Content strategy

If you're simply looking for a quick visualization of your site's structure for content strategy purposes, this module can help you with that too, via the `--format=text --indent` options.

## How to use it

To generate a content strategy map of your site:

1. Install the module.

`npm install --save apostrophe-site-map`

2. Configure it in `app.js`, as one of your modules.

```javascript
  {
    'apostrophe-site-map': {
      // array of doc types you do NOT want
      // to include, even though they are
      // accessible on the site. You can also
      // do this at the command line
      excludeTypes: []
    }
  }
```

3. Run the task:

```
node app apostrophe-site-map:map
```

This generates an XML sitemap and displays it on the console. You can publish it by specifying a location in your project's `public` folder:

```
node app apostrophe-site-map:map --file=public/sitemap.xml
```

**Hint:** set up a cron job to do this nightly.

4. Tell Google about it!

Create a `public/robots.txt` file if you do not already have one and add a sitemap line. Here is a valid example for a site that doesn't have any robot restrictions:

```
Sitemap: http://EXAMPLE.com/sitemap.xml
```

You can also have other `robots.txt` directives if you wish.

On Google's next crawl of your site it should pick up on the presence of the sitemap.

**Don't do this once and forget about it. Set up a scheduled task, such as a cron job.**

## Warning: watch out for your custom stuff!

This module does the best it can.

It'll list your published pages, and your published snippets. And it'll rank future events higher than past events.

But it doesn't know anything about the custom URLs, independent of the page tree, that you're generating in your own creative and amazing modules.

If that's a concern for you, create `lib/modules/apostrophe-site-map/index.js` in your project, subclass the module, and override the `custom` method to output information about additional URLs.

It's straightforward: all you have to do is pass Apostrophe page objects, or anything else with a `url` property and a `level` property, to `self.output`.

Here's a simple example. Note the use of `self.host` to get the "stem" of the URL (`http://mysite.com`).

For regular pages in the page tree, `level` starts at `0` (the home page) and increments from there for nested pages. For your own "pages," just keep that in mind. The higher the `level`, the lower the `priority` will be in the XML sitemap.

```javascript
// lib/modules/apostrophe-site-map/index.js, at project level, not in node_modules
module.exports = {
  construct: function(self, options) {
    self.custom = function(callback) {
      // Discover something via the database, then...
      self.output({
        _url: 'http://mysite.com/myspecialplace',
        priority: 0.5
      });
      return callback(null);
    };
  }
};
```

Also consider using `self.req` as your `req` object. This object does *not* have admin privileges. You don't want admin-only URLs in a sitemap.

## Content strategy

You can also use this module just to generate a map of your site for your own study:

```
node app apostrophe:sitemap --format=text --indent
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

*The displayed "depth" of snippets won't correspond directly to the pages they are accessible on. Snippets are output first.* You might want to exclude them when generating content strategy maps.

## How to exclude stuff

"I don't want thousands of blog posts in there from `apostrophe-blog-2`." OK, so do this:

node app apostrophe:site-map --exclude-types=blogPost

Or do it in `app.js` when configuring the module:

```javascript
  {
    apostrophe-site-map: {
      excludeTypes: [ 'blogPost' ]
    }
  }
```

You may specify multiple page types to exclude, separated by commas.

## If you get an error

"I got a MongoDB error about exceeding 32MB."

There's a hard limit on the number of documents MongoDB will sort for you (TODO: figure out why adding an index solves this in the mongo shell but not in this task). Exclude more types.

## Compatibility

Currently supports both A2 0.4 and A2 0.5 sites.

## License

Copyright (c) 2015 P'unk Avenue LLC

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

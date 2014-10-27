# apostrophe-site-map

This module generates a sitemap for sites powered by the [Apostrophe](https://apostrophenow.org) CMS. It is intended for use in content strategy when dealing with large sites that have hundreds of pages. **It is not currently intended as Google sitemap. Good organic navigation links are much better because they don't get out of date.**

## How to use it

To generate a content strategy map of your site:

1. Install the module.

`npm install --save apostrophe-site-map`

2. Configure it in `app.js`, as one of your modules.

```javascript
  {
    apostrophe-site-map: {}
  }
```

3. Run the task:

node app apostrophe:site-map

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

## How to exclude stuff

"I don't want thousands of blog posts in there from `apostrophe-blog-2`." OK, so do this:

node app apostrophe:site-map --exclude-types=blogPost

You may specify multiple page types to exclude, separated by commas.

## If you get an error

"I got a MongoDB error about exceeding 32MB."

There's a hard limit on the number of documents MongoDB will sort for you (TODO: figure out why adding an index solves this in the mongo shell but not in this task). Exclude more types.

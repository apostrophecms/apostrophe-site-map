/* jshint node:true */

var async = require('async');
var _ = require('lodash');
var fs = require('fs');
var moment = require('moment');
module.exports = factory;

function factory(options, callback) {
  return new Construct(options, callback);
}

function Construct(options, callback) {
  var self = this;
  // Add a bunch of methods to self here, then...

  self._apos = options.apos;
  self._pages = options.pages;

  self._apos.on('tasks:register', function(taskGroups) {
    taskGroups.apostrophe.siteMap = function(site, apos, argv, callback) {
      var format = self.format = argv.format || 'xml';
      var indent = self.indent = !!argv.indent;
      var file = self.file = argv.file || '/dev/stdout';
      var out = self.out = fs.openSync(file, 'w');
      var home;
      var criteria = {};
      var today = self.today = moment().format('YYYY-MM-DD');
      var req = self.req = self._apos.getTaskReq();
      var excludeTypes = self.excludeTypes = options.excludeTypes || [];

      self.output = output;

      if (argv['exclude-types']) {
        excludeTypes = excludeTypes.concat(argv['exclude-types'].split(','));
        criteria.type = { $nin: excludeTypes };
      }
      if (format === 'xml') {
        fs.writeSync(out, '<?xml version="1.0" encoding="UTF-8"?>\n');
        fs.writeSync(out, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
      }
      var host = site.hostName;
      if (!host.match(/^https?:/)) {
        host = 'http://' + host;
      }
      self.host = host;
      return async.series({
        home: function(callback) {
          return apos.pages.findOne({ slug: '/' }, function(err, page) {
            if (err) {
              return callback(err);
            }
            if (!page) {
              return callback('no homepage');
            }
            home = page;
            return callback(null);
          });
        },
        pages: function(callback) {
          return self._pages.getDescendants(req, home, criteria, { orphan: null, depth: 20, fields: { slug: 1, path: 1, rank: 1, level: 1 } }, function(err, children) {
            home.children = children;
            return callback(err);
          });
        },
        snippets: function(callback) {
          return async.eachSeries(self._pages.types, function(type, callback) {
            if (!_.find(type._modules || [], function(m) {
              return m.name === 'snippets';
            })) {
              // Not derived from snippets
              return setImmediate(callback);
            }
            // You can ignore either the index or the instance,
            // same result
            if (_.contains(excludeTypes, type.name)) {
              return setImmediate(callback);
            }
            if (_.contains(excludeTypes, type._instance)) {
              return setImmediate(callback);
            }
            // Paginate through 100 at a time to
            // avoid slamming memory
            var done = false;
            var skip = 0;
            return async.whilst(
              function() { return !done; },
              function(callback) {
              return type.get(req, { published: true }, { permalink: true, withJoins: false, areas: false, skip: skip, limit: 100 }, function(err, results) {
                _.each(results.snippets, function(snippet) {
                  if (!snippet.url) {
                    // This one has no page to be viewed on
                    return;
                  }
                  snippet.url = host + snippet.url;
                  // Results in a reasonable priority relative
                  // to regular pages
                  snippet.level = 3;
                  // Future events are interesting,
                  // past events are boring
                  if (snippet.startDate) {
                    if (snippet.startDate > today) {
                      snippet.level--;
                    } else {
                      snippet.level++;
                    }
                  }
                  output(snippet);
                });
                if (!results.snippets.length) {
                  done = true;
                } else {
                  skip += results.snippets.length;
                }
                return callback(null);
              });
            }, callback);
          }, callback);
        },
        custom: function(callback) {
          return self.custom(site, apos, argv, callback);
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        output(home);
        if (format === 'xml') {
          fs.writeSync(out, '</urlset>\n');
        }
        fs.closeSync(out);
        return callback(null);
      });
      function output(page) {
        if (format === 'text') {
          if (indent) {
            var i;
            for (i = 0; (i < page.level); i++) {
              fs.writeSync(out, '  ');
            }
          }
          fs.writeSync(out, page.slug);
        } else {
          var url = page.url || host + site.prefix + page.slug;
          fs.writeSync(out, '  <url><priority>' + (1.0 - page.level / 10) + '</priority><changefreq>daily</changefreq><loc>' + url + '</loc></url>\n');
        }
        _.each(page.children, function(page) {
          output(page);
        });
      }
    };
  });

  self.custom = function(site, apos, argv, callback) {
    return setImmediate(callback);
  };

  if (callback) {
    // Invoke the callback. This must happen on next tick or later!
    return process.nextTick(function() {
      return callback(null);
    });
  }
}

// Export the constructor so others can subclass
factory.Construct = Construct;

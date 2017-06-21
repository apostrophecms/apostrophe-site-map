var moment = require('moment');
var async = require('async');
var _ = require('lodash');
var fs = require('fs');

module.exports = {
  afterConstruct: function(self) {
    self.apos.tasks.add(self.__meta.name, 'map', self.map);
  },
  
  construct: function(self, options) {

    self.map = function(apos, argv, callback) {
      
      if (!apos.options.baseUrl) {
        return callback(new Error(
          'You must specify the top-level baseUrl option when configuring Apostrophe\n' +
          'to use this task. Example: baseUrl: "http://mycompany.com"\n\n' +
          'Note there is NO TRAILING SLASH.\n\n' +
          'Usually you will only do this in data/local.js, on production.'
        ));
      }
      var criteria = {};
      var req = self.apos.tasks.getReq();
      self.format = argv.format || 'xml';
      self.indent = !!argv.indent;
      self.file = argv.file || '/dev/stdout';
      self.out = fs.openSync(self.file, 'w');
      self.today = moment().format('YYYY-MM-DD');
      // General public view, not admin
      req.user.permissions = {};
      self.excludeTypes = options.excludeTypes || [];

      if (argv['exclude-types']) {
        self.excludeTypes = excludeTypes.concat(argv['exclude-types'].split(','));
        criteria.type = { $nin: excludeTypes };
      }
      if (self.format === 'xml') {
        fs.writeSync(self.out, '<?xml version="1.0" encoding="UTF-8"?>\n');
        fs.writeSync(self.out, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
      }
      return async.series({
        home: function(callback) {
          return apos.pages.find(req, { slug: '/' }).children({ depth: 20 }).toObject(function(err, page) {
            if (err) {
              return callback(err);
            }
            if (!page) {
              return callback('no homepage');
            }
            self.home = page;
            return callback(null);
          });
        },
        pieces: function(callback) {
          var modules = _.filter(apos.modules, function(module, name) {
            return _.find(module.__meta.chain, function(entry) {
              return entry.name === 'apostrophe-pieces';
            });
          });
          return async.eachSeries(modules, function(module, callback) {
            if (_.contains(self.excludeTypes, module.name)) {
              return setImmediate(callback);
            }
            // Paginate through 100 at a time to
            // avoid slamming memory
            var done = false;
            var skip = 0;
            return async.whilst(
              function() { return !done; },
              function(callback) {
              return module.find(req).published(true).joins(false).areas(false).skip(skip).limit(100).toArray(function(err, pieces) {
                _.each(pieces, function(piece) {
                  if (!piece._url) {
                    // This one has no page to be viewed on
                    return;
                  }
                  // Results in a reasonable priority relative
                  // to regular pages
                  piece.level = 3;
                  // Future events are interesting,
                  // past events are boring
                  if (piece.startDate) {
                    if (piece.startDate > self.today) {
                      piece.level--;
                    } else {
                      piece.level++;
                    }
                  }
                  self.output(piece, true);
                });
                if (!pieces.length) {
                  done = true;
                } else {
                  skip += pieces.length;
                }
                return callback(null);
              });
            }, callback);
          }, callback);
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        self.output(self.home);
        if (self.format === 'xml') {
          fs.writeSync(self.out, '</urlset>\n');
        }
        fs.closeSync(self.out);
        return callback(null);
      });
    };

    self.output = function(page, trustUrl) {
      var url;
      if (self.format === 'text') {
        if (self.indent) {
          var i;
          for (i = 0; (i < page.level); i++) {
            fs.writeSync(out, '  ');
          }
        }
        fs.writeSync(out, page.slug);
      } else {
        url = page._url;
        fs.writeSync(self.out, '  <url><priority>' + (1.0 - page.level / 10) + '</priority><changefreq>daily</changefreq><loc>' + url + '</loc></url>\n');
      }
      _.each(page._children, function(page) {
        self.output(page);
      });
    };
  }
};

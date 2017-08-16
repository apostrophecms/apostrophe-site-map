var moment = require('moment');
var async = require('async');
var _ = require('lodash');
var fs = require('fs');
var url = require('url');

module.exports = {
  afterConstruct: function(self) {
    self.apos.tasks.add(self.__meta.name, 'map', self.map);
  },
  
  construct: function(self, options) {

    self.map = function(apos, argv, callback) {

      self.workflow = self.apos.modules['apostrophe-workflow'];
      
      if (!apos.options.baseUrl) {
        return callback(new Error(
          'You must specify the top-level baseUrl option when configuring Apostrophe\n' +
          'to use this task. Example: baseUrl: "http://mycompany.com"\n\n' +
          'Note there is NO TRAILING SLASH.\n\n' +
          'Usually you will only do this in data/local.js, on production.'
        ));
      }
      var criteria = {};
      self.format = argv.format || 'xml';
      self.indent = !!argv.indent;
      self.maps = {};
      self.today = moment().format('YYYY-MM-DD');
      self.excludeTypes = options.excludeTypes || [];

      if (argv['exclude-types']) {
        self.excludeTypes = excludeTypes.concat(argv['exclude-types'].split(','));
        criteria.type = { $nin: excludeTypes };
      }
      
      var locales = [ 'default' ];
      
      if (self.workflow) {
        locales = _.filter(_.keys(self.workflow.locales), function(locale) {
          return !locale.match(/\-draft$/);
        });
      }

      return async.eachSeries(locales, function(locale, callback) {
        var req = self.apos.tasks.getAnonReq();
        req.locale = locale;
        return async.series([
          _.partial(self.getPages, req, locale),
          _.partial(self.getPieces, req, locale),
          function(callback) {
            if (self.custom.length === 1) {
              return self.custom(callback);
            } else {
              return self.custom(req, locale, callback);
            }
          }
        ], callback);
      }, function(err) {
        if (err) {
          return callback(err);
        }
        self.writeSitemap();
        return callback(null);
      });
    };

    self.getPages = function(req, locale, callback) {
      return self.findPages(req).toObject(function(err, home) {
        if (err) {
          return callback(err);
        }
        if (!home) {
          return callback('no homepage for the ' + locale + 'locale');
        }
        self.output(home);
        return callback(null);
      });
    };
    
    self.getPieces = function(req, locale, callback) {
      var modules = _.filter(self.apos.modules, function(module, name) {
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
          return self.findPieces(req, module).skip(skip).limit(100).toArray(function(err, pieces) {
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
              self.output(piece);
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
    };
        
    self.writeSitemap = function() {
      if (!self.apos.argv['per-locale']) {
        // Simple single-file sitemap
        self.file = self.apos.argv.file || '/dev/stdout';
        var map = _.values(self.maps).join('\n');
        self.writeMap(self.file, map);
      } else {
        // They should be broken down by host,
        // in which case we automatically place them
        // in public/sitemaps in a certain naming pattern
        var sitemaps = self.apos.rootDir + '/public/sitemaps';
        try {
          fs.mkdirSync(sitemaps);
        } catch (e) {
          // exists
        }
        _.each(self.maps, function(map, key) {
          var extension = (self.format === 'xml') ? 'xml' : 'txt';
          self.writeMap(sitemaps + '/' + key + '.' + extension, map);
        });
        self.writeIndex();
      }
    };
    
    self.writeIndex = function() {
      var now = new Date();
      var sitemaps = self.apos.rootDir + '/public/sitemaps';

      fs.writeFileSync(sitemaps + '/index.xml',
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        _.map(_.keys(self.maps), function(key) {
          var map = self.maps[key];
          var sitemap = '  <sitemap>\n' +
            '    <loc>' + self.apos.baseUrl + self.apos.prefix + '/sitemaps/' + key + '.xml'
              + '</loc>\n' +
            '    <lastmod>' + now.toISOString() + '</lastmod>\n' +
          '  </sitemap>\n';
          return sitemap;
        }).join('') +
        '</sitemapindex>\n'
      );
    };
    
    self.writeMap = function(file, map) {
      if (self.format === 'xml') {
        self.writeXmlMap(file, map);
      } else {
        self.writeFile(file, map);
      }
    };
    
    self.writeXmlMap = function(file, map) {
      self.writeFile(file,
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        map +
        '</urlset>\n'
      );
    };
    
    self.writeFile = function(filename, s) {
      if (filename === '/dev/stdout') {
        // Strange bug on MacOS when using writeFileSync with /dev/stdout
        fs.writeSync(1, s);
      } else {
        fs.writeFileSync(filename, s);
      }
    };
    
    // Override to do more. You can invoke `self.output(doc)`
    // from here as many times as you like.

    self.custom = function(req, locale, callback) {
      return callback(null);
    };
    
    self.findPages = function(req) {
      return self.apos.pages.find(req, { level: 0 }).children({ depth: 20 });
    };

    self.findPieces = function(req, module) {
      return module.find(req).published(true).joins(false).areas(false);
    };
    
    // Output the sitemap entry for the given doc, including its children if any.
    // The entry is buffered for output as part of the map for the appropriate
    // locale. If the workflow module is not in use they all accumulate together
    // for a "default" locale. Content not subject to workflow is grouped with
    // the "default" locale. If workflow is active and the locale is not configured
    // or is marked private, the output is discarded.

    self.output = function(page) {
      var locale = page.workflowLocale || 'default';
      if (self.workflow) {
        if (!self.workflow.locales[locale]) {
          return;
        }
        if (self.workflow.locales[locale].private) {
          return;
        }
      }
      var url;
      if (self.format === 'text') {
        if (self.indent) {
          var i;
          for (i = 0; (i < page.level); i++) {
            self.write(locale, '  ');
          }
          self.write(locale, page._url + '\n');
        }
      } else {
        url = page._url;
        self.write(locale, '  <url><priority>' + (1.0 - page.level / 10) + '</priority><changefreq>daily</changefreq><loc>' + url + '</loc></url>\n');
      }
      _.each(page._children || [], function(page) {
        self.output(page);
      });
    };
    
    // Append `s` to a buffer set aside for the map entries
    // for the host `locale`.
    
    self.write = function(locale, s) {
      self.maps[locale] = self.maps[locale] || '';
      self.maps[locale] += s;
    };
  }
};

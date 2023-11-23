var moment = require('moment');
var async = require('async');
var _ = require('@sailshq/lodash');
var fs = require('fs');
var url = require('url');

var defaultLocale = 'default';

module.exports = {

  // Cache sitemaps for 1 hour by default. Depending on pagerank
  // Google may look at your sitemap somewhere between daily and
  // monthly, so don't get your hopes up too far about changing this

  cacheLifetime: 60 * 60,

  piecesPerBatch: 100,

  moogBundle: {
    modules: [ 'apostrophe-site-map-custom-pages', 'apostrophe-site-map-pieces' ],
    directory: 'lib/modules'
  },

  afterConstruct: function(self) {
    self.apos.tasks.add(self.__meta.name, 'map', self.mapTask);
    self.apos.tasks.add(self.__meta.name, 'clear', self.clearTask);
    self.addRoutes();
    self.enableCache();
  },

  construct: function(self, options) {

    self.caching = true;

    self.cacheLifetime = options.cacheLifetime;

    self.piecesPerBatch = options.piecesPerBatch;

    self.baseUrl = options.baseUrl || self.apos.baseUrl;

    self.clearTask = function(apos, argv, callback) {
      // Just forget the current sitemaps to make room
      // for regeneration on the next request
      return self.cache.clear(callback);
    };

    self.mapTask = function(apos, argv, callback) {
      if (argv['update-cache']) {
        self.caching = true;
      } else {
        self.caching = false;
      }

      if (!self.baseUrl) {
        return callback(new Error(
          'You must specify the top-level baseUrl option when configuring Apostrophe\n' +
          'to use this task. Example: baseUrl: "http://mycompany.com"\n\n' +
          'Note there is NO TRAILING SLASH.\n\n' +
          'Usually you will only do this in data/local.js, on production.'
        ));
      }

      return self.map(callback);
    };

    self.map = function(callback) {

      self.workflow = self.apos.modules['apostrophe-workflow'];

      var argv = self.apos.argv;

      if (self.caching) {
        self.cacheOutput = [];
      }
      return async.series([
        lock,
        init,
        map,
        hreflang,
        write,
        unlock
      ], callback);

      function lock(callback) {
        return self.apos.locks.lock('apostrophe-site-map', callback);
      }

      function init(callback) {
        self.format = argv.format || options.format || 'xml';

        self.indent = (typeof(argv.indent) !== 'undefined') ? argv.indent : options.indent;

        self.excludeTypes = options.excludeTypes || [];

        if (argv['exclude-types']) {
          self.excludeTypes = self.excludeTypes.concat(argv['exclude-types'].split(','));
        }

        self.perLocale = options.perLocale || argv['per-locale'];
        // Exception: plaintext sitemaps and sitemap indexes don't go
        // together, so we can presume that if they explicitly ask
        // for plaintext they are just doing content strategy and we
        // should produce a single report
        if (self.format === 'text') {
          self.perLocale = false;
        }
        return callback(null);
      }

      function map(callback) {
        self.maps = {};
        self.today = moment().format('YYYY-MM-DD');

        var locales = [ defaultLocale ];

        if (self.workflow) {
          locales = _.filter(_.keys(self.workflow.locales), function(locale) {
            return !locale.match(/-draft$/) && !self.workflow.locales[locale].private;
          });
        }

        return async.eachSeries(locales, function(locale, callback) {
          var req = self.apos.tasks.getAnonReq({ locale: locale });
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
          return callback(null);
        });
      }

      function hreflang(callback) {

        var alternativesByGuid = {};

        each(function(entry) {
          if (!alternativesByGuid[entry.url.workflowGuid]) {
            alternativesByGuid[entry.url.workflowGuid] = [];
          }
          alternativesByGuid[entry.url.workflowGuid].push(entry);
        });

        each(function(entry) {
          if (self.workflow) {
            entry.url['xhtml:link'] = [{
              _attributes: {
                rel: 'alternate',
                hreflang: entry.url.workflowLocale,
                href: entry.url.loc
              }
            }];
          }
          var alternatives = alternativesByGuid[entry.url.workflowGuid];
          _.each(alternatives, function(alternative) {
            if (alternative === entry) {
              return;
            }
            entry.url['xhtml:link'].push({
              _attributes: {
                rel: 'alternate',
                hreflang: alternative.url.workflowLocale,
                href: alternative.url.loc
              }
            });
          });
        });

        each(function(entry) {
          delete entry.url.workflowLocale;
          delete entry.url.workflowGuid;
        }, true);

        return setImmediate(callback);

        function each(iterator, ignoreWorkflow) {
          _.each(self.maps, function(map) {
            _.each(map, function(entry) {
              if (typeof(entry) !== 'object') {
                return;
              }

              if (!entry.url.workflowGuid && !ignoreWorkflow) {
                return;
              }
              iterator(entry);
            });
          });
        }

      }

      function write(callback) {
        return self.writeSitemap(callback);
      }

      function unlock(callback) {
        return self.apos.locks.unlock('apostrophe-site-map', callback);
      }
    };

    self.getPages = function(req, locale, callback) {
      return self.apos.pages.find(req).areas(false).joins(false).sort({ level: 1, rank: 1 }).toArray(function(err, pages) {
        if (err) {
          return callback(err);
        }
        _.each(pages, self.output);
        return callback(null);
      });
    };

    self.getPieces = function(req, locale, callback) {
      const modules = self.getPiecesModules();

      return async.eachSeries(modules, function(module, callback) {
        if (_.includes(self.excludeTypes, module.name)) {
          return setImmediate(callback);
        }

        // Paginate through 100 (by default) at a time to
        // avoid slamming memory
        var done = false;
        var skip = 0;
        return async.whilst(
          function() { return !done; },
          function(callback) {

          return self.findPieces(req, module)
            .skip(skip)
            .limit(self.piecesPerBatch)
            .toArray(function(err, pieces) {
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

    self.getPiecesModules = () => {
      return Object.values(self.apos.modules).filter((mod) => {
        return mod.__meta.chain.some((meta) => meta.name === 'apostrophe-pieces')
      })
    }

    self.writeSitemap = function(callback) {
      if (!self.perLocale) {
        // Simple single-file sitemap
        self.file = self.caching ? 'sitemap.xml' : (self.apos.argv.file || '/dev/stdout');
        var map = _.map(_.keys(self.maps), function(locale) {
          return _.map(self.maps[locale], self.stringify).join('\n');
        }).join('\n');
        self.writeMap(self.file, map);
      } else {
        // They should be broken down by host,
        // in which case we automatically place them
        // in public/sitemaps in a certain naming pattern
        self.ensureDir('sitemaps');
        _.each(self.maps, function(map, key) {
          var extension = (self.format === 'xml') ? 'xml' : 'txt';
          map = _.map(map, self.stringify).join('\n');
          self.writeMap('sitemaps/' + key + '.' + extension, map);
        });
        self.writeIndex();
      }
      if (self.caching) {
        return self.writeToCache(callback);
      }
      return callback(null);
    };

    // If `value` is not an object, it is returned as-is,
    // or with < & > escaped if `self.format` is `xml`.
    //
    // If it is an object, it is converted to XML elements,
    // one for each property; they may have sub-elements if
    // the properties contain objects. The _attributes
    // property is converted to attributes. Array
    // properties are converted to a series of elements.
    //
    // TODO: this is clearly yak-shaving, but the data format
    // is nice. See if there's another library that takes the same
    // or substantially the same format.

    self.stringify = function(value) {
      if (Array.isArray(value) && (self.format !== 'xml')) {
        return value.join('');
      }
      if (typeof(value) !== 'object') {
        if (self.format === 'xml') {
          return self.apos.utils.escapeHtml(value);
        }
        return value;
      }
      var xml = '';
      _.each(value, function(v, k) {
        if (k === '_attributes') {
          return;
        }
        if (Array.isArray(v)) {
          _.each(v, function(el) {
            element(k, el);
          });
        } else {
          element(k, v);
        }
        function element(k, v) {
          xml += '<' + k;
          if (v && v._attributes) {
            _.each(v._attributes, function(av, a) {
              xml += ' ' + a + '="' + self.apos.utils.escapeHtml(av) + '"';
            });
          }
          xml += '>';
          xml += self.stringify(v || '');
          xml += '</' + k + '>\n';
        }
      });
      return xml;
    };

    self.ensureDir = function(dir) {
      if (!self.caching) {
        dir = self.apos.rootDir + '/public/' + dir;
        try {
          fs.mkdirSync(dir);
        } catch (e) {
          // exists
        }
      }
    };

    self.writeIndex = function() {
      var now = new Date();
      if (!self.baseUrl) {
        throw new Error(
          'You must specify the top-level baseUrl option when configuring Apostrophe\n' +
          'to use sitemap indexes. Example: baseUrl: "http://mycompany.com"\n\n' +
          'Note there is NO TRAILING SLASH.\n\n' +
          'Usually you will override this in data/local.js, on production.'
        );
      }
      self.writeFile('sitemaps/index.xml',

      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
        ' xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
        _.map(_.keys(self.maps), function(key) {
          var map = self.maps[key];
          var sitemap = '  <sitemap>\n' +
            '    <loc>' + self.baseUrl + self.apos.prefix + '/sitemaps/' + key + '.xml'
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
      self.writeFile( file,
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
        'xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 ' +
        'http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd ' +
        'http://www.w3.org/TR/xhtml11/xhtml11_schema.html ' +
        'http://www.w3.org/2002/08/xhtml/xhtml1-strict.xsd" ' +
        'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
        'xmlns:xhtml="http://www.w3.org/TR/xhtml11/xhtml11_schema.html">\n' +
        map +
        '</urlset>\n'
      );
    };

    self.writeFile = function(filename, s) {
      if (!self.caching) {
        filename = require('path').resolve(self.apos.rootDir + '/public', filename);
        if (filename === '/dev/stdout') {
          // Strange bug on MacOS when using writeFileSync with /dev/stdout
          fs.writeSync(1, s);
        } else {
          fs.writeFileSync(filename, s);
        }
      } else {
        self.cacheOutput.push({
          filename: filename,
          data: s,
          createdAt: new Date()
        });
      }
    };

    self.writeToCache = function(callback) {
      return async.series([
        clear,
        insert
      ], callback);

      function clear(callback) {
        return self.cache.clear(callback);
      }

      function insert(callback) {
        return async.eachSeries(self.cacheOutput, function(doc, callback) {
          return self.cache.set(doc.filename, doc, self.cacheLifetime, callback);
        }, callback);
      }
    };

    // Override to do more. You can invoke `self.output(doc)`
    // from here as many times as you like.

    self.custom = function(req, locale, callback) {
      return callback(null);
    };

    self.findPieces = function(req, module, projection = {}) {
      return module.find(req, {}, projection).published(true).joins(false).areas(false);
    };

    // Output the sitemap entry for the given doc, including its children if any.
    // The entry is buffered for output as part of the map for the appropriate
    // locale. If the workflow module is not in use they all accumulate together
    // for a "default" locale. Content not subject to workflow is grouped with
    // the "default" locale. If workflow is active and the locale is not configured
    // or is marked private, the output is discarded.

    self.output = function(page) {
      var locale = page.workflowLocale || defaultLocale;
      if (self.workflow) {
        if (!self.workflow.locales[locale]) {
          return;
        }
        if (self.workflow.locales[locale].private) {
          return;
        }
      }

      if (!_.includes(self.excludeTypes, page.type)) {
        var url;

        if (self.format === 'text') {
          if (self.indent) {
            var i;

            for (i = 0; (i < page.level); i++) {
              self.write(locale, '  ');
            }

            self.write(locale, self.rewriteUrl(page._url) + '\n');
          }
        } else {
          url = self.rewriteUrl(page._url);
          var priority = (page.level < 10) ? (1.0 - page.level / 10) : 0.1;

          if (typeof (page.siteMapPriority) === 'number') {
            priority = page.siteMapPriority;
          }

          self.write(locale, {
            url: {
              priority: priority,
              changefreq: 'daily',
              loc: self.apos.baseUrl ? url : (self.baseUrl || "") + url,
              workflowGuid: page.workflowGuid,
              workflowLocale: locale
            }
          });
        }
      }

    };

    // Append `s` to an array set aside for the map entries
    // for the host `locale`.

    self.write = function(locale, s) {
      self.maps[locale] = self.maps[locale] || [];
      self.maps[locale].push(s);
    };

    self.addRoutes = function() {
      // Deliver from our tiny little fake cache filesystem
      self.apos.app.get('/sitemap.xml', function(req, res) {
        return self.sendCache(res, 'sitemap.xml');
      });
      self.apos.app.get('/sitemaps/*', function(req, res) {
        return self.sendCache(res, 'sitemaps/' + req.params[0]);
      });
    };

    self.sendCache = function(res, path) {
      return self.cache.get(path, function(err, file) {
        if (err) {
          return fail(err);
        }
        if (!file) {
          // If anything else exists in our little filesystem, this
          // should be a 404 (think of a URL like /sitemap/madeupstuff).
          // Otherwise it just means the
          // cache has expired or has never been populated.
          //
          // Check for the sitemap index or, if we're not
          // running in that mode, check for sitemap.xml
          //
          // Without this check every 404 would cause a lot of work to be done.
          return self.cache.get(self.perLocale ? 'sitemaps/index.xml' : 'sitemap.xml', function(err, exists) {
            if (err) {
              return fail(err);
            }
            if (exists) {
              return notFound();
            }
            return self.cacheAndRetry(res, path);
          });
        }
        return res.contentType('text/xml').send(file.data);
      });

      function notFound() {
        return res.status(404).send('not found');
      }

      function fail(err) {
        console.error(err);
        return res.status(500).send('error');
      }
    };

    self.cacheAndRetry = function(res, path) {
      return self.map(function(err) {
        if (err) {
          return fail(err);
        }
        return self.sendCache(res, path);
      });
      function fail(err) {
        console.error(err);
        return res.status(500).send('error');
      }
    };

    self.enableCache = function() {
      self.cache = self.apos.caches.get('apostrophe-sitemap');
    };

    // Override this method at project level to customize the URLs output in the sitemap.
    // Useful in headless applications where the URLs visible to Apostrophe,
    // acting as a backend, differ from those visible to the public

    self.rewriteUrl = url => {
      return url;
    };

    self.getPageTree = async (req) => {
      const excludedTypes = [
        'workflow-document',
        ...self.options.excludeTypes || [],
        ...self.options.excludeTypesFromPageTree || [],
      ]

      const pages = await getPages();
      const pagesWithPieces = await getPieces(pages);

      return rewriteUrls(pagesWithPieces);

      async function getPages () {
        try {
          const projection =  {
            _id: 1,
            title: 1,
            type: 1,
            slug: 1,
            path: 1,
            rank: 1,
            level: 1
          }

          const criteria = {
            type: {
              $nin: excludedTypes
            }
          }

          const homePage = await self.apos.pages
          .find(req, { level: 0 }, projection)
          .children({ depth: 1000, orphan: null, projection, and: criteria })
          .toObject();

          return [
            {
              ...homePage,
              _children: []
            },
            ...homePage._children
          ]
        } catch (err) {
          self.apos.utils.error(err);
        }
      }

      async function getPieces (pages) {
        const piecesModules = self.getPiecesModules();
        const pieces = [];

        for (const mod of piecesModules) {
          if (excludedTypes.includes(mod.name)) {
            continue;
          }

          await fetchPieces(req, {
            mod,
            skip: 0,
            pieces
          });
        }

        return insertPieces(pages, pieces)

        async function fetchPieces (req, {
          mod, skip, pieces
        }) {
          try {
            const fetchedPieces = await self.findPieces(req, mod, { _id: 1, title: 1, _url: 1 })
              .skip(skip)
              .limit(self.piecesPerBatch)
              .toArray();

            if (!Array.isArray(fetchedPieces)) {
              return;
            }

            fetchedPieces.forEach(piece => {
              if (piece._url && !excludedTypes.includes(piece.type)) {
                pieces.push(piece);
              }
            });

            if (fetchedPieces.length) {
              await fetchPieces(req, {
                mod,
                skip: skip + fetchedPieces.length,
                pieces
              });
            }
          } catch (err) {
            self.apos.utils.error(err);
          }
        }

        function insertPieces (pages, pieces) {
          return pages.reduce((acc, page) => {
            const filledChildren = page._children.length
              ? insertPieces(page._children, pieces)
              : page._children

            const childrenPieces = pieces
              .filter((piece) => piece._parentUrl === page._url)

            return [
              ...acc,
              {
                ...page,
                _children: [
                  ...filledChildren,
                  ...childrenPieces
                ]
              }
            ]
          }, [])
        }
      }

      function rewriteUrls (pages = []) {
        return pages.reduce((acc, page) => {
          return [
            ...acc,
            {
              ...page,
              _url: self.rewriteUrl(page._url),
              _children: rewriteUrls(page._children)
            }
          ]
        }, [])
      }
    };
  }
};

var assert = require('assert');
var _ = require('@sailshq/lodash');
var async = require('async');
var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');

var parkedPages = [
  {
    title: 'Tab One',
    type: 'default',
    slug: '/tab-one',
    _children: [
      {
        title: 'Tab One Child One',
        type: 'default',
        slug: '/tab-one/child-one'
      },
      {
        title: 'Tab One Child Two',
        type: 'default',
        slug: '/tab-one/child-two'
      },
    ]
  },
  {
    title: 'Tab Two',
    type: 'default',
    slug: '/tab-two',
    _children: [
      {
        title: 'Tab Two Child One',
        type: 'default',
        slug: '/tab-two/child-one'
      },
      {
        title: 'Tab Two Child Two',
        type: 'default',
        slug: '/tab-two/child-two'
      },
    ]
  },
  {
    title: 'Products',
    type: 'products-page',
    slug: '/products'
  }
];

var parkedPageTypes = [
  {
    name: 'home',
    label: 'Home'
  },
  {
    name: 'default',
    label: 'Default'
  },
  {
    name: 'products',
    label: 'Products'
  }
];

var workflowLocales = [
  {
    name: 'default',
    private: true,
    children: [
      {
        name: 'fr',
        label: 'French'
      },
      {
        name: 'en',
        label: 'English'
      }
    ]
  }
];

describe('Apostrophe Sitemap: workflow: hostname and prefixes with perLocale', function() {

  var apos;

  this.timeout(5000);

  after(function(done) {
    try {
      require('apostrophe/test-lib/util').destroy(apos, done);
    } catch (e) {
      console.warn('Old version of apostrophe does not export test-lib/util library, just dropping old test db');
      apos.db.dropDatabase();
      setTimeout(done, 1000);
    }
  });

  it('perLocale: should be a property of the apos object', function(done) {
    apos = require('apostrophe')({
      testModule: true,
      baseUrl: 'http://localhost:7777',
      modules: {
        'apostrophe-express': {
          port: 7777
        },
        'apostrophe-site-map': {
          perLocale: true
        },
        'apostrophe-pages': {
          park: _.cloneDeep(parkedPages),
          types: _.cloneDeep(parkedPageTypes)
        },
        'products': {
          extend: 'apostrophe-pieces',
          name: 'product'
        },
        'products-pages': {
          extend: 'apostrophe-pieces-pages'
        },
        'apostrophe-workflow': {
          locales: _.cloneDeep(workflowLocales),
          hostnames: {
            'fr': 'exemple.fr',
            'default': 'example.com',
            'en': 'example.com'
          },
          prefixes: {
            // Even private locales must be distinguishable by hostname and/or prefix
            'default': '/default',
            'en': '/en'
            // We don't need prefixes for fr because
            // that hostname is not shared with other
            // locales
          }
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-site-map']);
        assert(apos.modules['apostrophe-workflow']);
        return callback(null);
      },
      afterListen: function(err) {
        done();
      }
    });
  });

  it('insert a product for test purposes', function(done) {
    var product = _.assign(apos.modules.products.newInstance(), {
      title: 'Cheese',
      slug: 'cheese'
    });
    apos.modules.products.insert(apos.tasks.getReq(), product, function(err) {
      assert(!err);
      done();
    });
  });

  it('make sure everything is published and out of the trash for test purposes', function(done) {
    return apos.docs.db.update({}, {
      $set: {
        trash: false,
        published: true
      }
    }, {
      multi: true
    }, function(err, count) {
      assert(!err);
      done();
    });
  });

  it('should generate a suitable sitemap index', function(done) {
    this.timeout(10000);
    get('http://localhost:7777/sitemaps/index.xml', function(err, xml) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(xml);
      assert(xml.indexOf('http://localhost:7777/sitemaps/fr.xml') !== -1);
      assert(xml.indexOf('http://localhost:7777/sitemaps/en.xml') !== -1);
      assert(xml.indexOf('http://localhost:7777/sitemaps/default.xml') === -1);
      done();
    });
  });

  it('should generate an fr sitemap', function(done) {
    get('http://localhost:7777/sitemaps/fr.xml', function(err, xml) {
      assert(!err);
      assert(xml.indexOf('<loc>http://exemple.fr/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://exemple.fr/tab-two/child-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://exemple.fr/products/cheese</loc>') !== -1);
      done();
    });
  });

  it('should generate an en sitemap', function(done) {
    get('http://localhost:7777/sitemaps/en.xml', function(err, xml) {
      assert(!err);
      assert(xml);
      assert(xml.indexOf('<loc>http://example.com/en/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://example.com/en/tab-two/child-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://example.com/en/products/cheese</loc>') !== -1);
      done();
    });
  });

  it('should NOT generate a default sitemap', function(done) {
    get('http://localhost:7777/sitemaps/default.xml', function(err, xml) {
      assert(err);
      assert(!xml);
      done();
    });
  });

});

describe('Apostrophe Sitemap: workflow: hostname and prefixes without perLocale', function() {
  var apos;

  this.timeout(5000);

  after(function(done) {
    try {
      require('apostrophe/test-lib/util').destroy(apos, done);
    } catch (e) {
      console.warn('Old version of apostrophe does not export test-lib/util library, just dropping old test db');
      apos.db.dropDatabase();
      setTimeout(done, 1000);
    }
  });

  it('should initialize', function(done) {
    apos = require('apostrophe')({
      testModule: true,
      baseUrl: 'http://localhost:7778',
      modules: {
        'apostrophe-express': {
          port: 7778
        },
        'apostrophe-site-map': {
          // perLocale is not set
        },
        'apostrophe-pages': {
          park: _.cloneDeep(parkedPages),
          types: _.cloneDeep(parkedPageTypes)
        },
        'products': {
          extend: 'apostrophe-pieces',
          name: 'product'
        },
        'products-pages': {
          extend: 'apostrophe-pieces-pages'
        },
        'apostrophe-workflow': {
          locales: _.cloneDeep(workflowLocales),
          hostnames: {
            'fr': 'exemple.fr',
            'default': 'example.com',
            'en': 'example.com'
          },
          prefixes: {
            // Even private locales must be distinguishable by hostname and/or prefix
            'default': '/default',
            'en': '/en'
            // We don't need prefixes for fr because
            // that hostname is not shared with other
            // locales
          }
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-site-map']);
        assert(apos.modules['apostrophe-workflow']);
        return callback(null);
      },
      afterListen: function(err) {
        done();
      }
    });
  });

  it('insert a product for test purposes', function(done) {
    var product = _.assign(apos.modules.products.newInstance(), {
      title: 'Cheese',
      slug: 'cheese'
    });
    apos.modules.products.insert(apos.tasks.getReq(), product, function(err) {
      assert(!err);
      done();
    });
  });

  it('make sure everything is published and out of the trash for test purposes', function(done) {
    return apos.docs.db.update({}, {
      $set: {
        trash: false,
        published: true
      }
    }, {
      multi: true
    }, function(err, count) {
      assert(!err);
      done();
    });
  });

  it('should generate a suitable all-in-one sitemap', function(done) {
    this.timeout(5000);
    get('http://localhost:7778/sitemap.xml', function(err, xml) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(xml);
      // Watch out for bad markup due to array of locales being naively XMLized
      assert(xml.indexOf('<0>') === -1);
      // No sub-sitemaps in this mode
      assert(xml.indexOf('http://localhost:7778/sitemaps/fr.xml') === -1);
      assert(xml.indexOf('<loc>http://exemple.fr/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://exemple.fr/tab-two/child-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://exemple.fr/products/cheese</loc>') !== -1);
      assert(xml.indexOf('<loc>http://example.com/en/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://example.com/en/tab-two/child-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://example.com/en/products/cheese</loc>') !== -1);
      // No default locale in sitemap (it is private)
      assert(xml.indexOf('<loc>http://example.com/default') === -1);
      done();
    });
  });
});

describe('Apostrophe Sitemap: workflow: legacy subdomains option', function() {

  var apos;
  this.timeout(5000);

  after(function(done) {
    try {
      require('apostrophe/test-lib/util').destroy(apos, done);
    } catch (e) {
      console.warn('Old version of apostrophe does not export test-lib/util library, just dropping old test db');
      apos.db.dropDatabase();
      setTimeout(done, 1000);
    }
  });

  it('should be a property of the apos object', function(done) {
    apos = require('apostrophe')({
      testModule: true,
      baseUrl: 'http://localhost:7779',
      modules: {
        'apostrophe-express': {
          port: 7779
        },
        'apostrophe-site-map': {
          perLocale: true
        },
        'apostrophe-pages': {
          park: _.cloneDeep(parkedPages),
          types: _.cloneDeep(parkedPageTypes)
        },
        'products': {
          extend: 'apostrophe-pieces',
          name: 'product'
        },
        'products-pages': {
          extend: 'apostrophe-pieces-pages'
        },
        'apostrophe-workflow': {
          locales: _.cloneDeep(workflowLocales),
          subdomains: true
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-site-map']);
        assert(apos.modules['apostrophe-workflow']);
        return callback(null);
      },
      afterListen: function(err) {
        done();
      }
    });
  });

  it('insert a product for test purposes', function(done) {
    var product = _.assign(apos.modules.products.newInstance(), {
      title: 'Cheese',
      slug: 'cheese'
    });
    apos.modules.products.insert(apos.tasks.getReq(), product, function(err) {
      assert(!err);
      done();
    });
  });

  it('make sure everything is published and out of the trash for test purposes', function(done) {
    return apos.docs.db.update({}, {
      $set: {
        trash: false,
        published: true
      }
    }, {
      multi: true
    }, function(err, count) {
      assert(!err);
      done();
    });
  });

  it('should generate a suitable sitemap index', function(done) {
    get('http://localhost:7779/sitemaps/index.xml', function(err, xml) {
      assert(!err);
      assert(xml);
      assert(xml.indexOf('http://localhost:7779/sitemaps/fr.xml') !== -1);
      assert(xml.indexOf('http://localhost:7779/sitemaps/en.xml') !== -1);
      assert(xml.indexOf('http://localhost:7779/sitemaps/default.xml') === -1);
      done();
    });
  });

  it('should generate an fr sitemap', function(done) {
    get('http://localhost:7779/sitemaps/fr.xml', function(err, xml) {
      assert(!err);
      assert(xml.indexOf('<loc>http://fr.localhost:7779/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://fr.localhost:7779/tab-two/child-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://fr.localhost:7779/products/cheese</loc>') !== -1);
      done();
    });
  });

  it('should generate an en sitemap', function(done) {
    get('http://localhost:7779/sitemaps/en.xml', function(err, xml) {
      assert(!err);
      assert(xml);
      assert(xml.indexOf('<loc>http://en.localhost:7779/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://en.localhost:7779/tab-two/child-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://en.localhost:7779/products/cheese</loc>') !== -1);
      done();
    });
  });

  it('should NOT generate a default sitemap', function(done) {
    get('http://localhost:7779/sitemaps/default.xml', function(err, xml) {
      assert(err);
      assert(!xml);
      done();
    });
  });

});

describe('Apostrophe Sitemap: workflow: single sitemap with hreflang alternatives', function() {

  var apos;

  this.timeout(5000);

  after(function(done) {
    try {
      require('apostrophe/test-lib/util').destroy(apos, done);
    } catch (e) {
      console.warn('Old version of apostrophe does not export test-lib/util library, just dropping old test db');
      apos.db.dropDatabase();
      setTimeout(done, 1000);
    }
  });

  it('perLocale: should be a property of the apos object', function(done) {
    apos = require('apostrophe')({
      testModule: true,
      baseUrl: 'http://localhost:7790',
      modules: {
        'apostrophe-express': {
          port: 7790
        },
        'apostrophe-site-map': {},
        'apostrophe-pages': {
          park: _.cloneDeep(parkedPages),
          types: _.cloneDeep(parkedPageTypes)
        },
        'products': {
          extend: 'apostrophe-pieces',
          name: 'product'
        },
        'products-pages': {
          extend: 'apostrophe-pieces-pages'
        },
        'apostrophe-workflow': {
          locales: _.cloneDeep(workflowLocales),
          hostnames: {
            'fr': 'exemple.fr',
            'default': 'example.com',
            'en': 'example.com'
          },
          prefixes: {
            // Even private locales must be distinguishable by hostname and/or prefix
            'default': '/default',
            'en': '/en'
            // We don't need prefixes for fr because
            // that hostname is not shared with other
            // locales
          }
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-site-map']);
        assert(apos.modules['apostrophe-workflow']);
        return callback(null);
      },
      afterListen: function(err) {
        done();
      }
    });
  });

  it('should generate <xhtml:link hreflang> tags', function(done) {
    this.timeout(10000);
    get('http://localhost:7790/sitemap.xml', function(err, xml) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(xml);

      var $ = cheerio.load(xml, { xmlMode: true });

      var urlTags = $('url').map(function() {
        return {
          loc: $(this).find('loc').text(),
          xhtmlLinks: $(this).find('xhtml\\:link').map(function() {
            return {
              hreflang: $(this).attr('hreflang'),
              href: $(this).attr('href')
            };
          }).get()
        };
      }).get();

      assert.deepEqual(urlTags, [
        {
          loc: 'http://exemple.fr/',
          xhtmlLinks: [
            { hreflang: 'fr', href: 'http://exemple.fr/' },
            { hreflang: 'en', href: 'http://example.com/en/' }
          ]
        },
        {
          loc: 'http://example.com/en/',
          xhtmlLinks: [
            { hreflang: 'en', href: 'http://example.com/en/' },
            { hreflang: 'fr', href: 'http://exemple.fr/' }
          ]
        }
      ]);

      done();
    });
  });

});

function get(url, callback) {
  return request(url, function(err, response, body) {
    if (err || (response.statusCode >= 400)) {
      return callback(err || response.statusCode);
    }
    return callback(null, body);
  });
}

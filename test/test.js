var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var request = require('request');
var fs = require('fs');

describe('Apostrophe Sitemap: workflow hostname and prefixes', function() {

  var apos;

  this.timeout(5000);

  after(function() {
    apos.db.dropDatabase();
  });

  it('should be a property of the apos object', function(done) {
    apos = require('apostrophe')({
      testModule: true,
      baseUrl: 'http://localhost:3000',
      modules: {
        'apostrophe-site-map': {
          perLocale: true
        },
        'apostrophe-pages': {
          park: [
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
          ],
          types: [
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
          ]
        },
        'products': {
          extend: 'apostrophe-pieces',
          name: 'product'
        },
        'products-pages': {
          extend: 'apostrophe-pieces-pages'
        },
        'apostrophe-workflow': {
          locales: [
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
          ],
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
    get('http://localhost:3000/sitemaps/index.xml', function(err, xml) {
      assert(!err);
      assert(xml);
      assert(xml.indexOf('http://localhost:3000/sitemaps/fr.xml') !== -1);
      assert(xml.indexOf('http://localhost:3000/sitemaps/en.xml') !== -1);
      assert(xml.indexOf('http://localhost:3000/sitemaps/default.xml') === -1);
      done();
    });
  });

  it('should generate an fr sitemap', function(done) {
    get('http://localhost:3000/sitemaps/fr.xml', function(err, xml) {
      assert(!err);
      assert(xml.indexOf('<loc>http://exemple.fr/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://exemple.fr/tab-two/child-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://exemple.fr/products/cheese</loc>') !== -1);
      done();
    });
  });

  it('should generate an en sitemap', function(done) {
    get('http://localhost:3000/sitemaps/en.xml', function(err, xml) {
      assert(!err);
      assert(xml);
      assert(xml.indexOf('<loc>http://example.com/en/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://example.com/en/tab-two/child-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://example.com/en/products/cheese</loc>') !== -1);
      done();
    });
  });

  it('should NOT generate a default sitemap', function(done) {
    get('http://localhost:3000/sitemaps/default.xml', function(err, xml) {
      assert(err);
      assert(!xml);
      done();
    });
  });

});

describe('Apostrophe Sitemap: legacy subdomains option', function() {

  var apos;

  this.timeout(5000);

  after(function() {
    apos.db.dropDatabase();
  });

  it('should be a property of the apos object', function(done) {
    apos = require('apostrophe')({
      testModule: true,
      baseUrl: 'http://localhost:3001',
      modules: {
        'apostrophe-express': {
          port: 3001
        },
        'apostrophe-site-map': {
          perLocale: true
        },
        'apostrophe-pages': {
          park: [
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
          ],
          types: [
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
          ]
        },
        'products': {
          extend: 'apostrophe-pieces',
          name: 'product'
        },
        'products-pages': {
          extend: 'apostrophe-pieces-pages'
        },
        'apostrophe-workflow': {
          locales: [
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
          ],
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
    get('http://localhost:3001/sitemaps/index.xml', function(err, xml) {
      assert(!err);
      assert(xml);
      assert(xml.indexOf('http://localhost:3001/sitemaps/fr.xml') !== -1);
      assert(xml.indexOf('http://localhost:3001/sitemaps/en.xml') !== -1);
      assert(xml.indexOf('http://localhost:3001/sitemaps/default.xml') === -1);
      done();
    });
  });

  it('should generate an fr sitemap', function(done) {
    get('http://localhost:3001/sitemaps/fr.xml', function(err, xml) {
      assert(!err);
      assert(xml.indexOf('<loc>http://fr.localhost:3001/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://fr.localhost:3001/tab-two/child-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://fr.localhost:3001/products/cheese</loc>') !== -1);
      done();
    });
  });

  it('should generate an en sitemap', function(done) {
    get('http://localhost:3001/sitemaps/en.xml', function(err, xml) {
      assert(!err);
      assert(xml);
      assert(xml.indexOf('<loc>http://en.localhost:3001/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://en.localhost:3001/tab-two/child-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://en.localhost:3001/products/cheese</loc>') !== -1);
      done();
    });
  });

  it('should NOT generate a default sitemap', function(done) {
    get('http://localhost:3001/sitemaps/default.xml', function(err, xml) {
      assert(err);
      assert(!xml);
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

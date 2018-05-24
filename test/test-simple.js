var assert = require('assert');
var _ = require('@sailshq/lodash');
var async = require('async');
var request = require('request');
var fs = require('fs');

describe('Apostrophe Sitemap: simple site without workflow', function() {

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
      baseUrl: 'http://localhost:7780',
      modules: {
        'apostrophe-express': {
          port: 7780
        },
        'apostrophe-site-map': {
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
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-site-map']);
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

  it('insert an unpublished product for test purposes', function(done) {
    var product = _.assign(apos.modules.products.newInstance(), {
      title: 'Rocks',
      slug: 'rocks',
      published: false
    });
    apos.modules.products.insert(apos.tasks.getReq(), product, function(err) {
      assert(!err);
      done();
    });
  });

  it('should generate a suitable sitemap', function(done) {
    this.timeout(10000);
    get('http://localhost:7780/sitemap.xml', function(err, xml) {
      if (err) {
        console.error(err);
      }
      assert(!err);
      assert(xml);
      assert(xml.indexOf('<loc>http://localhost:7780/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one/child-one</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/cheese</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/rocks</loc>') === -1);
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

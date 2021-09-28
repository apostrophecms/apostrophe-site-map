const assert = require('assert');
const fs = require('fs');
const get = require('./lib/get');

describe('Apostrophe Sitemap: test rewrite URL', function() {

  let apos;

  this.timeout(5000);

  before(function(done) {
    apos = require('apostrophe')({
      testModule: true,
      baseUrl: 'http://localhost:7780',
      modules: {
        'apostrophe-express': {
          port: 7780
        },
        'apostrophe-site-map': {
          construct(self, options) {
            self.rewriteUrl = url => {
              return url.replace('http://localhost:7780', 'https://public-site.com');
            }
          }
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
      afterInit: async function(callback) {
        assert(apos.modules['apostrophe-site-map']);
        try {
          const product = Object.assign(apos.modules.products.newInstance(), {
            title: 'Cheese',
            slug: 'cheese'
          });
          await apos.modules.products.insert(apos.tasks.getReq(), product);
          const product2 = Object.assign(apos.modules.products.newInstance(), {
            title: 'Rocks',
            slug: 'rocks',
            published: false
          });
          await apos.modules.products.insert(apos.tasks.getReq(), product2);
          await apos.docs.db.update({}, {
            $set: {
              trash: false,
              published: true
            }
          }, {
            multi: true
          });
          return callback(null);
        } catch (e) {
          return callback(e);
        }
      },
      afterListen: function(err) {
        done();
      }
    });
  });

  after(function(done) {
    try {
      require('apostrophe/test-lib/util').destroy(apos, done);
    } catch (e) {
      console.warn('Old version of apostrophe does not export test-lib/util library, just dropping old test db');
      apos.db.dropDatabase();
      setTimeout(done, 1000);
    }
  });

  it('should generate a suitable sitemap', async function() {
    this.timeout(10000);
    const xml = await get('http://localhost:7780/sitemap.xml');
    assert(xml);
    assert(xml.includes('<loc>https://public-site.com/</loc>'));
    assert(xml.includes('<loc>https://public-site.com/tab-one</loc>'));
    assert(xml.includes('<loc>https://public-site.com/tab-two</loc>'));
    assert(xml.includes('<loc>https://public-site.com/tab-one/child-one</loc>'));
    assert(xml.includes('<loc>https://public-site.com/products/cheese</loc>'));
    assert(xml.includes('<loc>https://public-site.com/products/rocks</loc>'));
  });

});

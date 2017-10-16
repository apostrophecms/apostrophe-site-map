
var Cache = require('node-cache');
var chai = require('chai');
var express = require('express');
var proxyquire = require('proxyquire');
var request = require('supertest');
var sinon = require('sinon');

chai.should();

describe('apostrophe-site-map', function () {

    var FAKE_DATE = new Date('2010/11/23');

    function homePage() {
        return {
            _url: '/my/homepage/url',
            workflowLocale: 'fr-fr',
            level: 0,
            _children: [{
                _url: '/another/page/url',
                workflowLocale: 'fr-fr',
                level: 1,
                _children: [{
                    _url: '/again/another/page/url',
                    workflowLocale: 'fr-fr',
                    level: 2
                }]
            }]
        };
    };

    function pieces() {
        return [{
            _url: '/my/piece/url',
            workflowLocale: 'fr-fr',
            level: 0,
            _children: [{
                _url: '/my/piece/child/url',
                workflowLocale: 'fr-fr',
                level: 1
            }]
        }, {
            _url: '/another/piece/url',
            workflowLocale: 'fr-fr',
            level: 0,
            _children: [{
                _url: '/another/piece/child/url',
                workflowLocale: 'fr-fr',
                level: 1
            }]
        }];
    };

    beforeEach(function () {
        this.clock = sinon.useFakeTimers(FAKE_DATE);
        this.sitemap = proxyquire('../index', {
        });
    });

    afterEach(function () {
        this.clock.restore();
    });

    function callbackResolver() {
        const args = Array.from(arguments);
        while (args.length > 0) {
            var arg = args.shift();
            if (typeof arg === 'function') {
                return arg(null);
            }
        }
    }

    function buildApos() {
        var pages = {
            find: function () { return this; },
            children: function () { return this; },
            toObject: function (resolver) {
                resolver(null, homePage());
            }
        };

        var targetPieces = pieces();
        var fakeModule = {
            '__meta': { chain: [{ name: 'apostrophe-pieces' }] },
            find: function () { return this; },
            published: function () { return this; },
            joins: function () { return this; },
            areas: function () { return this; },
            skip: function (skip) {
                targetPieces = targetPieces.slice(skip);
                return this;
            },
            limit: function (limit) {
                targetPieces = targetPieces.slice(0, limit);
                return this;
            },
            toArray: function (resolver) {
                resolver(null, targetPieces);
            }
        };

        return {
            argv: {},
            baseUrl: 'baseUrl',
            caches: {
                get: function () {
                    var cache = new Cache();
                    return {
                        get: cache.get,
                        set: cache.set,
                        clear: callbackResolver
                    }
                }
            },
            locks: {
                lock: callbackResolver,
                unlock: callbackResolver
            },
            modules: { fakeModule: fakeModule },
            pages: pages,
            prefix: '',
            tasks: {
                getAnonReq: function () { return {}; },
                add: function () { }
            }
        }
    }

    it('should return xml sitemap when calling route', function () {
        // given
        var self = {
            '__meta': { name: 'apostrophe-site-map' },
            apos: buildApos()
        };

        self.apos.app = express();

        this.sitemap.construct(self, {});
        this.sitemap.afterConstruct(self);

        // when
        return request(self.apos.app)
            .get('/sitemap.xml')
            // then
            .expect('Content-Type', /text\/xml/)
            .expect(200)
            .expect(function (res) {
                res.text.should.deep.equal(
                    '<?xml version="1.0" encoding="UTF-8"?>\n' +
                    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
                    '  <url><priority>1</priority><changefreq>daily</changefreq><loc>/my/homepage/url</loc></url>\n' +
                    '  <url><priority>0.9</priority><changefreq>daily</changefreq><loc>/another/page/url</loc></url>\n' +
                    '  <url><priority>0.8</priority><changefreq>daily</changefreq><loc>/again/another/page/url</loc></url>\n' +
                    '  <url><priority>0.7</priority><changefreq>daily</changefreq><loc>/my/piece/url</loc></url>\n' +
                    '  <url><priority>0.9</priority><changefreq>daily</changefreq><loc>/my/piece/child/url</loc></url>\n' +
                    '  <url><priority>0.7</priority><changefreq>daily</changefreq><loc>/another/piece/url</loc></url>\n' +
                    '  <url><priority>0.9</priority><changefreq>daily</changefreq><loc>/another/piece/child/url</loc></url>\n' +
                    '</urlset>\n'
                )
            });
    });

    it('should return xml sitemap per locale when calling route', function () {
        // given
        var self = {
            '__meta': { name: 'apostrophe-site-map' },
            apos: buildApos()
        };

        self.apos.app = express();
        self.apos.modules['apostrophe-workflow'] = {
            '__meta': { name: 'apostrophe-workflow' },
            locales: { 'fr-fr': {} }
        };

        this.sitemap.construct(self, {
            baseUrl: 'baseUrl',
            perLocale: true
        });
        this.sitemap.afterConstruct(self);
        var agent = request(self.apos.app);

        // when
        return agent
            .get('/sitemaps/index.xml')
            // then
            .expect('Content-Type', /text\/xml/)
            .expect(200)
            .expect(function (res) {
                res.text.should.deep.equal(
                    '<?xml version="1.0" encoding="UTF-8"?>\n' +
                    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
                    '  <sitemap>\n' +
                    '    <loc>baseUrl/sitemaps/fr-fr.xml</loc>\n' +
                    '    <lastmod>2010-11-22T23:00:00.000Z</lastmod>\n' +
                    '  </sitemap>\n' +
                    '</sitemapindex>\n'
                );
            })
            .then(function () {
                return agent
                    .get('/sitemaps/fr-fr.xml')
                    // then
                    .expect('Content-Type', /text\/xml/)
                    .expect(200)
                    .expect(function (res) {
                        res.text.should.deep.equal(
                            '<?xml version="1.0" encoding="UTF-8"?>\n' +
                            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
                            '  <url><priority>1</priority><changefreq>daily</changefreq><loc>/my/homepage/url</loc></url>\n' +
                            '  <url><priority>0.9</priority><changefreq>daily</changefreq><loc>/another/page/url</loc></url>\n' +
                            '  <url><priority>0.8</priority><changefreq>daily</changefreq><loc>/again/another/page/url</loc></url>\n' +
                            '  <url><priority>0.7</priority><changefreq>daily</changefreq><loc>/my/piece/url</loc></url>\n' +
                            '  <url><priority>0.9</priority><changefreq>daily</changefreq><loc>/my/piece/child/url</loc></url>\n' +
                            '  <url><priority>0.7</priority><changefreq>daily</changefreq><loc>/another/piece/url</loc></url>\n' +
                            '  <url><priority>0.9</priority><changefreq>daily</changefreq><loc>/another/piece/child/url</loc></url>\n' +
                            '</urlset>\n'
                        );
                    })
            });
    });
});
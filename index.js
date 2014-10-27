/* jshint node:true */

var async = require('async');
var _ = require('lodash');

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
    taskGroups.apostrophe.siteMap = function(apos, argv, callback) {
      var home, tree;
      var criteria = {};
      var req = self._apos.getTaskReq();
      if (argv['exclude-types']) {
        var types = argv['exclude-types'].split(',');
        criteria.type = { $nin: types };
      }
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
        tree: function(callback) {
          return self._pages.getDescendants(req, home, criteria, { orphan: null, depth: 20, fields: { slug: 1, path: 1, rank: 1, level: 1 } }, function(err, children) {
            home.children = children;
            return callback(err);
          });
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        output(home);
        return callback(null);
        function output(page) {
          var s = '';
          var i;
          for (i = 0; (i < page.level); i++) {
            s += '  ';
          }
          s += page.slug;
          console.log(s);
          _.each(page.children, function(page) {
            output(page);
          });
        }
      });
    };
  });

  // Invoke the callback. This must happen on next tick or later!
  return process.nextTick(function() {
    return callback(null);
  });
}

// Export the constructor so others can subclass
factory.Construct = Construct;

var _ = require('@sailshq/lodash');
var field =  require('../../../siteMapPriorityField.js')

module.exports = {
  improve: 'apostrophe-custom-pages',
  beforeConstruct: function(self, options) {
    if (options.sitemap !== false) {
      options.addFields = [
          _.clone(field)
      ].concat(options.addFields || []);
    }
  }
};

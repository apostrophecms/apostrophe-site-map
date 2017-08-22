module.exports = {
  improve: 'apostrophe-custom-pages',
  beforeConstruct: function(self, options) {
    if (options.sitemap !== false) {
      options.addFields = [
        require('../../../siteMapPriorityField.js')
      ].concat(options.addFields || []);
    }
  }
};

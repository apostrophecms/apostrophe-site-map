var _ = require('@sailshq/lodash');
var field =  require('../../../siteMapPriorityField.js');

module.exports = {
  improve: 'apostrophe-custom-pages',
  beforeConstruct: function(self, options) {
    if (options.sitemap !== false) {
      options.addFields = [
          _.clone(field)
      ].concat(options.addFields || []);
    }
  },
  afterConstruct: function(self) {
    self.on('apostrophe:modulesReady', 'adjustSchemaForSiteMapPriority', function() {
      const siteMap = self.apos.modules['apostrophe-site-map'];
      if (siteMap.options.noPriority === true) {
        self.schema = self.schema.filter(item => item.name !== 'siteMapPriority');
      }
    });
  }
};

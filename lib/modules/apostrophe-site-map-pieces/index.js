const _ = require('@sailshq/lodash');
const field = require('../../../siteMapPriorityField.js');
const arrange = require('../../../arrangeFields.js');

module.exports = {
  improve: 'apostrophe-pieces',
  beforeConstruct: function(self, options) {
    var exclude = [
      // These piece types never have pieces pages or URLs ordinarily.
      // If they do in your project, you can add the field yourself
      // and it will be honored, see the source
      'apostrophe-global', 'apostrophe-users', 'apostrophe-tags', 'apostrophe-groups', 'apostrophe-images', 'apostrophe-files'
    ];
    if (_.contains(exclude, self.__meta.name) && (options.sitemap !== true)) {
      return;
    }
    if (options.sitemap !== false) {
      options.addFields = [
        _.clone(field)
      ].concat(options.addFields || []);
      options.arrangeFields = [
        _.clone(arrange)
      ].concat(options.arrangeFields || []);
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

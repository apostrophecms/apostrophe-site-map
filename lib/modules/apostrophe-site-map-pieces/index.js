var _ = require('@sailshq/lodash');
var field =  require('../../../siteMapPriorityField.js');

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
    }
  }
};

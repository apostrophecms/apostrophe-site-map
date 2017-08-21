module.exports = {
  improve: 'apostrophe-custom-pages',
  beforeConstruct: function(self, options) {
    console.log('adding');
    console.log(self.__meta.name);
    options.addFields = [
      require('../../../siteMapPriorityField.js')
    ].concat(options.addFields || []);
  }
};

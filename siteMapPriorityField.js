// Site map priority field for schemas, required
// by our improvements of both apostrophe-custom-pages
// and apostrophe-pieces

module.exports = {
  name: 'siteMapPriority',
  type: 'float',
  label: 'Sitemap Priority',
  required: false,
  def: null,
  min: 0,
  max: 1.0,
  help: 'A number between 0.0 and 1.0. 1.0 is highest priority. Not all types of content appear in sitemaps.'
};

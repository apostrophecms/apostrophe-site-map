const fetch = require('node-fetch');

// Optional callback for older tests
module.exports = async function get(url, callback) {
  if (callback) {
    try {
      const result = await body();
      return callback(null, result);
    } catch (e) {
      return callback(e);
    }
  } else {
    return body();
  }
  async function body() {
    const response = await fetch(url);
    return response.text();
  }
};


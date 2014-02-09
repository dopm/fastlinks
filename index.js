
var domparse = require('dom-parser');
var urllib = require('url');

var isSupported = history && history.pushState && history.replaceState;

function Turbolinks() {
  this.cacheSize = 10;
  this.pageCache = {};
  this.state = null;
  this.referrer = null;

  if (isSupported) {
    history.replaceState({turbolinks: true, url: location.href}, '', location.href);
    this.state = history.state;
  }
}

// event emitter support
require('emitter')(Turbolinks.prototype);

Turbolinks.prototype.visit = function(url) {
  if (!isSupported) return location.href = url;
};

Turbolinks.prototype.fetch = function(url) {
  // remember referer
  this.referrer = document.location.href;

  // cache current page

  // reflect new url
  if (url !== this.referrer) {
    history.pushState({turbolinks: true, url: url}, '', url);
  }

  // fetch replacement
};

Turbolinks.prototype.request = function(url, cb) {
  var me = this;

  var xhr = new XMLHttpRequest();

  // TODO: remove hash
  xhr.open('GET', url, true);
  xhr.setRequestHeader('Accept', 'text/html, application/xhtml+xml, application/xml');
  xhr.setRequestHeader('X-XHR-Referer', me.referrer);

  xhr.onload = function() {
    me.emit('page:receive');
    var ct = xhr.getResponseHeader('Content-Type');
    if (!ct.match(/^(?:text\/html|application\/xhtml\+xml|application\/xml)(?:'|$)/)) {
      return location.href = url;
    }
    cb && cb(domparse(xhr.responseText));
  };

  xhr.onerror = function() {
    location.href = url;
  };

  // emit progress data
  if (xhr.upload) {
    xhr.upload.onprogress = function(e){
      e.percent = e.loaded / e.total * 100;
      me.emit('progress', e);
    };
  }

  xhr.send();

  return xhr;
};

// exports API
exports = module.exports = new Turbolinks();
exports.Turbolinks = Turbolinks;

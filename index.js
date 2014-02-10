
var delegate = require('delegate');
var domparse = require('dom-parser');
var execute = require('execute-script');
var urllib = require('url');

var isSupported = history && history.pushState && history.replaceState;

function Turbolinks() {
  this.cacheSize = 10;
  this.pageCache = {};
  this.state = null;
  this.referrer = null;
  this.transitionCache = false;

  if (isSupported) {
    history.replaceState({turbolinks: true, url: location.href}, '', location.href);
    this.state = history.state;
  }
}

// event emitter support
require('emitter')(Turbolinks.prototype);

Turbolinks.prototype.visit = function(url) {
  if (!isSupported) return location.href = url;

  var me = this;
  // remember referer
  me.referrer = location.href;

  // cache current page

  // reflect new url
  if (url !== me.referrer) {
    history.pushState({turbolinks: true, url: url}, '', url);
  }

  if (me.transitionCache) {
    var cached = me.pageCache[url];
    if (cached) return me.fetch(url);
  }

  me.fetch(url, function() {
    if (location.hash) {
      return location.href = location.href;
    } else {
      window.scrollTo(0, 0);
    }
  });
};

Turbolinks.prototype.fetch = function(url, cb) {
  var me = this;
  me.emit('page:fetch', {url: url});
  me.request(url, function(xhr) {
    var ct = xhr.getResponseHeader('Content-Type');
    var doc;
    if (validContentType(ct) && validStatus(xhr.status)) {
      doc = domparse(xhr.responseText);
    }
    if (!doc) {
      return location.href = url;
    }

    var data = extractTitleAndBody(doc);
    data.runscript = true;
    me.render(data);

    // reflect redirected url
    var loc = xhr.getResponseHeader('X-XHR-Redirected-To');
    if (loc) {
      // TODO: hash
      history.replaceState(me.state, '', loc);
    }

    cb && cb();
  });
};

/**
 * Render data to document.
 */
Turbolinks.prototype.render = function(data) {
  if (data.title) {
    document.title = data.title;
  }
  document.documentElement.replaceChild(data.body, document.body);

  if (data.head) {
    updateHead(data.head);
  }

  if (data.runscript) {
    executeScripts(document.body);
  }

  this.state = history.state;
  this.emit('page:change');
  this.emit('page:update');
};

/**
 * Send xhr request.
 */
Turbolinks.prototype.request = function(url, cb) {
  var me = this;

  var xhr = new XMLHttpRequest();

  // TODO: remove hash
  xhr.open('GET', url, true);
  xhr.setRequestHeader('Accept', 'text/html, application/xhtml+xml, application/xml');
  xhr.setRequestHeader('X-XHR-Referer', me.referrer);

  xhr.onload = function() {
    me.emit('page:receive');
    cb && cb(xhr);
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


function validContentType(ct) {
  return ct.match(/^(?:text\/html|application\/xhtml\+xml|application\/xml)(?:;|$)/);
}
function validStatus(code) {
  return code < 400;
}

function executeScripts(body) {
  var scripts = body.querySelectorAll('script:not([data-turbolinks-eval="false"])');
  for (var i = 0; i < scripts.length; i++) {
    execute(scripts[i]);
  }
}

function updateHead(head) {
  var nodes = head.querySelectorAll('meta');
  for (var i = 0; i < nodes.length; i++) {
    (function(meta) {
      if (!meta.name) return;
      var selector = 'meta[name="' + meta.name + '"]';
      var original = document.head.querySelector(selector);
      if (original) original.content = meta.content;
    })(nodes[i]);
  }
}

function extractTitleAndBody(doc) {
  var ret = {};

  var title = doc.querySelector('title');
  ret.title = title ? title.textContent: null;

  var body = doc.body;
  // remove <noscript>
  body.innerHTML = body.innerHTML.replace(/<noscript[\S\s]*?<\/noscript>/ig, '');
  ret.body = body;

  return ret;
}

// exports API
var turbolinks = new Turbolinks();
turbolinks.Turbolinks = Turbolinks;
module.exports = turbolinks;

if (isSupported) {
  delegate.bind(document, 'a', 'click', function(e) {
    // TODO: ignore click
    turbolinks.visit(e.delegateTarget.href);
    return e.preventDefault();
  }, true);
}

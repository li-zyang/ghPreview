/**
 * url Token: 
 * - originalUrl: where we came from
 * - [optional] source: where to get the page source, if 
 *   window.ghHtmlPreviewJS.pageSource has already been set, this 
 *   attribute can be omitted
 * - repo: the repository name
 * - file: path to the file
 * - user: the name of this user
 * - avatar_url: the avatar of this user
 * - authenticity_token
 * - timestamp
 * - timestamp_secret
 * All these tokens should be url-encoded and then Base64-encoded.
 */

'use strict';

function TimeoutError(what) {
  let res = new Error();
  res.name = 'TimeoutError';
  res.message = (what || '');
  return res;
}

let Base64 = str => ({
  source: str, 
  encode: function() {
    return window.btoa(
      unescape(
        encodeURIComponent(this.source)
      )
    );
  }, 
  decode: function() {
    return decodeURIComponent(
      escape(
        window.atob(str)
      )
    );
  }
})

async function wait(discriminant, timeout) {
  let prop = {};
  let res = new Promise(function poll(resolve, reject) {
    let condition = discriminant();
    if (condition) {
      // clearTimeout(prop.timeout);
      resolve(condition);
    } else if ((new Date).getTime() - prop.openTime > timeout) {
      reject(TimeoutError('Timeout exceeded'));
    } else {
      setTimeout(poll, 0, resolve, reject);
    }
  });
  prop.promise  = res;
  prop.openTime = new Date();
  return res;
}

async function delay(ms) {
  return new Promise(function(resolve, reject) {
    setTimeout(resolve, ms);
  });
}

(function parseUrlToken(search) {
  window.sourceInfo = {};
  if (search.startsWith('?')) {
    let splitted = Base64(search.slice(1)).decode().split('&');
    let careAbout = ['originalUrl', 'source', 'repo', 'file', 'user', 
                     'avatar_url', 'authenticity_token', 'timestamp', 
                     'timestamp_secret'];
    for (let i = 0; i < splitted.length; i++) {
      let token = splitted[i];
      let key = token.slice(0, token.indexOf('='));
      let val = token.slice(key.length + 1);
      if (careAbout.indexOf(key) == -1) {
        continue;
      } else {
        try {
          window.sourceInfo[key] = decodeURIComponent(val.replace('+', ' '));
        } catch (e) {
          if (e.name = 'URIError') {
            console.error(e + ` [${val}]`);
          } else {
            console.error(e);
          }
        }
      }
    }
  } else {
    console.warn('No url token provided');
  }
})(location.search);

$().ready(function() {

(function setPlaceholder() {
  console.log('setting placeholder...');
  $('*').each(function() {
    for (let i = 0; i < this.attributes.length; i++) {
      let attribute = this.attributes[i];
      let placeholderPattern = /\${.*?}/;
      let replaced = attribute.value;
      while (true) {
        let matched = placeholderPattern.exec(replaced);
        if (matched == null) {
          break;
        } else {
          console.log(`setPlaceholder: matched [${matched[0]}]`);
          let raw = replaced;
          let matched_full = matched[0];
          let name = matched_full.slice(matched_full.indexOf('{') + 1, matched_full.lastIndexOf('}'));
          replaced = replaced.replace(placeholderPattern, window.sourceInfo[name]);
          console.log(`${raw} -> ${replaced}`);
        }
      }
      attribute.value = replaced;
    }
  });
  $('.js-set-text').each(function() {
    console.log('processing', this);
    let nodes = Array(...this.childNodes);
    console.log('all:', [...nodes]);
    while (nodes.length) {
      let node = nodes.shift();
      if (node.tagName == undefined) {
        console.log('processing non-element node', node);
        let raw = node.data;
        let placeholderPattern = /\${.*?}/;
        let replaced = raw;
        console.log('seeking in ' + raw);
        while(true) {
          let matched = placeholderPattern.exec(replaced);
          if (matched == null) {
            break;
          } else {
            console.log(`setPlaceholder: matched [${matched[0]}]`);
            let _raw = replaced;
            let matched_full = matched[0];
            let name = matched_full.slice(matched_full.indexOf('{') + 1, matched_full.lastIndexOf('}'));
            replaced = replaced.replace(placeholderPattern, window.sourceInfo[name]);
            console.log(`${_raw} -> ${replaced}`);
          }
        }
        node.data = replaced;
      } else if (!node.classList.contains('js-keep-text')) {
        nodes.concat(Array(node.childNodes));
      }
    }
  });
})();

})
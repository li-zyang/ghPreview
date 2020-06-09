/**
 * url Token: 
 * - originalUrl: where we came from
 * - source: where to get the page source, optional if 'provider' is 
 *   'userscript'
 * - provider: 'userscript' or 'none', the source code provider, default 
 *   to 'none'. If the 'provider' token is 'userscript', the page will 
 *   wait for the userscript to set window.sourceInfo.pageSource
 * - repo: the repository name (INCLUDING the reopsitory owner)
 * - branch: the branch name
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
  Error.call(this, what);
  this.name = 'TimeoutError';
  // this.message = (what || '');
}

TimeoutError.prototype = Object.create(Error.prototype);
TimeoutError.prototype.constructor = TimeoutError;

// =====================================================================

async function wait(discriminant, timeout) {
  let prop = {};
  let res = new Promise(function poll(resolve, reject) {
    let condition = discriminant();
    if (condition) {
      // clearTimeout(prop.timeout);
      resolve(condition);
    } else if (timeout != undefined && (new Date).getTime() - prop.openTime > timeout) {
      reject(new TimeoutError('Timeout exceeded'));
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


function sumLength(...args) {
  let lengths = [...args];
  let summed = 0;
  let unit = '';
  for (let i = 0; i < lengths.length; i++) {
    let cur = lengths[i];
    let numeric = /(\d|\.)+/.exec(cur)[0];
    console.assert(typeof cur == 'string', 'cur is not a string! got:', cur, 'in', lengths);
    if (i == 0) {
      unit = cur.slice(numeric.length);
    } else {
      console.assert(cur.slice(numeric.length) == unit, 'Not the same unit');
    }
    summed += Number(numeric);
  }
  return summed.toString() + unit;
}

function parseLength(strLength) {
  let numeric = /(\d|\.)+/.exec(strLength)[0];
  let unit = strLength.slice(numeric.length);
  return {value: numeric, unit: unit};
}

function calcTotalHeight(element) {
  let style = getComputedStyle(element);
  if (style.boxSizing == 'content-box') {
    return sumLength(style.borderTopWidth, 
                     style.paddingTop, 
                     style.height, 
                     style.paddingBottom, 
                     style.borderBottomWidth);
  } else {
    return sumLength(style.height);
  }
}

function calcTotalWidth(element) {
  let style = getComputedStyle(element);
  if (style.boxSizing == 'content-box') {
    return sumLength(style.borderLeftWidth, 
                     style.paddingLeft, 
                     style.width, 
                     style.paddingRight, 
                     style.borderRightWidth);
  } else {
    return sumLength(style.width);
  }
}

function calcOccupiedHeight(element) {
  let style = getComputedStyle(element);
  return sumLength(style.marginTop, 
                   element.getBoundingClientRect().height.toString() + 'px', 
                   style.marginBottom);
}

function calcOccupiedWidth(element) {
  let style = getComputedStyle(element);
  return sumLength(style.marginLeft, 
                   element.getBoundingClientRect().width.toString() + 'px', 
                   style.marginRight);
}

function sum(array) {
  let res = 0;
  for (let i = 0; i < array.length; i++) {
    res += Number(array[i]);
  }
  return sum;
}

function count(array, discriminant) {
  let res = 0;
  for (let i = 0; i < array.length; i++) {
    let itm = array[i];
    if (discriminant(itm)) {
      res++;
    }
  }
  return res;
}

function parseRelativeURL(raw) {
  if (raw.startsWith('about:')) {
    let _temp = raw.slice(6).split('?');
    let pathname = _temp[0];
    let search = '';
    let hash = '';
    if (_temp[1] && _temp != '') {
      search = _temp[1];
      _temp.shift();
    }
    _temp = _temp[0].split('#');
    if (_temp[1] && _temp != '') {
      hash = _temp[1];
    }
    return {
      hash: hash,
      host: '',
      hostname: '',
      href: raw,
      origin: 'null',
      pathname: pathname,
      port: '',
      protocol: 'about:',
      search: search
    };
  }
  let fullPattern = /^(\w+:)?(\/\/[^\/\?#]+)?(\/?[^\?#]*)?(\?[^#]+)?(#.*)?/;
  let matched = null;
  if (matched = fullPattern.exec(raw)) {
    for (let i = 0; i < matched.length; i++) {
      let urlItem = matched[i];
      if (urlItem == undefined) {
        matched[i] = null;
      }
    }
    let username = null;
    let hostname = null;
    let port = null;
    if (matched[2]) {
      let _temp = matched[2].slice(2).split(':');
      if (_temp.length != 1) {
        port = _temp[1];
      } else {
        port = '';
      }
      _temp = _temp[0].split('@')
      if (_temp.length != 1) {
        username = _temp[0];
        hostname = _temp[1];
      } else {
        username = '';
        hostname = _temp[0];
      }
    }
    return {
      hash: (matched[5] || ''),
      host: (hostname) ? (hostname + ((port == '' || port == null) ? '' : (':' + port))) : null,
      hostname: hostname,
      href: raw,
      origin: (matched[1] && hostname) ? (matched[1] + '//' + hostname + ((port == '' || port == null) ? '' : ':' + port)) : null,
      password: '',
      pathname: hostname ? (matched[3] || '/') : matched[3],
      port: hostname ? (port || '') : port,
      protocol: matched[1],
      search: (hostname || matched[3]) ? (matched[4] || '') : matched[4],
      searchParams: new URLSearchParams(),
      username: username
    };
  }
}

function setURLBase(relativeURL, base) {
  let res = parseRelativeURL(relativeURL);
  let parsedBase = parseRelativeURL(base);
  let keys = Object.keys(res);
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    if (res[key] == null) {
      res[key] = parsedBase[key];
    }
  }
  if (res.pathname != null && parsedBase.protocol != 'about:' && !res.pathname.startsWith('/')) {
    if (parsedBase.pathname) {
      res.pathname = parsedBase.pathname + (parsedBase.pathname.endsWith('/') ? '' : '/') + res.pathname;
    } else {
      res.pathname = '/' + res.pathname;
    }
  }
  return res.protocol + (res.protocol == 'about:' ? '' : '//') + (res.username || '') + ((res.username && res.username != '') ? '@' : '') + res.host + res.pathname + res.search + res.hash;
}

function processDocument(doc) {
  doc.ghPreviewProp = {}
  if (doc.getElementsByTagName('style').length == 0 && 
      doc.querySelectorAll('link[rel~="stylesheet"]').length == 0) {
    let styleNode = doc.createElement('style');
    styleNode.innerHTML = defaultStyles.noany_light;
    doc.head.appendChild(styleNode);
  }
  let forcedStyle = doc.createElement('style');
  forcedStyle.innerHTML = defaultStyles.forced;
  doc.head.appendChild(forcedStyle);
  doc.ghPreviewProp.viewportWidth = '816px';
  let viewportTag = doc.querySelector('meta[name="viewport"]');
  if (viewportTag) {
    let viewportSettingStr = viewportTag.attributes.content.value;
    if (viewportSettingStr) {
      let viewportSettingItem = viewportSettingStr.split(',');
      for (let i = 0; i < viewportSettingItem.length; i++) {
        let [key, val] = viewportSettingItem[i].trim().split('=');
        if (key == 'width') {
          if (val != 'device-width') {
            doc.ghPreviewProp.viewportWidth = val + (/\d$/.test(val) ? 'px' : '');
          }
        } // and to handle more configurations ...
      }
    }
  }
  let baseTag = doc.querySelector('base');
  if (baseTag) {
    let rawBaseURL = baseTag.attributes.href.value;
    if (rawBaseURL && !parseRelativeURL(rawBaseURL).hostname) {
      baseTag.setAttribute('href', setURLBase(
        rawBaseURL, 
        `https://github.com/${window.sourceInfo.repo}/raw/${window.sourceInfo.branch}/${window.sourceInfo.file.replace(/[^\/]*$/, '')}`
      ));
    }
    if (!baseTag.attributes.target) {
      baseTag.setAttribute('target', '_top');
    }
  } else {
    baseTag = doc.createElement('base');
    baseTag.setAttribute('href', `https://github.com/${window.sourceInfo.repo}/raw/${window.sourceInfo.branch}/${window.sourceInfo.file.replace(/[^\/]*$/, '')}`);
    baseTag.setAttribute('target', '_top');
    doc.head.appendChild(baseTag);
  }
  let hyperlinks = doc.querySelectorAll('a');
  for (let i = 0; i < hyperlinks.length; i++) {
    // https://github.com/li-zyang/zScripts/blob/master/github-html-viewer/demo.html
    let linkNode = hyperlinks[i];
    let rawURL = linkNode.attributes.href.value;
    if (rawURL) {
      let parsed = parseRelativeURL(rawURL);
      if (!parsed.hostname && !parsed.pathname && !parsed.search && parsed.hash != '') {
        let base = new URL(location);
        base.hash = '';
        linkNode.setAttribute('href', setURLBase(
          rawURL, 
          base.toString()
        ));
      } else if (!parsed.hostname) {
        linkNode.setAttribute('href', setURLBase(
          rawURL,
          `https://github.com/${window.sourceInfo.repo}/blob/${window.sourceInfo.branch}/${window.sourceInfo.file.replace(/[^\/]*$/, '')}`
        ));
      }
    }
  }
  let scripts = doc.querySelectorAll('script');
  for (let i = 0; i < scripts.length; i++) {
    let scriptNode = scripts[i];
    window.restoredNodes = (window.restoredNodes || []);
    window.restoredNodes.push(scriptNode);
    scriptNode.parentElement.removeChild(scriptNode);
  }
  return doc;
}

function getHeaderLevel(node) {
  if (!(/^H[1-6]$/i.test(node.tagName))) {
    return undefined;
  }
  return Number.parseInt(node.tagName.slice(1));
}

function checkSerial(str) {
  let raw = str;
  let serialPattern = {
    simpCjkLeading : /^\s*((〇|零|一|二|三|四|五|六|七|八|九|十|百)+)(、|\.|\>|・|·|\)|）)\s*/,
    tradCjkLeading : /^\s*((〇|零|壹|貳|叄|肆|伍|六|柒|捌|玖|拾|佰)+)(、|\.|\>|・|·|\)|）)\s*/,
    simpCjkParenthesized : /^\s*(\(|（|\[|【|〖|〔|『|「)((〇|零|一|二|三|四|五|六|七|八|九|十|百)+)(\)|）|\]|】|〗|〕|』|」)(、|\.|\>|・|·|\)|）)?\s*/,
    tradCjkParenthesized : /^\s*(\(|（|\[|【|〖|〔|『|「)((〇|零|壹|貳|叄|肆|伍|六|柒|捌|玖|拾|佰)+)(\)|）|\]|】|〗|〕|』|」)(、|\.|\>|・|·|\)|）)?\s*/,
    decimalLeading       : /^\s*(\d+)(、|\.|\>|・|·|\)|）)\s*/,
    decimalParenthesized : /^\s*(\(|（|\[|【|〖|〔|『|「)(\d+)(\)|）|\]|】|〗|〕|』|」)(、|\.|\>|・|·|\)|）)?\s*/,
    lowerAlphaLeading       : /^\s*([a-z]+)(、|\.|\>|・|·|\)|）)\s*/,
    lowerAlphaParenthesized : /^\s*(\(|（|\[|【|〖|〔|『|「)([a-z]+)(\)|）|\]|】|〗|〕|』|」)(、|\.|\>|・|·|\)|）)?\s*/,
    upperAlphaLeading       : /^\s*([A-Z]+)(、|\.|\>|・|·|\)|）)\s*/,
    upperAlphaParenthesized : /^\s*(\(|（|\[|【|〖|〔|『|「)([A-Z]+)(\)|）|\]|】|〗|〕|』|」)(、|\.|\>|・|·|\)|）)?\s*/,
    lowerRomanLeading       : /^\s*([ivxlcdm]+)(、|\.|\>|・|·|\)|）)\s*/,
    lowerRomanParenthesized : /^\s*(\(|（|\[|【|〖|〔|『|「)([ivxlcdm]+)(\)|）|\]|】|〗|〕|』|」)(、|\.|\>|・|·|\)|）)?\s*/,
    upperRomanLeading       : /^\s*([IVXLCDM]+)(、|\.|\>|・|·|\)|）)\s*/,
    upperRomanParenthesized : /^\s*(\(|（|\[|【|〖|〔|『|「)([IVXLCDM]+)(\)|）|\]|】|〗|〕|』|」)(、|\.|\>|・|·|\)|）)?\s*/,
  }
  let serialPrefix = [];
  while (true) {
    let found = false;
    for (let i = 0; i < Object.entries(serialPattern).length; i++) {
      let [name, pattern] = Object.entries(serialPattern)[i];
      let matched = pattern.exec(str);
      if (matched) {
        serialPrefix.push({
          str: matched[0],
          type: name
        });
        str = str.slice(matched[0].length);
        found = true;
        break;
      }
    }
    if (!found) {
      break;
    }
  }
  return {
    raw: raw,
    prefixes: serialPrefix,
    content: str
  };
}

function genID() {
  let charMap = '0123456789abcdefghijklmnopqretuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let rawID = Number(Math.floor(Math.random() * Math.pow(2, 16)).toString() + Date.now().toString());
  let ID = '';
  while(rawID > 1) {
    let rem = rawID % charMap.length;
    rawID /= charMap.length;
    ID += charMap.charAt(rem);
  }
  return ID;
}

async function loadPageContent(url, fromSourceInfo = false) {
  window.processbar.start();
  return new Promise(function(resolve, reject) {
    if (!fromSourceInfo && 
        (!window.sourceInfo.provider || (window.sourceInfo.provider == 'none') || url)
    ) {
      url = url || window.sourceInfo.source;
      $.get(url)
      .done(function(data) {
        resolve(data);
      })
      .fail(function() {
        let e = new TimeoutError('Timeout exceeded');
        e.errorPage = dedentText(`
          <html>
          <head>
            <style>
              html, body {
                margin: 0px;
              }
              body {
                padding: 50px 75px;
              }
              pre {
                font-size: 14px;
                font-family: Consolas, Monaco, Lucida Console, Liberation Mono, DejaVu Sans Mono, 
                             Bitstream Vera Sans Mono, Courier New, monospace;
                white-space: pre-wrap;
              }
              a {
                cursor: pointer;
                color: #0000ee;
                text-decoration: underline;
              }
            </style>
          </head>
          <body>
            <pre>
          Failed to load ${url}, please <a class="retry">retry</a>.
            </pre>
          </body>
          <script>
            document.getElementsByClassName('retry')[0]
              .addEventListener('click', function() {
                window.parent.loadPageContent();
              })
          </script>
          </html>
        `);
        reject(e);
      });
    } else {
      wait(() => window.sourceInfo.pageSource, 5000)
      .then(async function(data) {
        resolve(data);
      })
      .catch(async function(e) {
        console.error(e);
        if (e.name == 'TimeoutError') {
          e.errorPage = dedentText(`
            <html>
            <head>
              <style>
                html, body {
                  margin: 0px;
                }
                body {
                  padding: 50px 75px;
                }
                pre {
                  font-size: 14px;
                  font-family: Consolas, Monaco, Lucida Console, Liberation Mono, DejaVu Sans Mono, 
                               Bitstream Vera Sans Mono, Courier New, monospace;
                  white-space: pre-wrap;
                }
                a {
                  cursor: pointer;
                  color: #0000ee;
                  text-decoration: underline;
                }
              </style>
            </head>
            <body>
              <pre>
            The userscript takes too long to respond, please check if it was correctly installed and was enabled.
            If everything has been done correctly, try <a class="reload">reloading the page</a> or <a class="report" href="https://github.com/li-zyang/zScripts/issues" target="_top" rel="noopener">report a bug</a>.
              </pre>
            </body>
            <script>
              document.getElementsByClassName('reload')[0]
                .addEventListener('click', function() {
                  window.parent.location.reload();
                });
            </script>
            </html>
          `);
          reject(e);
        } else {
          reject(e);
        }
      });
    }
  })
  .then(function(data) {
    processbar.flush();
    delay(800).then(function() {
      processbar.reset();
    });
    let parser = new DOMParser();
    let doc = parser.parseFromString(data, 'text/html');
    // Process page here
    doc = processDocument(doc);
    let frame = $('.page-frame')[0];
    frame.style.width = doc.ghPreviewProp.viewportWidth;
    frame.contentDocument.write('<!DOCTYPE html>' + doc.documentElement.outerHTML);
    frame.contentDocument.close();
    frame.style.height = null;
    let checker = new ElasticInterval(function() {
      if ($(frame).hasClass('no-change-width') && $(frame).hasClass('no-change-height')) {
        return false;
      }
      let framePageHeight = $(frame.contentDocument).height().toString() + 'px';
      let framePageWidth = $(frame.contentDocument).width().toString() + 'px';
      let frameStyle = getComputedStyle(frame);
      let modified = false;
      if (frameStyle.width != framePageWidth && !$(frame).hasClass('no-change-width')) {
        frame.style.width = framePageWidth;
        modified = true;
      }
      if (frameStyle.height != framePageHeight && !$(frame).hasClass('no-change-height')) {
        frame.style.height = framePageHeight;
        modified = true;
      }
      if (modified) {
        let newPageHeight = $(frame.contentDocument).height().toString();
        let newPageWidth = $(frame.contentDocument).width().toString();
        let newStyle = getComputedStyle(frame);
        let resetCount = 0;
        if (!$(frame).hasClass('no-change-width') && 
            (
              (Number(newPageWidth) - Number(newStyle.width.slice(0, -2))) - 
              (Number(framePageWidth.slice(0, -2)) - Number(frameStyle.width.slice(0, -2)))
            ) > 0
        ) {
          frame.style.width = frameStyle.width;
          $(frame).addClass('no-change-width');
          resetCount++;
          console.log('fixed frame width');
        }
        if (!$(frame).hasClass('no-change-height') && 
            Math.abs(
              (Number(newPageHeight) - Number(newStyle.height.slice(0, -2))) - 
              (Number(framePageHeight.slice(0, -2)) - Number(frameStyle.height.slice(0, -2)))
            ) > 0
        ) {
          frame.style.height = frameStyle.height;
          $(frame).addClass('no-change-height');
          resetCount++;
          console.log('fixed frame height');
        }
        if (resetCount == 2) {
          modified = false;
        }
      }
      return modified;
    }).start();
    window.catalogue.load();
  })
  .catch(function(e) {
    processbar.flush();
    delay(800).then(function() {
      processbar.reset();
    });
    let frame = $('.page-frame')[0];
    if (frame == undefined) {
      console.error('Error on frame: got', $('.page-frame'));
    }
    if (e.name != 'TimeoutError') {
      e.errorPage = dedentText(`
        <html>
        <head>
          <style>
            html, body {
              margin: 0px;
            }
            body {
              padding: 50px 75px;
            }
            pre {
              font-size: 14px;
              font-family: Consolas, Monaco, Lucida Console, Liberation Mono, DejaVu Sans Mono, 
                           Bitstream Vera Sans Mono, Courier New, monospace;
              white-space: pre-wrap;
            }
            a {
              cursor: pointer;
              color: #0000ee;
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <pre>
        There's something wrong with this page. Try <a class="reload">reloading the page</a> or <a class="report" href="https://github.com/li-zyang/zScripts/issues" target="_top" rel="noopener">report a bug</a>.
        For further infomation, please open the console.
          </pre>
        </body>
        <script>
          document.getElementsByClassName('reload')[0]
            .addEventListener('click', function() {
              window.parent.location.reload();
            });
        </script>
        </html>
      `);
    }
    frame.contentDocument.write(e.errorPage);
    frame.contentDocument.close();
    frame.style.height = null;
  })
}

function dedentText(str) {
  let splitted = str.split('\n');
  let minSpaces = Infinity;
  while (/^\s*$/.test(splitted[0])) {
    splitted.shift();
  }
  while (/^\s*$/.test(splitted[splitted.length - 1])) {
    splitted.pop();
  }
  for (let i = 0; i < splitted.length; i++) {
    let line = splitted[i];
    if (/^\s*$/.test(line)) {
      continue;
    }
    let matched = /^\s*/.exec(line)[0];
    if (matched.length < minSpaces) {
      minSpaces = matched.length;
    }
  }
  for (let i = 0; i < splitted.length; i++) {
    let line = splitted[i];
    splitted[i] = line.slice(minSpaces);
  }
  return splitted.join('\n');
}

function exit(code) {
  const prevOnError = window.onerror;
  window.onerror = () => {
    window.onerror = prevOnError;
    return true;
  }
  throw new Error(`Script termination with code ${code || 0}.`);
}

//======================================================================

function Processbar() {
  this.rootNode = $('.progress-pjax-loader-bar');
}

Processbar.prototype.start = function() {
  this.rootNode[0].style.width = '15%'
  $('.progress-pjax-loader').addClass('is-loading');
  let obj = this;
  let timer = setInterval(function() {
    let currentWidth = Number(obj.rootNode[0].style.width.slice(0, -1));
    let nextWidth = currentWidth + 3;
    if (nextWidth >= 95) {
      nextWidth = 95;
      clearInterval(obj.interval);
    }
    obj.rootNode[0].style.width = nextWidth.toString() + '%';
  }, 500);
  this.interval = timer;
  return this;
};

Processbar.prototype.flush = function() {
  this.rootNode[0].style.width = '100%';
  clearInterval(this.interval);
  $('.progress-pjax-loader').removeClass('is-loading');
  return this;
};

Processbar.prototype.reset = function() {
  this.rootNode.addClass('reset');
  this.rootNode[0].style.width = '0%';
  this.rootNode.removeClass('reset');
  return this;
};


// FUCK THE ECMA
// FOR MAKING JAVASCRIPT A LIMITATIVE LANGUAGE

function CatalogueElement(rootNode, ...args) {
  this.rootNode = (rootNode || null);
  this.parent = null;
  this._data = new Array(...args);
  Object.defineProperty(this, 'length', {
    get: function() {
      return this._data.length;
    }
  });
}

CatalogueElement.prototype.get = function(index) {
  return this._data[index];
};

CatalogueElement.prototype.set = function(index, item) {
  if (! index in this) {
    throw new ReferenceError('CatalogueItem does not have index ' + index);
  }
  item.parent = this;
  item.rootNode = $(this.rootNode).find('details')[index];
  let itemTitle = $(item.rootNode).find('summary');
  itemTitle.html(`<a href="${item.href}">${item.title}</a>`);
  this._data[index] = item;
  return this;
};

CatalogueElement.prototype.del = function(index) {
  if (! index in this) {
    throw new ReferenceError('CatalogueItem does not have index ' + index);
  }
  let removed = this._data.splice(index, 1)[0];
  removed.parent = null;
  $(removed.rootNode).remove();
  removed.rootNode = null;
  return removed;
};

CatalogueElement.prototype.push = function(item) {
  let len = this._data.push(item);
  item.parent = this;
  item.rootNode = $(`<details class="level_${item.getLevel()}" open=""></details>`)[0];
  $(this.rootNode).append(item.rootNode);
  item.fillNode();
  return this;
};

CatalogueElement.prototype.pop = function() {
  let removed = this._data.pop();
  removed.parent = null;
  $(removed.rootNode).remove();
  removed.rootNode = null;
  return removed;
};

CatalogueElement.prototype.shift = function() {
  let removed = this._data.shift();
  removed.parent = null;
  $(removed.rootNode).remove();
  removed.rootNode = null;
  return removed;
};

CatalogueElement.prototype.unshift = function(item) {
  let len = this._data.unshift(item);
  item.parent = this;
  item.rootNode = $(`<details class="level_${item.getLevel()}" open=""></details>`)[0];
  $(this.rootNode).prepend(item.rootNode);
  item.fillNode();
  return this;
};

CatalogueElement.prototype.insert = function(index, item) {
  this._data.splice(index, 0, item);
  item.parent = this;
  item.rootNode = $(`<details class="level_${item.getLevel()}" open=""></details>`)[0];
  $(this.rootNode).children().eq(index).before(item.rootNode);
  item.fillNode();
  return this;
};

CatalogueElement.prototype.clear = function() {
  while (this._data.length) {
    this.shift();
  }
  return this;
}


function CatalogueItem(title, href, rootNode, ...args) {
  CatalogueElement.call(this, rootNode, ...args);
  this.title = title;
  this.href = (href || '');
}

CatalogueItem.prototype = Object.create(CatalogueElement.prototype);
CatalogueItem.prototype.constructor = CatalogueItem;

CatalogueItem.prototype.getLevel = function() {
  let level = 1;
  let cur = this;
  while (cur.parent instanceof CatalogueItem) {
    level++;
    cur = cur.parent;
  }
  return level;
};

CatalogueItem.prototype.fillNode = function() {
  let summary = $(this.rootNode).find('summary');
  if (! summary.length) {
    summary = $(`<summary></summary>`);
    $(this.rootNode).append(summary);
  }
  summary.html(`<a href="${this.href}">${this.title}</a>`);
  for (let i = 0; i < this._data.length; i++) {
    let descendant = this._data[i];
    descendant.fillNode();
  }
  return this;
};

CatalogueItem.prototype.remove = function() {
  if (this.parent) {
    return this.parent.del(this.parent._data.indexOf(this));
  }
};

function CatalogueRoot(rootNode, ...args) {
  CatalogueElement.call(this, rootNode, ...args);
};

CatalogueRoot.prototype = Object.create(CatalogueElement.prototype);
CatalogueRoot.prototype.constructor = CatalogueRoot;


function Catalogue() {
  this.rootNode = $('.catalogue');
  this.titleWrapper = this.rootNode.find('.catalogue-title-wrapper');
  this.title = this.rootNode.find('.catalogue-title');
  this.title.icon = this.title.find('.catalogue-title-icon');
  this.title.text = this.title.find('.catalogue-title-text');
  this.divisor = this.rootNode.find('.catalogue-divisor');
  this.content = this.rootNode.find('.catalogue-content');
  this.rootNode._stop = this.rootNode.stop;
  this.data = new CatalogueRoot(this.content);
}

Catalogue.prototype.shink = function(dur = 500) {
  let obj = this;
  return new Promise(function(resolve, reject) {
    obj.titleWrapper[0].style.width = getComputedStyle(obj.titleWrapper[0]).width;
    obj.titleWrapper.shinkedWidth = obj.title.icon[0].getBoundingClientRect().width.toString() + 'px';
    // console.log(`catalogue shinking: ${obj.titleWrapper[0].style.width} -> ${obj.titleWrapper.shinkedWidth}`);
    let animationCount = 0;
    let animationAdd = () => {animationCount++};
    let animationDone = () => {animationCount--; if (animationCount == 0) resolve();};
    obj.rootNode.removeClass('expanded');
    obj.titleWrapper.animate({
      width: obj.titleWrapper.shinkedWidth
    }, {
      duration: dur, 
      easing: 'swing', 
      done: function() {
        animationDone();
      }, 
      fail: reject
    });
    animationAdd();
    obj.title.text.animate({
      opacity: '0%'
    }, {
      duration: dur, 
      easing: 'swing', 
      done: function() {
        animationDone();
      }, 
      fail: reject
    });
    animationAdd();
    obj.title.icon.animate({
      marginRight: '4px'
    }, {
      duration: dur, 
      easing: 'swing', 
      done: function() {
        animationDone();
      }, 
      fail: reject
    });
    animationAdd();
  });
};

Catalogue.prototype.expand = function(dur = 500) {
  let obj = this;
  return new Promise(function(resolve, reject) {
    obj.titleWrapper[0].style.width = getComputedStyle(obj.titleWrapper[0]).width;
    obj.titleWrapper.expandedWidth = '200px';
    // console.log(`catalogue expanding: ${obj.titleWrapper[0].style.width} -> ${obj.titleWrapper.expandedWidth}`);
    let animationCount = 0;
    let animationAdd = () => {animationCount++};
    let animationDone = () => {animationCount--; if (animationCount == 0) resolve();};
    obj.rootNode.addClass('expanded');
    obj.titleWrapper.animate({
      width: obj.titleWrapper.expandedWidth
    }, {
      duration: dur, 
      easing: 'swing', 
      done: function() {
        animationDone();
      }, 
      fail: reject
    });
    animationAdd();
    obj.title.text.animate({
      opacity: '100%'
    }, {
      duration: dur, 
      easing: 'swing', 
      done: function() {
        animationDone();
      }, 
      fail: reject
    });
    animationAdd();
    obj.title.icon.animate({
      marginRight: '8px'
    }, {
      duration: dur, 
      easing: 'swing', 
      done: function() {
        animationDone();
      }, 
      fail: reject
    });
    animationAdd();
  });
};

Catalogue.prototype.fold = function(dur = 500) {
  let obj = this;
  return new Promise(function(resolve, reject) {
    let foldedHeight = (obj.title[0].getBoundingClientRect().height + 40).toString() + 'px';
    let animationCount = 0;
    let animationAdd = () => {animationCount++};
    let animationDone = () => {animationCount--; if (animationCount == 0) resolve();}
    obj.rootNode[0].style.height = getComputedStyle(obj.rootNode[0]).height;
    obj.rootNode.removeClass('opened');
    obj.rootNode.animate({
      height: foldedHeight
    }, {
      duration: dur, 
      easing: 'swing', 
      done: function() {
        obj.rootNode.attr('open', null);
        obj.rootNode.removeClass('limited');
        obj.rootNode[0].style.height = '';
        animationDone();
      }, 
      fail: reject
    });
    animationAdd();
  });
};

Catalogue.prototype.unfold = function(dur = 500) {
  let obj = this;
  return new Promise(function(resolve, reject) {
    obj.rootNode[0].style.height = getComputedStyle(obj.rootNode[0]).height;
    obj.rootNode.attr('open', '');
    let unfoldedHeight = sumLength(
                          getComputedStyle(obj.titleWrapper[0]).paddingTop, 
                          calcOccupiedHeight(obj.title[0]), 
                          calcOccupiedHeight(obj.divisor[0]), 
                          calcOccupiedHeight(obj.content[0]));
    if (parseLength(unfoldedHeight).value > 1.0 * $(window).height() - 90) {
      unfoldedHeight = (1.0 * $(window).height() - 90).toString() + 'px';
      obj.rootNode.addClass('limited');
    } else {
      obj.rootNode.removeClass('limited');
    }
    let animationCount = 0;
    let animationAdd = () => {animationCount++};
    let animationDone = () => {animationCount--; if (animationCount == 0) resolve();}
    obj.rootNode.addClass('opened');
    obj.rootNode.animate({
      height: unfoldedHeight
    }, {
      duration: dur, 
      easing: 'swing', 
      done: function() {
        animationDone();
      }, 
      fail: reject
    });
    animationAdd();
  });
};

Catalogue.prototype.stop = function(...args) {
  this.rootNode._stop(...args);
  this.titleWrapper.stop(...args);
  this.title.stop(...args);
  this.title.icon.stop(...args);
  this.title.text.stop(...args);
  this.divisor.stop(...args);
  this.content.stop(...args);
};

Catalogue.prototype.load = function() {
  let frame = $('.page-frame')[0];
  let nodes = [...frame.contentDocument.documentElement.children].reverse();
  let container = this.data;
  container.clear();
  container.hlevel = 0;
  let prev = null;
  while (nodes.length) {
    let cur = nodes.pop();
    let hlevel = getHeaderLevel(cur);
    if (hlevel) {
      if (!this.data.length) {
        if (frame.contentDocument.querySelectorAll(cur.tagName).length > 1) {
          let id = genID();
          let item = new CatalogueItem(checkSerial(cur.innerText).content, '#' + id);
          item.hlevel = hlevel;
          container.push(item);
          prev = item;
          cur.setAttribute('data-title-id', id);
        }
      } else {
        if (container.hlevel >= hlevel) {
          while (container.hlevel >= hlevel) {
            container = container.parent;
          }
        } else if (prev.hlevel < hlevel) {
          container = prev;
        }
        let id = genID();
        let item = new CatalogueItem(checkSerial(cur.innerText).content, '#' + id);
        item.hlevel = hlevel;
        container.push(item);
        cur.setAttribute('data-title-id', id);
      }
    }
    nodes = nodes.concat([...cur.children].reverse());
  }
};


function ElasticInterval(callback, sampleInterval = 240, maxInterval = 150, minInterval = 0, factor = 1.1765) {
  this.callback = callback;
  this.sampleInterval = sampleInterval;
  this.factor = factor;
  this.minInterval = minInterval;
  this.maxInterval = maxInterval;
  this.startTime = null;
  this.record = [];   // {time, value}
  this.validIndex = 0;
  this.countedRecord = null;    // {indexEnd, count}
  this.timer = null;
  this.currentTimeout = null;
  this.state = 'reset';   // 'reset', 'running', 'paused'
}

ElasticInterval.prototype.calcNextTimeout = function() {
  let now = Date.now();
  if (now - this.startTime < this.sampleInterval) {
    return Math.round(this.sampleInterval / 10);
  }
  let trueCount = this.count();
  // console.log(`true: ${trueCount}, proportion: ${(trueCount / (this.record.length - this.validIndex)).toFixed(3)}, validIndex: ${this.validIndex}`);
  let k = this.factor * (this.minInterval - this.maxInterval);
  // interval is 0 if proportion of true is 1 by default
  return Math.round(Math.max(k * trueCount / (this.record.length - this.validIndex) + this.maxInterval, this.minInterval));
};

ElasticInterval.prototype.start = function() {
  if (this.state == 'reset') {
    this.startTime = Date.now();
  }
  this.state = 'running';
  this.timeoutHandler();
  return this;
};

ElasticInterval.prototype.timeoutHandler = function() {
  let result = this.callback();
  if (this.state == 'running' || this.state == 'paused') {
    this.record.push({
      time: Date.now(), 
      value: result
    });
  }
  if (this.state == 'running') {
    this.currentTimeout = this.calcNextTimeout();
    this.timer = setTimeout(function(obj) {
      obj.timeoutHandler();
    }, this.currentTimeout, this);
  }
};

ElasticInterval.prototype.count = function() {
  let res = 0;
  let now = Date.now();
  if (this.countedRecord != null) {
    let midIndex = Math.floor((this.countedRecord.indexEnd - this.validIndex) / 2);
    if (now - this.record[midIndex].time > this.sampleInterval) {
      this.countedRecord = null;
      this.validIndex = midIndex + 1;
    }
  }
  if (this.validIndex >= 1024) {
    // garbage collection
    this.record.splice(0, this.validIndex);
    this.validIndex = 0;
    this.countedRecord = null;
  }
  for (let i = this.validIndex; i < this.record.length; i++) {
    let cur = this.record[i];
    if (now - cur.time > this.sampleInterval) {
      this.validIndex = i;
      if (this.countedRecord != null && cur.value) {
        this.countedRecord.count--;
      }
    } else {
      if (this.countedRecord != null) {
        if (i < this.countedRecord.indexEnd) {
          res = this.countedRecord.count;
          i = this.countedRecord.indexEnd - 1;    // - 1 to leave space for i++
        } else {
          if (cur.value) {
            res += 1;
            this.countedRecord.count += 1;
          }
          this.countedRecord.indexEnd = i;
        }
      } else {
        if (cur.value) {
          res += 1;
        }
        this.countedRecord = {
          indexEnd: i, 
          count: res
        };
      }
    }
  }
  return res;
};

ElasticInterval.prototype.pause = function() {
  if (this.state == 'running') {
    clearTimeout(this.timer);
    this.state = 'paused';
    this.timer = null;
    this.currentTimeout = null;
  }
  return this;
};

ElasticInterval.prototype.reset = function() {
  if (this.state == 'running') {
    clearTimeout(this.timer);
  }
  if (this.state == 'running' || this.state == 'paused') {
    this.startTime = null;
    this.record = [];
    this.validIndex = 0;
    this.countedRecord = null;
    this.timer = null;
    this.currentTimeout = null;
    this.state = 'reset';
  }
  return this;
};

function Base64() {

}

Base64.encode = function(str) {
  return window.btoa(
    unescape(
      encodeURIComponent(str)
    )
  );
}

Base64.decode = function(str) {
  return decodeURIComponent(
    escape(
      window.atob(str)
    )
  );
}

// =====================================================================

if (window !== window.parent) {
  console.log('Exit inside an iframe');
  location = 'about:blank';
  exit();
}

// =====================================================================

;(function parseUrlToken(search) {
  window.sourceInfo = {};
  if (search.startsWith('?')) {
    let splitted = Base64.decode(search.slice(1)).split('&');
    let careAbout = ['originalUrl', 'source', 'repo', 'file', 'user', 
                     'avatar_url', 'authenticity_token', 'timestamp', 
                     'timestamp_secret', 'branch', 'provider'];
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

// =====================================================================

$().ready(async function() {

window.processbar = new Processbar();
window.catalogue  = new Catalogue();

;(function setPlaceholder() {
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
          // console.log(`setPlaceholder: matched [${matched[0]}]`);
          let raw = replaced;
          let matched_full = matched[0];
          let name = matched_full.slice(matched_full.indexOf('{') + 1, matched_full.lastIndexOf('}'));
          replaced = replaced.replace(placeholderPattern, window.sourceInfo[name]);
          // console.log(`${raw} -> ${replaced}`);
        }
      }
      attribute.value = replaced;
    }
  });
  $('.js-set-text').each(function() {
    // console.log('processing', this);
    let nodes = Array(...this.childNodes);
    // console.log('all:', [...nodes]);
    while (nodes.length) {
      let node = nodes.shift();
      if (node.tagName == undefined) {
        // console.log('processing non-element node', node);
        let raw = node.data;
        let placeholderPattern = /\${.*?}/;
        let replaced = raw;
        // console.log('seeking in ' + raw);
        while(true) {
          let matched = placeholderPattern.exec(replaced);
          if (matched == null) {
            break;
          } else {
            // console.log(`setPlaceholder: matched [${matched[0]}]`);
            let _raw = replaced;
            let matched_full = matched[0];
            let name = matched_full.slice(matched_full.indexOf('{') + 1, matched_full.lastIndexOf('}'));
            replaced = replaced.replace(placeholderPattern, window.sourceInfo[name]);
            // console.log(`${_raw} -> ${replaced}`);
          }
        }
        node.data = replaced;
      } else if (!node.classList.contains('js-keep-text')) {
        nodes.concat(Array(node.childNodes));
      }
    }
  });
})();

;(function setHeaderPlaceholder() {
  let height = getComputedStyle($('header')[0]).height;
  $('.header-placeholder')[0].style.height = height;
  window.previousHeaderHeight = height;
  $(window).on('resize', function() {
    if (getComputedStyle($('header')[0]).height != window.previousHeaderHeight) {
      let height = getComputedStyle($('header')[0]).height;
      $('.header-placeholder')[0].style.height = height;
      window.previousHeaderHeight = height;
    }
  })
})();

loadPageContent();

;(async function handleCatalogueAnimation() {
  // screen width threshold: 1376px;
  catalogue.shink();
  $('.catalogue-title-wrapper').on('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (catalogue.rootNode.hasClass('expanded')) {
      if (catalogue.rootNode.hasClass('opened')) {
        catalogue.fold();
      } else {
        catalogue.unfold();
      }
    }
  });
  $('aside.left').on('mouseenter', function(e) {
    if (!catalogue.rootNode.attr('open')) {
      catalogue.rootNode.stop(true, false);
    }
    if (!catalogue.rootNode.hasClass('opened') && !catalogue.rootNode.hasClass('expanded')) {
      catalogue.expand();
    }
  });
  $('aside.left').on('mouseleave', function(e) {
    if (!catalogue.rootNode.attr('open')) {
      catalogue.stop(true, false);
    }
    if (!catalogue.rootNode.hasClass('opened') && catalogue.rootNode.hasClass('expanded')) {
      catalogue.shink();
    }
  });
  $('.catalogue-content').on('click', 'summary a', function(e) {
    // console.log($(this).text());
    location = $(this).attr('href');
    return false;
  });
  $(window).on('hashchange', function(e) {
    // console.log('hash changed');
    let frame = $('.page-frame')[0];
    let jumpTarget = location.hash.slice(1);
    if (jumpTarget != '') {
      let targetNode = null;
      try {
        targetNode = frame.contentDocument.querySelector(`#${jumpTarget}`);
        if (targetNode) {
          $('html').animate({
            scrollTop: targetNode.offsetTop - 0.2 * $(window).height()
          }, {
            duration: 200
          });
          return false;
        }
      } catch(e) {
        if (e.name == 'SyntaxError') {
          ;
        } else {
          throw e;
        }
      }
      targetNode = frame.contentDocument.querySelector(`[data-title-id="${jumpTarget}"]`);
      if (targetNode) {
        $('html').animate({
          scrollTop: targetNode.offsetTop - 0.2 * $(window).height()
        }, {
          duration: 200
        });
        return false;
      }
    }
  })
})();

;(async function handleBackToTop() {
  let topButton = $('.se-toolbar .top-button');
  $(window).on('scroll', function(e) {
    let scrollTop = document.documentElement.scrollTop;
    if (scrollTop > 0.5 * $(window).height()) {
      if (topButton.hasClass('invalid')) {
        topButton.removeClass('invalid');
      }
    } else {
      if (!topButton.hasClass('invalid')) {
        topButton.addClass('invalid');
      }
    }
  });
  topButton.on('click', function(e) {
    $('html').animate({
      scrollTop: 0
    }, {
      duration: 200
    });
    topButton.addClass('invalid');
  });
})();

;(async function handleAbout() {
  let aboutButton = $('.se-toolbar .link-about');
  aboutButton.on('click', function() {
    history.pushState({
      pageData: '<!DOCTYPE html>' + $('.page-frame')[0].contentDocument.documentElement.outerHTML
    }, 'previousPage');
    loadPageContent('about.html');
  });
})();

;(async function handleNavigation() {
  $(window).on('popstate', function() {
    if (history.state) {
      let pageData = history.state.pageData;
      if (pageData) {
        window.sourceInfo.pageSource = pageData;
        loadPageContent('', true);
      }
    }
  });
  $('.header-button.back-button').on('click', function() {
    history.back();
  });
})();

})

window.defaultStyles = {};
defaultStyles.noany_light = dedentText(`
* {
  scrollbar-width: none;
}
*::-webkit-scrollbar {
  display: none;
}
html {
  margin: 0px;
  padding: 0px;
  width: 100%;
  /* min-height: 100vh; */
  background: #ffffff;
  color: #373737;
  font-family: "Source Han Sans SC", "Sarasa Gothic SC", -apple-system, BlinkMacSystemFont, 
               PingFang SC, "Apple Color Emoji", Helvetica, Tahoma, Arial, "Hiragino Sans GB", 
               "Microsoft YaHei", "\\5FAE\\8F6F\\96C5\\9ED1", sans-serif;
}
body {
  margin: 0px;
  padding: 50px 75px;
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
}
table {
  border-collapse: collapse;
}
td {
  border-collapse: collapse;
  border: 1px solid #484848;
  padding: 8px;
}
th {
  border-collapse: collapse;
  border: 1px solid #484848;
  padding: 8px;
}
a, 
a:visited {
  color: #256cde;
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 0.15em;
  text-underline-offset: 0.15em;
}
blockquote {
  margin: 0px 0px 5px 0px;
  padding: 5px 20px 5px 20px;
  background:#f0f0f0;
  border: none;
  border-left: 10px solid #c0c0c0;
  color: #888888;
}
blockquote p {
  margin: 0px;
}
h1, h2, h3, h4, h5, h6 {
  color: #484848;
}
h1 {
  padding-bottom: 0.33em;
  margin-bottom: 0.34em;
  border-bottom: 1px solid #c8c8c8;
}
h1 a, h2 a, h3 a, h4 a, h5 a, h6 a, 
h1 a:visited, h2 a:visited, h3 a:visited, h4 a:visited, h5 a:visited, h6 a:visited {
  color: inherit;
  text-decoration: none;
}
h1 a:hover, h2 a:hover, h3 a:hover, h4 a:hover, h5 a:hover, h6 a:hover {
  border-bottom: 2px solid #595959;
}
img {
  max-width: calc(100% - 20px);
  max-height: 55vh;
}
img, svg, video {
  margin: 0.5em 0em;
}
img::before {
  color: #888888;
}
ol, ul {
  padding-left: 1em;
}
li {
  margin-bottom: 0.5em;
  padding-left: 10px;
}
hr {
  background: #c8c8c8;
  border: none;
  height: 1px;
}
pre, 
code {
  font-family: Consolas, Monaco, Lucida Console, Liberation Mono, DejaVu Sans Mono, 
               Bitstream Vera Sans Mono, Courier New, monospace
}
code {
  color: #103c49;
  font-size: 0.9em;
  background: #e8e8e8;
  border-radius: 3px;
  border: none;
  padding: 2px 6px 3px 6px;
  height: auto;
  line-height: 1.22em;
  white-space: pre-wrap;
  position: relative;
  bottom: 0.012em;
  display: inline-block;
  margin: calc(0.6em - 5px) 0 0 0;
}
pre {
  position: relative;
  background: #e8e8e8;
  padding: 5px 5px 5px 0px;
  left: -6px;
  overflow-x: scroll;
  border-left: 25px solid #e8e8e8;
  border-right: 10px solid #e8e8e8;
  outline: 2px solid #c0c0c0;
}
pre code {
  white-space: pre;
  font-size: 0.9em;
  background: transparent;
  border: none;
  padding: 0px;
  position: static;
  margin: 0;
}
pre code, 
pre code * {
  line-height: 1.5em;
}`);
defaultStyles.forced = dedentText(`
* {
  scrollbar-width: none;
}
*::-webkit-scrollbar {
  display: none;
}
`);
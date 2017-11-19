(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.cep = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// the whatwg-fetch polyfill installs the fetch() function
// on the global object (window or self)
//
// Return that as the export for use in Webpack, Browserify etc.
require('whatwg-fetch');
module.exports = self.fetch.bind(self);

},{"whatwg-fetch":2}],2:[function(require,module,exports){
(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ]

    var isDataView = function(obj) {
      return obj && DataView.prototype.isPrototypeOf(obj)
    }

    var isArrayBufferView = ArrayBuffer.isView || function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    }
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        this.append(header[0], header[1])
      }, this)
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var oldValue = this.map[name]
    this.map[name] = oldValue ? oldValue+','+value : value
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    name = normalizeName(name)
    return this.has(name) ? this.map[name] : null
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value)
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this)
      }
    }
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsArrayBuffer(blob)
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsText(blob)
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf)
    var chars = new Array(view.length)

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i])
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength)
      view.set(new Uint8Array(buf))
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (!body) {
        this._bodyText = ''
      } else if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer)
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer])
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body)
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      }
    }

    this.text = function() {
      var rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body && input._bodyInit != null) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = String(input)
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this, { body: this._bodyInit })
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers()
    rawHeaders.split(/\r?\n/).forEach(function(line) {
      var parts = line.split(':')
      var key = parts.shift().trim()
      if (key) {
        var value = parts.join(':').trim()
        headers.append(key, value)
      }
    })
    return headers
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = 'status' in options ? options.status : 200
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = 'statusText' in options ? options.statusText : 'OK'
    this.headers = new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init)
      var xhr = new XMLHttpRequest()

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        }
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);

},{}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = function (cepRawValue) {
  return _promiseAny2.default.resolve(cepRawValue).then(validateInputType).then(removeSpecialCharacters).then(validateInputLength).then(leftPadWithZeros).then(fetchCepFromServices).catch(handleServicesError).catch(throwApplicationError);
};

var _correios = require('./services/correios.js');

var _correios2 = _interopRequireDefault(_correios);

var _viacep = require('./services/viacep.js');

var _viacep2 = _interopRequireDefault(_viacep);

var _cepaberto = require('./services/cepaberto.js');

var _cepaberto2 = _interopRequireDefault(_cepaberto);

var _cepPromise = require('./errors/cep-promise.js');

var _cepPromise2 = _interopRequireDefault(_cepPromise);

var _promiseAny = require('./utils/promise-any.js');

var _promiseAny2 = _interopRequireDefault(_promiseAny);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var CEP_SIZE = 8;

function validateInputType(cepRawValue) {
  var cepTypeOf = typeof cepRawValue === 'undefined' ? 'undefined' : _typeof(cepRawValue);

  if (cepTypeOf === 'number' || cepTypeOf === 'string') {
    return cepRawValue;
  }

  throw new _cepPromise2.default({
    message: 'Erro ao inicializar a instância do CepPromise.',
    type: 'validation_error',
    errors: [{
      message: 'Você deve chamar o construtor utilizando uma String ou um Number.',
      service: 'cep_validation'
    }]
  });
}

function removeSpecialCharacters(cepRawValue) {
  return cepRawValue.toString().replace(/\D+/g, '');
}

function leftPadWithZeros(cepCleanValue) {
  return '0'.repeat(CEP_SIZE - cepCleanValue.length) + cepCleanValue;
}

function validateInputLength(cepWithLeftPad) {
  if (cepWithLeftPad.length <= CEP_SIZE) {
    return cepWithLeftPad;
  }

  throw new _cepPromise2.default({
    message: 'CEP deve conter exatamente ' + CEP_SIZE + ' caracteres.',
    type: 'validation_error',
    errors: [{
      message: 'CEP informado possui mais do que ' + CEP_SIZE + ' caracteres.',
      service: 'cep_validation'
    }]
  });
}

function fetchCepFromServices(cepWithLeftPad) {
  return _promiseAny2.default.any([(0, _correios2.default)(cepWithLeftPad), (0, _viacep2.default)(cepWithLeftPad), (0, _cepaberto2.default)(cepWithLeftPad)]);
}

function handleServicesError(aggregatedErrors) {
  if (aggregatedErrors.length !== undefined) {
    throw new _cepPromise2.default({
      message: 'Todos os serviços de CEP retornaram erro.',
      type: 'service_error',
      errors: aggregatedErrors
    });
  }
  throw aggregatedErrors;
}

function throwApplicationError(_ref) {
  var message = _ref.message,
      type = _ref.type,
      errors = _ref.errors;

  throw new _cepPromise2.default({ message: message, type: type, errors: errors });
}
module.exports = exports['default'];

},{"./errors/cep-promise.js":4,"./services/cepaberto.js":6,"./services/correios.js":7,"./services/viacep.js":8,"./utils/promise-any.js":9}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
function CepPromiseError() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      message = _ref.message,
      type = _ref.type,
      errors = _ref.errors;

  this.name = 'CepPromiseError';
  this.message = message;
  this.type = type;
  this.errors = errors;
}

CepPromiseError.prototype = new Error();

exports.default = CepPromiseError;
module.exports = exports['default'];

},{}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
function ServiceError() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      message = _ref.message,
      service = _ref.service;

  this.name = 'ServiceError';
  this.message = message;
  this.service = service;
}

ServiceError.prototype = new Error();

exports.default = ServiceError;
module.exports = exports['default'];

},{}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _service = require('../errors/service.js');

var _service2 = _interopRequireDefault(_service);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * This is a mock service to be used when Browserify
 * renders the distribution file. Correios service
 * doesn't support CORS, so there's no reason to
 * include the original file with it's (heavy)
 * dependencies like "xml2js"
 */

function fetchViaCepService(cepWithLeftPad) {
  return new Promise(function (resolve, reject) {
    var serviceError = new _service2.default({
      message: 'O serviço dos Cep aberto não aceita requests via Browser (CORS).',
      service: 'cepaberto'
    });

    reject(serviceError);
  });
}

exports.default = fetchViaCepService;
module.exports = exports['default'];

},{"../errors/service.js":5}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _service = require('../errors/service.js');

var _service2 = _interopRequireDefault(_service);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * This is a mock service to be used when Browserify
 * renders the distribution file. Correios service
 * doesn't support CORS, so there's no reason to
 * include the original file with it's (heavy)
 * dependencies like "xml2js"
 */

function fetchCorreiosService(cepWithLeftPad) {

  return new Promise(function (resolve, reject) {
    var serviceError = new _service2.default({
      message: 'O serviço dos Correios não aceita requests via Browser (CORS).',
      service: 'correios'
    });

    reject(serviceError);
  });
}

exports.default = fetchCorreiosService;
module.exports = exports['default'];

},{"../errors/service.js":5}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = fetchViaCepService;

var _isomorphicFetch = require('isomorphic-fetch');

var _isomorphicFetch2 = _interopRequireDefault(_isomorphicFetch);

var _service = require('../errors/service.js');

var _service2 = _interopRequireDefault(_service);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function fetchViaCepService(cepWithLeftPad) {
  var url = 'https://viacep.com.br/ws/' + cepWithLeftPad + '/json/';
  var options = {
    method: 'GET',
    mode: 'cors',
    headers: {
      'content-type': 'application/json;charset=utf-8'
    }
  };

  return (0, _isomorphicFetch2.default)(url, options).then(analyzeAndParseResponse).then(checkForViaCepError).then(extractCepValuesFromResponse).catch(throwApplicationError);
}

function analyzeAndParseResponse(response) {
  if (response.ok) {
    return response.json();
  }

  throw Error('Erro ao se conectar com o serviço ViaCEP.');
}

function checkForViaCepError(responseObject) {
  if (responseObject.erro === true) {
    throw new Error('CEP não encontrado na base do ViaCEP.');
  }

  return responseObject;
}

function extractCepValuesFromResponse(responseObject) {
  return {
    cep: responseObject.cep.replace('-', ''),
    state: responseObject.uf,
    city: responseObject.localidade,
    neighborhood: responseObject.bairro,
    street: responseObject.logradouro
  };
}

function throwApplicationError(error) {
  var serviceError = new _service2.default({
    message: error.message,
    service: 'viacep'
  });

  if (error.name === 'FetchError') {
    serviceError.message = 'Erro ao se conectar com o serviço ViaCEP.';
  }

  throw serviceError;
}
module.exports = exports['default'];

},{"../errors/service.js":5,"isomorphic-fetch":1}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var reverse = function reverse(promise) {
  return new Promise(function (resolve, reject) {
    return Promise.resolve(promise).then(reject, resolve);
  });
};

Promise.any = function (iterable) {
  return reverse(Promise.all([].concat(_toConsumableArray(iterable)).map(reverse)));
};

exports.default = Promise;
module.exports = exports['default'];

},{}]},{},[3])(3)
});
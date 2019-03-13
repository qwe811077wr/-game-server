const fs = require('fs');
const path = require('path');

const realTimeReload = false;
// 热更路径
const HOT_REQUIRE_PRE_PATH = path.resolve(__dirname, '..');
// 表格路径
const TABLE_PATH = path.resolve(__dirname, '../data/');
// 定义不需要更新的模块
const ignoreModule = new Set([
    // 'entity',
    // 'component'
    'mongodb',
]);
// 忽略的属性
const ignoreProp = new Set([
    'domain',
    '_events',
    '_maxListeners'
]);

/**
 * The cache for storing hot module
 * @name {Object} hotModuleCache
 */
let hotModuleCache = {};

/**
 * Thanks to:
 * https://github.com/sindresorhus/callsites/blob/master/index.js
 * 
 * Parse module path
 * @param {String} filePath 
 * @param {String} 
 */
function parseFileFullPath( filePath ) {
  const _ = Error.prepareStackTrace;
	Error.prepareStackTrace = (_, stack) => stack;
	const stack = new Error().stack.slice(1);
	Error.prepareStackTrace = _;
  const currentFilePath = stack[1].getFileName();
	return require.resolve(path.dirname(currentFilePath) + '/' + filePath);
}


/**
 * Thanks to:
 * https://github.com/rayosu/hot-require/blob/master/hot-require.js
 * 
 * Clone Module deeply to proxy cache
 * @param {Object|Function} target 
 * @param {Object|Function} source 
 */
function cloneModule(target, source) {
    for (let propKey in source) {
        if (ignoreProp.has(propKey))
            continue;
        let propEntity = source[propKey];
        if ( typeof propEntity === 'function' ) {
            // 函数直接指向新地址
            target[propKey] = source[propKey];
            // target[propKey] = function() {
            //     return function() {
            //         return source[propKey].apply(this, arguments);
            //     }
            // }(propKey);
        } else {
            Object.defineProperty(target, propKey, {
                enumerable: true,
                configurable: true,
                get: function(propKey) {
                    return function() {
                        return source[propKey];
                    }
                }(propKey),
                set: function(propKey) {
                    return function(value) {
                        source[propKey] = value;
                    }
                }(propKey)
            })
        }
    }

    if ( target.prototype && source.prototype ) {
      cloneModule(target.prototype, source.prototype);
    }
}


/**
 * @name {Function} clean the require cache by moduleId
 * @param {String} moduleId 
 */
function cleanModule(moduleId) {
  let module = require.cache[moduleId];
  if (!module) {
      console.error('reload clean module no moduleId:' + moduleId);
      return;
  }
  if (module.parent) {
      module.parent.children.splice(module.parent.children.indexOf(module), 1);
  }
  require.cache[moduleId] = null;
}


function checkAndUpdate(moduleId) {
    // 目前只更新类函数(包括表格)
    var moduleCache = hotModuleCache[moduleId];
    if ( typeof moduleCache === 'function' || moduleId.startsWith(TABLE_PATH) ) {
        cleanModule(moduleId);

        try {
            var moduleEntity = require(moduleId);
        } catch (err) {
            console.log(err);
        }
        cloneModule(moduleCache, moduleEntity);
        console.log('update js: ' + moduleId);
    }
}


/**
 * @name {Function} _require
 */
const _require = function( modulePath ) {
    // 只热更app目录下的相关逻辑代码
    if (!modulePath.startsWith('.'))
        return require(modulePath);
    let moduleId = parseFileFullPath(modulePath);
    if (ignoreModule.has(path.basename(modulePath)))
        return require(moduleId);
    if (!moduleId.startsWith(HOT_REQUIRE_PRE_PATH))
        return require(moduleId);

    if ( hotModuleCache[moduleId] ) {
        return hotModuleCache[moduleId];
    }

    try {
        var moduleEntity = require(moduleId);
    } catch ( err ) {
        console.log(err);
    }

    // if ( typeof moduleEntity === 'function' ) {
    //     moduleCache = function() {
    //         let moduleObj = new moduleEntity(...arguments);
    //         cloneModule(this, moduleObj);
    //     };
    // }
    //
    // cloneModule(moduleCache, moduleEntity);
    var moduleCache = moduleEntity;

    if (realTimeReload)
        fs.watchFile(moduleId, () => {
            checkAndUpdate(moduleId);
        })

    hotModuleCache[moduleId] = moduleCache;

    return moduleCache;
}

// 主动热更
var _reload = function () {
    for (var moduleId in hotModuleCache) {
        checkAndUpdate(moduleId);
    }
}

/**
 * init global prop
 */
global._require = _require;

module.exports = _reload;
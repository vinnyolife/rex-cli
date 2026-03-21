/**
 * 反检测 stealth 脚本
 *
 * 通过 Playwright 的 addInitScript（底层使用 CDP Page.addScriptToEvaluateOnNewDocument）
 * 在页面 JS 执行前注入，修改浏览器指纹特征。
 *
 * 核心原理：
 * 1. assistantMode: true 已让 navigator.webdriver 从一开始就为 false，这里做纵深防御。
 * 2. plugins 检测 instanceof PluginArray —— 用 Object.create(PluginArray.prototype) 确保原型链正确。
 * 3. WebGL Vendor/Renderer —— 覆盖 HTMLCanvasElement.prototype.getParameter 返回真实值。
 * 4. languages/navigator.language —— 覆盖返回 zh-CN。
 * 5. chrome.* APIs —— 注入 fake chrome runtime 对象。
 * 6. CDP globals —— 清理 cdc_* 和 __pw_* 等自动化特征量。
 */

export const STEALTH_SCRIPT = `
// ========== 1. webdriver 纵深防御 ==========
// assistantMode: true 已让 Chrome 不再设置 webdriver，这里覆盖任何意外情况
Object.defineProperty(navigator, 'webdriver', {
  get: function() { return false; },
  configurable: true,
  enumerable: true
});

// ========== 2. PluginArray 原型链修复 ==========
(function() {
  function FakePlugin(name, description, filename, version) {
    this.name = name || '';
    this.description = description || '';
    this.filename = filename || '';
    this.version = version || '';
  }
  FakePlugin.prototype.item = function(i) { return this[i] || null; };
  FakePlugin.prototype.namedItem = function(n) { return null; };
  FakePlugin.prototype.refresh = function() {};
  Object.defineProperty(FakePlugin.prototype, Symbol.toStringTag, { value: 'Plugin' });

  var plugins = Object.create(PluginArray.prototype);
  plugins[0] = new FakePlugin('Chrome PDF Plugin', 'Portable Document Format', 'internal-pdf-viewer', '');
  plugins[1] = new FakePlugin('Chrome PDF Viewer', '', 'mhjfbmdgcfjbbpaeojofohoefgiehjai', '');
  plugins[2] = new FakePlugin('Native Client', '', 'internal-nacl-plugin', '');
  plugins[3] = new FakePlugin('Widevine Content Decryption Module', 'Enables Widevine CDM for DRM', 'widevinecdm', '1.4.8.1005');
  plugins.length = 4;
  Object.defineProperty(plugins, 'length', {
    value: 4,
    writable: false,
    enumerable: false,
    configurable: false
  });
  Object.defineProperty(plugins, Symbol.toStringTag, { value: 'PluginArray' });

  Object.defineProperty(navigator, 'plugins', {
    get: function() { return plugins; },
    configurable: true,
    enumerable: true
  });
})();

// ========== 3. languages ==========
Object.defineProperty(navigator, 'languages', {
  get: function() { return ['zh-CN', 'zh', 'en-US', 'en']; },
  configurable: true,
  enumerable: true
});
Object.defineProperty(navigator, 'language', {
  get: function() { return 'zh-CN'; },
  configurable: true,
  enumerable: true
});

// ========== 4. chrome.* APIs ==========
(function() {
  if (window.chrome && window.chrome.runtime) return;
  Object.defineProperty(window, 'chrome', {
    value: {
      runtime: {
        connect: function() {},
        sendMessage: function() {},
        id: ''
      },
      app: { isInstalled: false },
      webstore: { onInstallStageChanged: {}, onDownloadProgress: {} },
      csi: function() {},
      loadTimes: function() {}
    },
    writable: false,
    configurable: true
  });
})();

// ========== 5. permissions.query mock ==========
(function() {
  var origQuery = navigator.permissions && navigator.permissions.query;
  if (!origQuery) return;
  Object.defineProperty(navigator.permissions, 'query', {
    value: function(params) {
      if (!params || !params.name) return origQuery.call(navigator.permissions, params);
      if (params.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission === 'granted' ? 'granted' : 'prompt' });
      }
      if (params.name === 'geolocation') {
        return Promise.resolve({ state: 'prompt' });
      }
      if (params.name === 'midi') {
        return Promise.resolve({ state: 'prompt' });
      }
      return origQuery.call(navigator.permissions, params);
    },
    writable: false,
    configurable: true
  });
})();

// ========== 6. WebGL spoofing ==========
(function() {
  var origGetParameter = HTMLCanvasElement.prototype.getParameter;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getParameter', {
    value: function(p) {
      // 37445 = UNMASKED_VENDOR_WEBGL
      if (p === 37445) return 'Google Inc. (Apple)';
      // 37446 = UNMASKED_RENDERER_WEBGL
      if (p === 37446) return 'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)';
      return origGetParameter.call(this, p);
    },
    writable: true,
    configurable: true
  });
})();

// ========== 7. CDP automation globals 清理 ==========
(function() {
  var KNOWN_GLOBALS = ['cdc_adoQpoasnfa76pfcZLmcfl_Array','cdc_adoQpoasnfa76pfcZLmcfl_Promise','cdc_adoQpoasnfa76pfcZLmcfl_Symbol'];
  for (var i = 0; i < KNOWN_GLOBALS.length; i++) {
    try { delete window[KNOWN_GLOBALS[i]]; } catch(e) {}
  }
  // 清理所有 cdc_ 和 __pw_ 前缀的变量
  for (var key in window) {
    try {
      if (key.indexOf('cdc_') === 0 || key.indexOf('__pw_') === 0 || key.indexOf('puaf') === 0) {
        window[key] = undefined;
      }
    } catch(e) {}
  }
})();
`;

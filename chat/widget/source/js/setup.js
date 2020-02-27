(function () {
  var env = window.__env || {};
  var bot = env.bot;
  var serverUrl = 'https://sposgva-dev.taiger.io/iconverse-admin';
  var chatBaseUrl = env.chatBaseUrl;

  /**
   * @param {object} config
   * @param {string} config.bot
   * @param {string} config.serverUrl
   * @param {string} config.chatBaseUrl
   */
  function Utils (config) {
    this.bot = config.bot;
    this.serverUrl = 'https://sposgva-dev.taiger.io/iconverse-bot-server/bots/ac884001-9226-41ca-b0c1-9ad796897a96';
    this.chatBaseUrl = config.chatBaseUrl;
  }

  Utils.prototype.isMobile = function () {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  };

  Utils.prototype.getBaseWidgetCssUrl = function () {
    if (this.chatBaseUrl) {
      return this.chatBaseUrl + '/chat/widget/css/chat-widget.css';
    }
    return this.serverUrl + '/base/widget/css/chat-widget.css';
  };

  Utils.prototype.getCustomWidgetCssUrl = function (time) {
    return this.serverUrl + '/bots/' + this.bot + '/widget-css' + (time ? '?' + time : '');
  };

  Utils.prototype.getChatAppUrl = function (time) {
    var baseUrl = this.serverUrl + '/base';

    if (this.chatBaseUrl) {
      baseUrl = this.chatBaseUrl + '/chat';
    }

    return (
      baseUrl
      + '/chat-app/index.html?botId='
      + this.bot
      + '&server='
      + this.serverUrl
      + '/'
      + (time ? '&t=' + time : '')
    );
  };

  Utils.prototype.getConverseAppUrl = function () {
    var supportedProtocols = ['http:', 'https:'];
    var pathArray = serverUrl.split('/');
    var protocol = pathArray[0];


    var protocolExists = supportedProtocols.indexOf(protocol) > -1;
    if (protocolExists) {
      var host = pathArray[2];
      return protocol + '//' + host + '/iconverse-converse';
    }
    return pathArray[0] + '/iconverse-converse';
  };

  Utils.prototype.getBotConfigUrl = function (botId, lastModifiedMillis) {
    return (
      serverUrl
      + '/bots/'
      + botId
      + '/bot-configuration'
      + (lastModifiedMillis ? '?' + lastModifiedMillis : '')
    );
  };

  var utils = new Utils(env);

  function APIService (config) {
    this.bot = config.bot;
    this.serverUrl = config.serverUrl;
    this.chatBaseUrl = config.chatBaseUrl;
    this.converseServerUrl = utils.getConverseAppUrl();
  }

  APIService.prototype.recordImpression = function () {
    var data = JSON.stringify({ bot: this.bot });
    var url = this.converseServerUrl + '/recordImpression';
    var request = new XMLHttpRequest();

    request.open('POST', url, true);
    request.withCredentials = true;
    request.setRequestHeader('Content-type', 'application/json; charset=utf-8');
    request.onload = function () {
      if (request.status !== 200) {
        throw new Error('Could not record impression');
      }
    };
    request.send(data);
  };

  APIService.prototype.recordActivation = function () {
    var request = new XMLHttpRequest();
    var url = this.converseServerUrl + '/recordActivation';

    request.open('POST', url, true);
    request.withCredentials = true;
    request.onload = function () {
      if (request.status !== 200) {
        throw new Error('Could not record activation');
      }
    };
    request.send();
  };

  APIService.prototype.getLastModifiedTimestamp = function (callback) {
    if (typeof callback === 'undefined') {
      throw new Error('callback argument must be provided');
    }

    var request = new XMLHttpRequest();
    var url = 'https://sposgva-dev.taiger.io/iconverse-bot-server' + '/bots/' + this.bot + '/last-modified-date?' + Date.now();

    request.open('GET', url, true);
    request.onload = function () {
      if (request.status >= 400) {
        throw new Error('Could not get last modified timestamp');
      }

      var data = JSON.parse(this.response);
      if (!data.lastModifiedDate) {
        throw new Error('Cant fetch last modified date');
      }

      return callback(data.lastModifiedDate);
    };
    request.send();
  };

  APIService.prototype.getBotConfig = function (timestamp, callback) {
    var request = new XMLHttpRequest();
    var url = utils.getBotConfigUrl(this.bot, timestamp);

    request.open('GET', url, true);
    request.onload = function () {
      if (request.status !== 200) {
        throw new Error('Could not record activation');
      }

      var data = null;
      try {
        data = JSON.parse(this.response);
      }
      catch (err) {
        data = {};
      }

      return callback(data);
    };
    request.send();
  };


  var apiService = new APIService(env);

  /**
   * @param {object} config
   * @param {string} config.bot
   * @param {string} config.serverUrl
   * @param {string} config.chatBaseUrl
   * @param {string} config.timestamp
   */
  function ChatWidget (config) {
    this.constants = {
      iframeHolderId: 'iconverse-chat-holder',
      iframeCssId: 'iconverse-chat-iframe',
      btnCssId: 'iconverse-chat-btn'
    };

    this.config = config;
    this.isOpening = false;
    this.isOpenedOnce = false;
    this.isFeedbackShowing = false;
    this.triggerOpenTimeoutID = null;

    /** @property {HTMLDivElement | null} */
    this.$iframeHolder = null;
    /** @property {HTMLIframeElement | null} */
    this.$iframe = null;
    /** @property {HTMLButtonElement | null} */
    this.$chatButton = null;
  }

  ChatWidget.prototype.init = function (callback) {
    this.loadAssets(function () {
      this.setupElements(callback);
    }.bind(this));
  };

  ChatWidget.prototype.loadAssets = function (onLoaded) {
    // Load base widget css
    var baseWidgetCssUrl = utils.getBaseWidgetCssUrl();

    // Load custom widget css
    var customWidgetCssUrl = utils.getCustomWidgetCssUrl(this.config.timestamp);
    this.loadCss(customWidgetCssUrl, function (cssLink) {
      this.loadCssBefore(baseWidgetCssUrl, cssLink, function () {
        if (typeof onLoaded === 'function') {
          onLoaded();
        }
      });
    }.bind(this));
  };

  ChatWidget.prototype.loadCss = function (href, callback) {
    var cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.type = 'text/css';
    cssLink.href = href;

    cssLink.onload = function () {
      // Check if the chat widget has already been setup by checking for the chat btn element
      // If setup has already been run, prevent it from running again
      if (callback && !this.isChatWidgetLoaded()) {
        callback(cssLink);
      }
    }.bind(this);

    cssLink.onerror = function () {
      // Check if the chat widget has already been setup by checking for the chat btn element
      // If setup has already been run, prevent it from running again
      if (callback && !this.isChatWidgetLoaded()) {
        callback(cssLink);
      }
    }.bind(this);

    document.head.appendChild(cssLink);
  };

  ChatWidget.prototype.loadCssBefore = function (href, refElement, callback) {
    var cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.type = 'text/css';
    cssLink.href = href;

    cssLink.onload = function () {
      // Check if the chat widget has already been setup by checking for the chat btn element
      // If setup has already been run, prevent it from running again
      if (callback && !this.isChatWidgetLoaded()) {
        callback(cssLink);
      }
    }.bind(this);

    cssLink.onerror = function () {
      // Check if the chat widget has already been setup by checking for the chat btn element
      // If setup has already been run, prevent it from running again
      if (callback && !this.isChatWidgetLoaded()) {
        callback(cssLink);
      }
    }.bind(this);

    document.head.insertBefore(cssLink, refElement);
  };

  ChatWidget.prototype.setupElements = function (callback) {
    var self = this;
    this.$iframeHolder = this.buildIframeHolder();
    this.$iframe = this.buildIframe(function () {
      self.$chatButton = self.buildChatButton();
      document.body.appendChild(self.$chatButton);

      if (typeof callback === 'function') {
        callback();
      }
    });

    this.$iframeHolder.appendChild(this.$iframe);
    document.body.appendChild(this.$iframeHolder);
  };

  ChatWidget.prototype.buildIframeHolder = function () {
    var existingIframeHodler = this.getIframeHolder();
    if (existingIframeHodler) return existingIframeHodler;

    var iframeHolder = document.createElement('div');
    iframeHolder.id = this.constants.iframeHolderId;
    iframeHolder.style.display = 'none'; // should be hidden by default
    iframeHolder.style.transition = 'box-shadow 1s ease';

    // detect if is mobile, and set appropriate class
    if (utils.isMobile()) {
      iframeHolder.classList.add('mobile-sizing');
    }
    return iframeHolder;
  };

  ChatWidget.prototype.getIframeHolder = function () {
    return document.getElementById(this.constants.iframeHolderId);
  };

  ChatWidget.prototype.buildIframe = function (onLoaded) {
    var existingIframe = this.getIframe();
    if (existingIframe) return existingIframe;

    var chatAppUrl = utils.getChatAppUrl();
    var iframe = document.createElement('iframe');
    iframe.id = this.constants.iframeCssId;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('class', 'invisible');
    iframe.setAttribute('src', chatAppUrl);

    iframe.addEventListener('load', function () {
      if (typeof onLoaded === 'function') {
        onLoaded();
      }
    });

    return iframe;
  };

  ChatWidget.prototype.getIframe = function () {
    return document.getElementById(this.constants.iframeCssId);
  };

  ChatWidget.prototype.hideChatBox = function () {
    this.isOpening = false;
    this.isFeedbackShowing = false;
    this.toggleChatBoxVisibility();
    this.toggleChatButtonClasses();
    this.$iframe.setAttribute('class', 'invisible');
    this.$iframe.contentWindow.postMessage('CLOSE_EVENT', '*');
  };

  ChatWidget.prototype.showChatBox = function () {
    var self = this;
    self.toggleChatBoxVisibility();
    self.toggleChatButtonClasses();

    if (!this.isOpenedOnce) {
      // add the shadow after 3s (assumes that iframe loads properly within this time)
      setTimeout(function () {
        var propertyValue = 'rgba(0, 0, 0, 0.1) 5px 4px 20px, rgba(0, 0, 0, 0.1) -5px -4px 20px';
        self.$iframeHolder.style.boxShadow = propertyValue;
      }, 3000);
    }

    if (this.isOpening && !this.isOpenedOnce) {
      this.isOpenedOnce = true;
      apiService.recordActivation();
    }

    this.$iframe.setAttribute('class', 'visible');
    this.$iframe.contentWindow.postMessage('OPEN_EVENT', '*');
  };

  ChatWidget.prototype.handleCloseTrigger = function () {
    this.$iframe.contentWindow.postMessage('ATTEMPT_TO_CLOSE_CHAT', '*');
  };

  ChatWidget.prototype.buildChatButton = function () {
    var self = this;
    var existingChatButton = this.getChatButton();
    if (existingChatButton) return existingChatButton;

    var $btn = document.createElement('button');
    $btn.id = this.constants.btnCssId;

    apiService.recordImpression();

    // toggle the iframe when click on button
    $btn.addEventListener('click', function () {
      if (self.triggerOpenInMs != null) {
        clearTimeout(self.triggerOpenTimeoutID);
      }

      if (!self.isOpening && !self.isFeedbackShowing) {
        self.toggleOpenChat();
        self.showChatBox();
      }
      else {
        self.toggleOpenChat();
        self.handleCloseTrigger();
      }
    });

    return $btn;
  };

  ChatWidget.prototype.getChatButton = function () {
    return document.getElementById(this.constants.btnCssId);
  };

  ChatWidget.prototype.toggleOpenChat = function () {
    this.isOpening = !this.isOpening;
  };

  ChatWidget.prototype.toggleChatBoxVisibility = function () {
    var setDisplay = this.isOpening ? 'block' : 'none';
    this.$iframeHolder.style.display = setDisplay;
  };

  ChatWidget.prototype.toggleChatButtonClasses = function () {
    // Toggle class of chat button
    if (this.isOpening && utils.isMobile()) {
      this.$chatButton.classList.add('activated', 'mobile');
    }
    else if (this.isOpening && !utils.isMobile()) {
      this.$chatButton.classList.add('activated');
      this.$chatButton.classList.remove('mobile');
    }
    else {
      this.$chatButton.classList.remove('activated', 'mobile');
    }
  };

  ChatWidget.prototype.isChatWidgetLoaded = function () {
    return Boolean(document.getElementById(this.constants.btnCssId));
  };

  ChatWidget.prototype.triggerOpenInMs = function (ms) {
    var self = this;
    this.triggerOpenTimeoutID = setTimeout(function () {
      self.$chatButton.click();
    }, ms);
  };

  function bootstrap () {
    apiService.getLastModifiedTimestamp(function (timestamp) {
      if (!timestamp) {
        throw new Error('Cannot get the timestamp');
      }

      var chatWidget = new ChatWidget({
        bot: bot,
        serverUrl: serverUrl,
        chatBaseUrl: chatBaseUrl,
        timestamp: timestamp
      });

      apiService.getBotConfig(timestamp, function (data) {
        var isTriggerChatUiInMsPresent = (
          data.triggerChatUiInMs
          && typeof data.triggerChatUiInMs === 'number'
        );

        chatWidget.init(function () {
          if (isTriggerChatUiInMsPresent) {
            chatWidget.triggerOpenInMs(data.triggerChatUiInMs);
          }
        });
      });

      // handle chat session end - close the chat iframe
      window.addEventListener('message', function (e) {
        if (e.data.type === 'iconverse-end') {
          chatWidget.hideChatBox();
        }

        if (e.data.type === 'feedback-showing') {
          chatWidget.isFeedbackShowing = true;
        }
      });
    });
  }

  // bootstrap the chat widget
  bootstrap();
}());

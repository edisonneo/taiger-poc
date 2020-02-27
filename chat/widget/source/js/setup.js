(function () {
  var env = window.__env || {};
  var bot = env.bot;
  var serverUrl = env.serverUrl;
  var chatBaseUrl = env.chatBaseUrl;

  /**
   * @param {object} config
   * @param {string} config.bot
   * @param {string} config.serverUrl
   * @param {string} config.chatBaseUrl
   */
  function Utils (config) {
    this.bot = config.bot;
    this.serverUrl = config.serverUrl;
    this.chatBaseUrl = config.chatBaseUrl;
  }

  Utils.prototype.isMobile = function () {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  };

  Utils.prototype.getChatAssetUrl = function () {
    return env.chatWidgetAssetsUrl
      ? env.chatWidgetAssetsUrl
      : env.chatBaseUrl + 'chat/widget';
  };

  Utils.prototype.getBaseWidgetCssUrl = function () {
    if (this.chatBaseUrl) {
      return this.chatBaseUrl + '/chat/widget/css/chat-widget.css';
    }
    return this.serverUrl + '/base/widget/css/chat-widget.css';
  };

  Utils.prototype.getChatAppUrl = function (time) {
    return env.chatAppUrl ? env.chatAppUrl : env.chatBaseUrl + 'chat/chat-app';
  };

  var utils = new Utils(env);

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

    /** @property {HTMLDivElement | null} */
    this.$iframeHolder = null;
    /** @property {HTMLIframeElement | null} */
    this.$iframe = null;
    /** @property {HTMLButtonElement | null} */
    this.$chatButton = null;
  }

  ChatWidget.prototype.init = function () {
    this.loadAssets(function () {
      this.setupElements();
    }.bind(this));
  };

  ChatWidget.prototype.loadAssets = function (onLoaded) {
    // Load base widget css
    var chatAssetUrl = utils.getChatAssetUrl() + '/css/chat-widget.css';

    // Load custom widget css
    this.loadCss(chatAssetUrl, function (cssLink) {
      onLoaded();
    });
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

  ChatWidget.prototype.setupElements = function () {
    var self = this;
    this.$iframeHolder = this.buildIframeHolder();
    this.$iframe = this.buildIframe(function () {
      self.$chatButton = self.buildChatButton();
      document.body.appendChild(self.$chatButton);
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

    // toggle the iframe when click on button
    $btn.addEventListener('click', function () {
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

  function bootstrap () {
    var chatWidget = new ChatWidget({
      bot: bot,
      serverUrl: serverUrl,
      chatBaseUrl: chatBaseUrl
    });

    chatWidget.init();

    // handle chat session end - close the chat iframe
    window.addEventListener('message', function (e) {
      if (e.data.type === 'iconverse-end') {
        chatWidget.hideChatBox();
      }

      if (e.data.type === 'feedback-showing') {
        chatWidget.isFeedbackShowing = true;
      }
    });
  }

  // bootstrap the chat widget
  bootstrap();
}());

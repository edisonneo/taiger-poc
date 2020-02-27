(function () {
  'use strict';

  // helper fn to merge objects
  var merge = function (defaultObj, overideObj) {
    var result = {};
    for (var key in defaultObj) result[key] = defaultObj[key];
    for (var key in overideObj) {
      if (angular.isDefined(overideObj[key]) && overideObj[key] !== '') {
        result[key] = overideObj[key];
      }
    }
    return result;
  };

  /**
   * APPLICATION DEFAULTS
   */
  var config = {
    envConfig: {
      // Example: http://localhost:8080/iconverse-converse
      chatEndpoint: 'https://example.com',

      merge: function (overideObj) {
        config.envConfig = merge(config.envConfig, overideObj);
      },

      get: function () {
        return config.envConfig;
      }
    },
    appOptions: {
      botId: '',
      firstMessageTypingDelayMs: 400,
      typingDelayMs: 200,
      appName: '',
      inputPlaceholder: 'Type here to start chatting...',
      idleDelayTimeMins: 3,
      isChatBubbleAvatarVisible: true,
      isFeedbackModalTriggeredOnClose: true,
      isFeedbackButtonVisible: true,
      idleMessageTitle: 'You have been away for awhile...',
      idleMessageBody: 'Would you like to continue the session?',
      isShowConversationEmailButton: false,
      conversationEmailTermsText:
        'I agree to receive the conversation history at the specified email address',
      messageLinkDisplayTypes: ['button-list', 'side-attachment'],
      bubbleEntryTransition: 'fade-up', // slide-right, fade-up
      isAutocompleteOn: true,
      autocompleteQueryMinLength: 2,
      botAvatarImageUrl: '', // specified by external context (chatapp's index.html)

      // feedback config
      feedbackMessage: '👋 Did this help?',
      afterFeedbackMessage: '🙏 Thanks for your feedback',

      // livechat config
      // Setup license key in app.config.json so that livechat feature is make available
      livechatLicense: undefined,
      livechatHasPostChatSurvey: true,
      isShowLiveChatButton: false,

      // Voice Recognition Service config
      isVoiceRecognitionAvailable: false,
      voiceRecognitionEndpoint: 'https://example.com',
      voiceRecognitionwebSocket: 'wss://example.com',

      // Language selector config
      isShowLangSelect: false,
      languages: [{ label: 'English', shortLabel: 'EN', iso: 'en' }],

      // Landing page config
      isLandingPage: false,
      customLandingPageHtml: '',

      // Chat Detail Options
      isDetailImgRounded: true,
      isSingleTitleLarge: true,
      isStickyActionBtn: false,

      merge: function (overideObj) {
        config.appOptions = merge(config.appOptions, overideObj);
      },

      get: function () {
        return config.appOptions;
      }
    }
  };

  angular
    .module('iconverse')
    .constant('EnvConfig', config.envConfig)
    .constant('AppOptions', config.appOptions);
}());

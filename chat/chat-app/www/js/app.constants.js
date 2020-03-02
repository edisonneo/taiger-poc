(function () {
  'use strict';

  /**
   * APPLICATION DEFAULTS
   */
  var config = {
    envConfig: {
      chatEndpoint: 'https://wogmva-demo.taiger.io/iconverse-converse'
    },
    appOptions: {
      botId: "1a08883f-4ec8-439a-8a1b-57c662da2856",
      firstMessageTypingDelayMs: 400,
      typingDelayMs: 200,
      appName: 'Converse',
      feedbackAppName: false, // Alternative name for the chatbot in the feeback panel (String/false)
      inputPlaceholder: 'Type here to start chatting...',
      idleDelayTimeMins: 3,
      isChatBubbleAvatarVisible: true,
      headerStyle: 'default', // 'default', 'header1'
      isFeedbackModalTriggeredOnClose: true,
      isFeedbackForced: false,
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
      isStickyActionBtn: false
    }
  };

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

  // merge the config, if it is found on the window context
  var envConfig = window.__envConfig
    ? merge(config.envConfig, window.__envConfig)
    : config.envConfig;

  var appOptions = window.__appOptions
    ? merge(config.appOptions, window.__appOptions)
    : config.appOptions;

  angular
    .module('iconverse')
    .constant('EnvConfig', envConfig)
    .constant('AppOptions', appOptions);
}());

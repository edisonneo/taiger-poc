(function () {
  'use strict';

  angular.module('starter').factory('LivechatService', LivechatService);

  LivechatService.$inject = ['$window', '$rootScope'];

  function LivechatService ($window, $rootScope) {
    var license = null;
    var visitor = { name: '', email: '' };

    // Setup callback function and broadcast event to $rootScope
    var setupLivechatCallback = function () {
      $window.LC_API.on_chat_ended = function () {
        $rootScope.$broadcast('livechat:onChatEnded');
      };
      $window.LC_API.on_postchat_survey_submitted = function () {
        $rootScope.$broadcast('livechat:onPostchatSurveySubmitted');
      };
      $window.LC_API.on_chat_window_minimized = function () {
        $rootScope.$broadcast('livechat:onChatWindowMinimized');
      };
    };

    var chatLoaded = function () {
      if ($window.LC_API) {
        $window.LC_API.on_after_load = function () {
          $rootScope.$broadcast('livechat:onAfterLoad');
          setupLivechatCallback();
        };
      }
    };

    var chatNotLoaded = function () {
      throw Error('Livechat not loaded');
    };

    var loadLiveChatApi = function () {
      if (!$window.LC_API) {
        $window.__lc = $window.__lc || {};
        $window.__lc.license = license;
        $window.__lc.visitor = visitor;
        var lc = document.createElement('script');
        lc.type = 'text/javascript';
        lc.async = true;
        lc.src = (document.location.protocol === 'https:' ? 'https://' : 'http://')
          + 'cdn.livechatinc.com/tracking.js';
        var s = document.getElementsByTagName('script')[0];
        s.parentNode.insertBefore(lc, s);
        lc.addEventListener('load', chatLoaded);
        lc.addEventListener('error', chatNotLoaded);
      }
    };

    return {
      loadLivechat: function (livechatLicense) {
        license = livechatLicense;
        loadLiveChatApi();
      },

      // Open livechat window
      openChatWindow: function () {
        $window.LC_API.open_chat_window();
      },

      // hide livechat window
      hideChatWindow: function () {
        $window.LC_API.minimize_chat_window();
      },

      // set up custom params
      // this method is the same with set custom variable, except this is set before loading the livechat window
      setParams: function (newParams) {
        $window.__lc = $window.__lc || {};
        $window.__lc.params = newParams;
      },

      isLivechatLoaded: function () {
        // Check is LC_API from livechat is available
        return !!$window.LC_API;
      },

      // Check is the livechat window maximized
      isChatWindowMaximized: function () {
        return $window.LC_API.chat_window_maximized();
      },

      // set custom variables
      // this will update the custom variables setup by setParams method
      setCustomVariables: function (variables) {
        $window.LC_API.set_custom_variables(variables);
      }
    };
  }
}());

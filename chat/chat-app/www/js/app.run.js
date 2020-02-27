(function () {
  'use strict';

  angular
    .module('starter')

    .run(function (IdleService, $rootScope) {
      // listen for events triggered from parent window and control behavior of chat-app
      window.addEventListener('message', function (e) {
        // handle iframe closing
        if (e.data === 'CLOSE_EVENT') {
          // stop idle tracking when the chat-app closes, so the idle popup isn't triggered
          // while the chat-app is closed
          IdleService.stopTracking();
        }
      });

      // TODO: Refactor the following vanilla js code
      var Util = {
        fetchObjectAtUrl: function (url, callbackFn) {
          var request = new XMLHttpRequest();
          request.open('GET', url, true);
          request.onload = function () {
            if (request.status === 200) {
              var data = {};
              try {
                data = JSON.parse(this.response);
              }
              catch (e) {
                // invalid json object
              }
              callbackFn(data);
            }
            else {
              console.error('could not fetch data');
              callbackFn();
            }
          };
          request.send();
        },
        loadCss: function (url, callbackFn) {
          var cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.type = 'text/css';
          cssLink.href = url;

          cssLink.onload = function () {
            if (callbackFn) {
              callbackFn(cssLink);
            }
          };

          cssLink.onerror = function () {
            if (callbackFn) {
              callbackFn(cssLink);
            }
          };

          document.head.appendChild(cssLink);
        },
        loadCssBefore: function (url, refElement, callbackFn) {
          var cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.type = 'text/css';
          cssLink.href = url;

          cssLink.onload = function () {
            if (callbackFn) {
              callbackFn(cssLink);
            }
          };

          cssLink.onerror = function () {
            if (callbackFn) {
              callbackFn(cssLink);
            }
          };

          document.head.insertBefore(cssLink, refElement);
        },
        insertInternalCss: function (cssString) {
          var internalCssStyle = document.createElement('style');
          internalCssStyle.innerHTML = cssString;

          document.head.appendChild(internalCssStyle);
        },
        queryStringToObject: function (queryStr) {
          // queryStr expects: "a=1&b=3&c=m2-m3-m4-m5"
          var vars = queryStr.split('&');
          var queryObject = {};
          for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split('=');
            var key = decodeURIComponent(pair[0]);
            var value = decodeURIComponent(pair[1]);
            // If first entry with this name
            if (typeof queryObject[key] === 'undefined') {
              queryObject[key] = decodeURIComponent(value);
              // If second entry with this name
            }
            else if (typeof queryObject[key] === 'string') {
              var arr = [queryObject[key], decodeURIComponent(value)];
              queryObject[key] = arr;
              // If third or later entry with this name
            }
            else {
              queryObject[key].push(decodeURIComponent(value));
            }
          }
          return queryObject;
        },
        getValueFromQueryString: function (queryStr, key) {
          if (key && queryStr && queryStr.length && queryStr[0] === '?') {
            var queryObj = this.queryStringToObject(queryStr.substring(1));
            if (queryObj[key]) {
              return queryObj[key];
            }
            console.log('Could not extract ' + key + ' from queryString');
          }
          console.log('Invalid query');
          return '';
        },
        isCustomBotAvatarImageUrl: function (customBotAvatarImageUrl, callbackFn) {
          // check if custom avatar exists, and set it if so. else, set the default avatar
          var http = new XMLHttpRequest();
          http.open('HEAD', customBotAvatarImageUrl, true);
          http.onload = function (e) {
            // if the image does not exist, a 404 is returned
            if (http.status === 200) {
              // avatar exists - do nothing
              callbackFn(true);
            }
            else {
              callbackFn(false);
            }
          };
          http.onerror = function (e) {
            callbackFn(false);
          };
          http.send();
        },
        sanitizeHTML: function(str) {
          var temp = document.createElement('div');
          temp.textContent = str;
          return temp.innerHTML;
        },
        isValidUuid: function (uuid) {
          return /^[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}$/i.test(uuid);
        },
        isValidTimestamp: function (timestamp) {
          try {
            return !isNaN(timestamp);
          }
          catch (error) {
            return false;
          }
        }
      };

      // get params from url
      var botId = Util.sanitizeHTML(Util.getValueFromQueryString(window.location.search, 'botId'));
      var lastModifiedMillis = Util.sanitizeHTML(Util.getValueFromQueryString(window.location.search, 't'));
      var serverUrl = Util.sanitizeHTML(Util.getValueFromQueryString(window.location.search, 'server'));

      if (!botId || !serverUrl) {
        console.error(
          'Either botId or serverUrl was not found on url! ChatApp will not load properly'
        );
        return;
      }
      if (!Util.isValidUuid(botId)) {
        console.error(
          'botId not valid!'
        );
        return;
      }
      if (!Util.isValidTimestamp(lastModifiedMillis)) {
        console.error(
          'last modified date not valid!'
        );
        return;
      }

      var botBaseCssUrl = 'styles/app.css';
      var botCustomCssUrl = serverUrl
        + 'bots/'
        + botId
        + '/bot-css'
        + (lastModifiedMillis ? '?' + lastModifiedMillis : '');

      // Load bot custom css
      Util.loadCss(botCustomCssUrl, function (cssLink) {
        console.log('bot custom css loaded');

        // Load bot base css
        // (note: will throw 404 in development mode)
        // base css need to load after custom css so that it does not appearing to user, yet need to insert before custom css
        Util.loadCssBefore(botBaseCssUrl, cssLink, function () {
          console.log('bot base css loaded');

          // Load bot config
          var botConfigUrl = serverUrl
            + 'bots/'
            + botId
            + '/bot-configuration'
            + (lastModifiedMillis ? '?' + lastModifiedMillis : '');
          Util.fetchObjectAtUrl(botConfigUrl, function (appConfig) {
            console.log('bot config loaded: ', appConfig);

            if (appConfig.customLandingPageCss) {
              Util.insertInternalCss(appConfig.customLandingPageCss);
            }

            var customBotAvatarImageUrl = serverUrl + 'bots/' + botId + '/avatar';
            Util.isCustomBotAvatarImageUrl(customBotAvatarImageUrl, function (isValid) {
              appConfig.botId = botId;
              appConfig.botAvatarImageUrl = isValid ? customBotAvatarImageUrl : 'img/avatar-default.png';
              console.log('botAvatarImageUrl: ', appConfig.botAvatarImageUrl);

              window.__appOptions = appConfig;

              // Load bot name
              var botNameUrl = serverUrl
                + 'bots/'
                + botId
                + '/bot-name'
                + (lastModifiedMillis ? '?' + lastModifiedMillis : '');
              Util.fetchObjectAtUrl(botNameUrl, function (data) {
                console.log('bot name loaded: ', data.botName);
                window.__appOptions.appName = data.botName;
                // Load converse url
                var getConverseUrl = serverUrl
                  + 'bots/'
                  + botId
                  + '/converseUrl'
                  + (lastModifiedMillis ? '?' + lastModifiedMillis : '');
                Util.fetchObjectAtUrl(getConverseUrl, function (data) {
                  console.log('converse url loaded: ', data.converseUrl);
                  window.__envConfig.chatEndpoint = data.converseUrl;
                  $rootScope.$broadcast('app:loaded');
                });
              });
            });
          });
        });
      });
    });
}());

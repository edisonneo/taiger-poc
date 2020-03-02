(function () {
  'use strict';

  angular.module('iconverse').factory('IconverseService', IconverseService);

  IconverseService.$inject = ['$http', 'EnvConfig', 'AppOptions'];

  function IconverseService ($http, EnvConfig, AppOptions) {
    var MOCK_API = {
      startSession: 'mocks/session_start',
      sendMessage: 'mocks/iconverse_api.json'
    };

    var server = "https://wogmva-demo.taiger.io/iconverse-converse";
    var botId = AppOptions.botId;

    var API = {
      conversationsSession: server + '/conversations/session/' + botId,
      startSession: server + '/startSession',
      sendMessage: server + '/message',
      saveSurvey: server + '/saveSurvey',
      rateAnswer: server + '/rateAnswer',
      uploadFile: server + '/uploadFile',
      autocompleteSuggestions: server + '/api/suggestions',
      getIntentPredictions: server + '/getIntentPredictions',
      suggestUnansweredPhraseIntent: server + '/unansweredPhrases/suggest',
      botConfig: server + '/optionalFeatures',
      downloadChatLog: server + '/downloadConversation?cid='
    };

    return {
      /**
       * PUBLIC CONSTANTS
       * For setting up RATE_MESSAGE (message that gets sent to backend when user rates negatively/positively)
       */
      RATE_MESSAGE: {
        TOPIC: 'general',
        NEGATIVE_SUBTOPIC: 'negativerate',
        POSITIVE_SUBTOPIC: 'positiveRate',
        NEGATIVE_TEXT: 'Wrong Answer',
        POSITIVE_TEXT: 'Right Answer',
        INVALID_TEXT: "I don't understand"
      },

      FALLBACK_TYPE: {
        INTENTSEARCH: 'INTENTSEARCH',
        WHATABOUT: 'WHATABOUT',
        CROSSKB: 'CROSSKB',
        NONE: 'NONE',
        AFTERFEEDBACK: 'AFTERFEEDBACK'
      },

      getConversationsSession: function () {
        var timestamp = Date.now();
        return $http({
          url: API.conversationsSession,
          method: 'GET',

          // Set to true, to check conversation session using cookies
          withCredentials: true,
          cache: false,
          params: {
            timestamp: timestamp
          }
        }).then(function (response) {
          return response.data.data;
        });
      },

      startSession: function () {
        return $http({
          url: API.startSession,
          method: 'POST',
          withCredentials: true,

          // as the server responds a non-json text string,
          // we need to specify `transformResponse` to bypass angular's
          // response handling (which assumes response is in JSON)
          transformResponse: [
            function (data) {
              return data;
            }
          ]
        });
      },

      customSendMessage: function (payload) {
        return $http({
          url: API.customSendMessage,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          data: payload
        }).then(function (response) {
          console.log('custom send')
          return response.data;
        });
      },

      sendMessage: function (message) {
        console.log('sending', message);
        return $http({
          url: API.sendMessage,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          data: message
        }).then(function (response) {
          // TODO: some post processing here to transform the received message
          // GOAL - decouple controller&template from the iconverse server response
          // return response.data[2];

          return response.data;
        });
      },

      saveSurvey: function (cid, satisfactionNum, feedbackStr) {
        return $http.post(API.saveSurvey, {
          cid: cid,
          satisfaction: satisfactionNum,
          feedback: feedbackStr
        });
      },

      rateAnswer: function (cid, isPositive) {
        return $http.post(API.rateAnswer, { cid: cid, correct: isPositive });
      },

      downloadChatLog: function (cid) {
        return $http({
          url: API.downloadChatLog + cid,
          responseType: 'blob',
          method: 'GET'
        }).then(function (response) {
          return response.data;
        });
      },

      uploadFile: function (formData) {
        return $http({
          url: API.uploadFile,
          method: 'POST',
          headers: {
            'Content-Type': undefined
          },
          data: formData
        });
      },

      getIntentPredictions: function (query, cid) {
        return $http.get(API.getIntentPredictions, {
          params: {
            text: query,
            cid: cid
          }
        });
      },

      getAutocompleteSuggestions: function (message) {
        return $http.post(API.autocompleteSuggestions, message).then(function (response) {
          return response.data;
        });
      },

      triggerSendConversationToEmail: function (cid, emailAddress) {
        return $http.post(server + '/conversations/' + cid + '/sendConversationLogToEmail', {
          email: emailAddress
        });
      },

      getChannelType: function () {
        var isMobile = false;
        // Detect if mobile or desktop
        (function (a) {
          if (
            /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
              a
            )
            || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
              a.substr(0, 4)
            )
          ) isMobile = true;
        }(navigator.userAgent || navigator.vendor || window.opera));

        // Return the correct delivery channel
        if (isMobile) {
          return 'mobile-web';
        }
        return 'desktop-web';
      },

      suggestUnansweredPhraseIntent: function (bot, cid, suggestedIntent) {
        var body = {
          bot: bot,
          cid: cid,
          suggestedIntent: suggestedIntent
        };
        return $http.post(API.suggestUnansweredPhraseIntent, body).then(function (response) {
          return response.data;
        });
      },

      getBotConfig: function () {
        return $http.get(API.botConfig);
      }
    };
  }
}());

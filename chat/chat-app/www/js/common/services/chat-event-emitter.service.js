(function () {
  'use strict';

  angular.module('starter').factory('ChatEventEmitterService', ChatEventEmitterService);

  ChatEventEmitterService.$inject = [];

  function ChatEventEmitterService () {
    var formatEmitData = function (msg) {
      var obj = {
        type: 'iconverse-event',
        cid: msg.cid,
        text: msg.text,
        source: msg.source,
        timestamp: msg.timestamp ? msg.timestamp : new Date().getTime()
      };

      if (msg.state) obj.state = msg.state;
      if (msg.choices) obj.choices = msg.choices;

      return obj;
    };

    var _parentWindow = window.parent;

    return {
      // informs the context to toggle close the chat iframe
      sendCloseChatEvent: function () {
        _parentWindow.postMessage(
          {
            type: 'iconverse-end',
            timestamp: new Date().getTime()
          },
          '*'
        );
      },

      onMessageSent: function (userMsg) {
        var msg = formatEmitData(userMsg);
        // console.log('onMessageSent', msg);
        msg.eventType = 'USER_MESSAGE_SENT';
        _parentWindow.postMessage(msg, '*');
      },

      onMessageReceived: function (msgFromServer) {
        var msg = formatEmitData(msgFromServer);
        // console.log('onMessageReceived', msg);
        msg.eventType = 'SYSTEM_MESSAGE_RECEIVED';
        _parentWindow.postMessage(msg, '*');
      },

      onConversationStarted: function (conversationId) {
        var msg = {
          type: 'iconverse-event',
          cid: conversationId,
          timestamp: new Date().getTime()
        };
        msg.eventType = 'CONVERSATION_STARTED';
        // console.log('conversationId', msg);
        _parentWindow.postMessage(msg, '*');
      },

      onChoiceSelected: function (userMsg, choiceValue) {
        var msg = formatEmitData(userMsg);
        msg.choice = choiceValue;
        msg.eventType = 'CHOICE_SELECTED';
        // console.log('onMessageSent', msg);
        _parentWindow.postMessage(msg, '*');
      }

      // onSurveySubmitted: function() {

      // },

      // onAnswerRated: function(){

      // }
    };
  }
}());

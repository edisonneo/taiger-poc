(function () {
  'use strict';

  angular
    .module('starter')

    .run(function (IdleService) {
      // listen for events triggered from parent window and control behavior of chat-app
      window.addEventListener('message', function (e) {
        // handle iframe closing
        if (e.data === 'CLOSE_EVENT') {
          // stop idle tracking when the chat-app closes, so the idle popup isn't triggered
          // while the chat-app is closed
          IdleService.stopTracking();
        }
      });
    });
}());

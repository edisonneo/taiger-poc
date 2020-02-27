(function () {
  'use strict';

  angular.module('iconverse').directive('scrollOnNewMessage', scrollOnNewMessage);

  scrollOnNewMessage.$inject = ['$rootScope', '$timeout', 'UtilityService'];

  function scrollOnNewMessage ($rootScope, $timeout, UtilityService) {
    return {
      restrict: 'A',
      link: function (scope, $elm) {
        // scrollChatToBottom is broadcast from chat.controller and chat.service
        $rootScope.$on('scrollChatToBottom', function (_, config) {
          if (config !== undefined && !angular.isObject(config)) {
            throw new Error('You should pass object type');
          }

          var scrollConfig = config || {};
          if (scrollConfig.duration === undefined) scrollConfig.duration = 500;
          if (scrollConfig.restoreConversation === undefined) {
            scrollConfig.restoreConversation = false;
          }

          // If the user agent is IE 10 or IE 11
          // Then set timeout duration to 600ms for restoring conversation
          // This is needed because the scrollTop won't be set
          // If timeout is too small (only IE)
          var scrollDuration = scrollConfig.duration;
          var timeoutDuration = 0;
          if (scrollConfig.restoreConversation) {
            timeoutDuration = UtilityService.isIE() ? 600 : 0;
          }

          var to = $elm[0].scrollHeight;

          // If chat message is from server
          // then scroll to the top of the last message
          var messageEls = document.getElementsByClassName('chat-bubble-root--user');
          if (scrollConfig.serverTrigger && messageEls.length) {
            var secondLastMessage = messageEls[messageEls.length - 1];

            if (secondLastMessage) {
              var lastMessageOffsetTop = secondLastMessage.offsetTop;
              to = lastMessageOffsetTop;
            }
          }

          $timeout(function () {
            // Pass in the element and its scrollHeight
            scrollTo($elm[0], to, scrollDuration);
          }, timeoutDuration);
        });

        function scrollTo (element, to, duration) {
          var start = element.scrollTop;
          var change = to - start;
          var currentTime = 0;
          var increment = 20;

          if (duration === 0) {
            element.scrollTop = change;
            return;
          }

          var animateScroll = function () {
            currentTime += increment;
            var val = Math.easeInOutQuad(currentTime, start, change, duration);

            element.scrollTop = val;
            if (currentTime < duration) {
              $timeout(animateScroll, increment);
            }
          };
          animateScroll();
        }
        // t = current time
        // b = start value
        // c = change in value
        // d = duration
        Math.easeInOutQuad = function (t, b, c, d) {
          t /= d / 2;
          if (t < 1) return (c / 2) * t * t + b;
          t--;
          return (-c / 2) * (t * (t - 2) - 1) + b;
        };
      }
    };
  }
}());

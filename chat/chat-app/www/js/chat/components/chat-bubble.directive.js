(function () {
  'use strict';

  angular.module('iconverse').directive('chatBubble', chatBubble);

  chatBubble.$inject = ['ChatService', 'IconverseService', '$rootScope', '$state'];

  function chatBubble (ChatService, IconverseService, $rootScope, $state) {
    return {
      scope: {
        message: '=',
        avatarImageUrl: '<',
        onClickLink: '&', // passes out the clicked link
        onClickAttachment: '&', // passes out the clicked message
        onClickChoice: '&', // passes out the clicked message
        onClickRestart: '&',
        onDropdownSelect: '&', // passes out the selected option in dropdown to the message
        linkLimit: '=?', // integer. specify the limit of links shown before the list is truncated
        onShowMore: '&', // triggered when show more is clicked
        onShowLess: '&', // triggered when show less is clicked
        isAvatarVisible: '=',
        isCurrentActiveBubble: '=',
        linksDisplayTypes: '=', // ['button-list', 'side-attachment']
        entryTransition: '=' // the type of transition the chat bubble enters with ['fade-up', 'slide-right']
      },
      templateUrl: 'js/chat/components/chat-bubble.directive.html',
      link: function (scope) {
        scope.FALLBACK_TYPE = IconverseService.FALLBACK_TYPE;

        scope.defaultLinkLimit = 4; // 4 is default max
        // Set the link limit to default if there is none specified in the directive
        scope.linksLimitCount = scope.linkLimit || scope.defaultLinkLimit;
        scope.showAllLinks = false; // default

        scope.sourceIsUser = ChatService.isMessageFromUser(scope.message); // currently binary

        scope.hasAttachment = ChatService.isMessageWithAttachment(scope.message) && scope.message.isLast;
        scope.isFallbackSearch = Boolean(
          angular.isObject(scope.message.payload)
          && scope.message.payload.type === 'iSearchResult'
        );

        // determine how to display message with lists/links, by reading the passed in config option
        if (ChatService.isMessageWithList(scope.message)) {
          scope.isHideButtonList = angular.isArray(scope.linksDisplayTypes)
            && !_.includes(scope.linksDisplayTypes, 'button-list');
          scope.isHideAttachmentList = angular.isArray(scope.linksDisplayTypes)
            && !_.includes(scope.linksDisplayTypes, 'side-attachment');
        }

        if (scope.isFallbackSearch) {
          scope.isHideButtonList = true;
          scope.isHideAttachmentList = true;
        }

        scope.toWebFallbackList = function () {
          ChatService.setLatestSelectedMessage(scope.message);
          $state.go('app.chat-web-fallback');
        };

        scope.triggerFn = function (text) {
          if (text) ChatService.processUserMessage(text);
        };

        scope.clickLink = function (link) {
          if (link.action === 'externalurl') {
            var surveyUrl = link.url;
            $ionicViewSwitcher.nextDirection('forward');
            $state.go('app.external-link-iframe', {
              surveyUrl: surveyUrl
            });
          }
          else if (angular.isFunction(scope.onClickLink)) {
            scope.onClickLink({ link: link });
          }
        };

        scope.clickAttachment = function () {
          if (angular.isFunction(scope.onClickAttachment)) {
            console.log('sending', scope.message);
            scope.onClickAttachment({ msg: scope.message });
          }
        };

        scope.clickChoice = function (choice) {
          if (angular.isFunction(scope.onClickChoice)) {
            scope.onClickChoice({ choice: choice, msg: scope.message });
          }
        };

        scope.clickRestart = function () {
          scope.onClickRestart();
        };

        scope.toggleShowAll = function () {
          scope.showAllLinks = !scope.showAllLinks;

          if (scope.showAllLinks && angular.isFunction(scope.onShowMore)) {
            // Remove the limit of links displayed
            scope.linksLimitCount = false;
            // Trigger function declared in the directive parameters
            scope.onShowMore();
          }
          else if (!scope.showAllLinks && angular.isFunction(scope.onShowLess)) {
            // Set the limit of links displayed
            scope.linksLimitCount = scope.linkLimit || scope.defaultLinkLimit;
            // Trigger function declared in the directive parameters
            scope.onShowLess();
          }
        };

        scope.selectDropdownOption = function (option) {
          scope.onDropdownSelect({ option: option });
        };

        scope.triggerLiveChat = function () {
          scope.isLiveChatLoading = true;
          $rootScope.$broadcast('onTriggerLiveChat');
        };

        scope.rateAnswer = function (isPositive) {
          // if the user did not make a change to the current rating, then don't process
          if (
            (scope.currRating === 'wrong' && !isPositive)
            || (scope.currRating === 'correct' && isPositive)
          ) {
            return;
          }

          IconverseService.rateAnswer(scope.message.cid, isPositive)
            .then(function (response) {
              console.log('successfully rated answer');

              // update scope model is the tick or cross gets highlighted on the UI appropriately
              scope.currRating = isPositive ? 'correct' : 'wrong';

              // when users make a rating, we want the VA to respond
              // setup the message to send to server, which triggers a response from the backend
              var text = isPositive
                ? IconverseService.RATE_MESSAGE.POSITIVE_TEXT
                : IconverseService.RATE_MESSAGE.NEGATIVE_TEXT;
              var topic = IconverseService.RATE_MESSAGE.TOPIC;
              var subtopic = isPositive
                ? IconverseService.RATE_MESSAGE.POSITIVE_SUBTOPIC
                : IconverseService.RATE_MESSAGE.NEGATIVE_SUBTOPIC;

              ChatService.processUserMessage(text, null, null, null, true, topic, subtopic);
            })
            .catch(function (err) {
              scope.currRating = isPositive ? 'correct' : 'wrong';
              console.error(err);
            });
        };
      }
    };
  }
}());

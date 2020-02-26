(function () {
  'use strict';

  angular.module('iconverse').factory('FeedbackModalService', FeedbackModalService);

  FeedbackModalService.$inject = [
    '$timeout',
    '$rootScope',
    '$ionicModal',
    'IconverseService',
    'ChatService',
    'FeedbackModalStateService'
  ];

  function FeedbackModalService (
    $timeout,
    $rootScope,
    $ionicModal,
    IconverseService,
    ChatService,
    FeedbackModalStateService
  ) {
    return {
      /**
       * Get the feedback modal object. Returns a promise which returns the modal object once resolved.
       * @param {string} title The title of the modal
       * @param {Object} $scope The $scope of the parent controller
       * @param {string} scopeKey The namespace on the scope object that this function will attach the modal to
       * @param {boolean} isShowExitChatBtn Show the exit chat button
       * @param {boolean} isExitChatAfterFeedbackSubmit Exit the chat after feedback is submitted
       * @param {boolean} isTriggeredByCloseChatButton is triggered by close chat button
       * @returns {Promise} promise
       */
      getModal: function (
        title,
        $scope,
        scopeKey,
        isShowExitChatBtn,
        isExitChatAfterFeedbackSubmit,
        isTriggeredByCloseChatButton
      ) {
        // Namespace the feedback modal to prevent $scope pollution
        $scope[scopeKey] = {};

        // Assign to shadow object on the scope to prevent scopeKey naming irregularities
        $scope._feedbackModal = $scope[scopeKey];

        var vm = $scope[scopeKey];

        // ionicModal loads the modal template asynchronously
        var feedbackTemplatePath = 'js/modals/feedback-modal/feedback-modal.html';
        var feedbackModalOption = { scope: $scope, animation: 'slide-in-up' };
        var promise = $ionicModal
          .fromTemplateUrl(feedbackTemplatePath, feedbackModalOption)
          .then(function (modal) {
            vm.modal = modal;
            return modal;
          });

        // Get current conversation ID
        ChatService.getCurrentConversationId().then(function (cid) {
          vm.cid = cid;
        });

        // Set the title of the modal - appears at the top and center
        vm.title = title;
        vm.showSuccessMsg = false;

        // Collect the feedback star rating and comments in an object
        vm.entry = {};

        // Exit chat button is not shown on default
        vm.isShowExitChatBtn = isShowExitChatBtn;

        // Override default behavior of closing modal by exiting the entire chat widget
        vm.isExitChatAfterFeedbackSubmit = isExitChatAfterFeedbackSubmit;

        vm.openModal = function () {
          vm.modal.show();
        };

        // Reset the feedback when the modal closes
        vm.closeModal = function () {
          if (isTriggeredByCloseChatButton) {
            vm.exitChat();
          }
          else {
            vm.resetFeedbackModal();
            vm.modal.hide();
            FeedbackModalStateService.set({ isFeedbackShowing: false });
          }
        };

        vm.resetFeedbackModal = function () {
          vm.entry = {};
          vm.showSuccessMsg = false;
          vm.showExitChatBtn = false;
        };

        // Close the modal and the exit out of the chat widget
        vm.exitChat = function () {
          vm.resetFeedbackModal();
          vm.modal.remove();
          $rootScope.$broadcast('app:closeChat');
        };

        vm.saveSkipFeedbackPreferenceAndCloseChat = function () {
          ChatService.saveSkipFeedbackPreference();
          vm.exitChat();
        };

        // Submit feedback to the backend
        vm.submitFeedback = function (entry) {
          if (!vm.cid) return vm.exitChat();

          // Proceed if conversation id is present
          return IconverseService.saveSurvey(vm.cid, entry.ratingNum, entry.comments).then(function () {
            // if feedback was submitted,
            // we should not show the feedback panel again for this browser session
            ChatService.saveSkipFeedbackPreference();

            // default behavior is to show success on the button
            // then hide the modal
            vm.showSuccessMsg = true;

            // after some time, reset the form and hide self
            $timeout(function () {
              vm.showSuccessMsg = false;
              vm.isExitChatAfterFeedbackSubmit ? vm.exitChat() : vm.closeModal();
            }, 1000);
          });
        };

        return promise;
      }
    };
  }
}());

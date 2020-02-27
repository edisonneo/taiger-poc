(function () {
  'use strict';

  angular.module('iconverse').controller('ExternalLinkIframeController', ExternalLinkIframeController);

  ExternalLinkIframeController.$inject = [
    '$scope',
    '$state',
    '$stateParams',
    '$ionicViewSwitcher',
    '$ionicPopup',
    'ChatService',
    'ExternalLinkService'
  ];

  function ExternalLinkIframeController (
    $scope,
    $state,
    $stateParams,
    $ionicViewSwitcher,
    $ionicPopup,
    ChatService,
    ExternalLinkService
  ) {
    var vm = this;

    var iframeEl = document.getElementById('survey-iframe');

    vm.surveyUrl = $stateParams.surveyUrl;
    vm.pageCount = $stateParams.pageCount ? Number($stateParams.pageCount) : 1;
    vm.messageId = $stateParams.messageId;

    iframeEl.src = vm.surveyUrl;

    var iframeLoadCount = 0;
    iframeEl.addEventListener('load', function () {
      iframeLoadCount += 1;

      // The last load of iframe would be submit confirmation page
      // Assuming all survey question only have 1 page,
      // then second load event for the iframe would submit confirmation page
      var isSubmitted = iframeLoadCount === vm.pageCount + 1;
      if (isSubmitted) {
        // Wait for 800 m-seconds before going back to chat veiw
        setTimeout(function () {
          // Send message to trigger positive state
          ExternalLinkService.add(vm.messageId, vm.surveyUrl, 'taken');
          ChatService.processUserMessage('thank you', null, null, null, true);
          // Go back to chat view
          $ionicViewSwitcher.nextDirection('back');
          $state.go('app.chat');
        }, 800);
      }
    });

    vm.goToChat = function () {
      // Send message to trigger negative state
      ChatService.processUserMessage('oops', null, null, null, true);
      // Go back to chat view
      $ionicViewSwitcher.nextDirection('back');
      $state.go('app.chat');
    };

    vm.showConfirmExitAlert = function () {
      $scope.confirmAlertPopup = $ionicPopup.confirm({
        title: 'Exit Survey',
        template: '<div class="text-center">Are you sure you  want to exit the survey? Your progress will not be saved.</div>',
        okText: 'Yes',
        cancelText: 'Cancel'
      });

      $scope.confirmAlertPopup.then(function (isConfirm) {
        if (isConfirm) {
          ExternalLinkService.add(vm.messageId, vm.surveyUrl, 'exited');
          vm.goToChat();
        }
        else {
          $scope.confirmAlertPopup = null;
        }
      });
    };
  }
}());

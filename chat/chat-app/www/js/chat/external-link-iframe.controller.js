(function () {
  'use strict';

  angular.module('iconverse').controller('ExternalLinkIframeController', ExternalLinkIframeController);

  ExternalLinkIframeController.$inject = [
    '$state',
    '$stateParams',
    '$ionicViewSwitcher',
    'ChatService'
  ];

  function ExternalLinkIframeController (
    $state,
    $stateParams,
    $ionicViewSwitcher,
    ChatService
  ) {
    var vm = this;

    var iframeEl = document.getElementById('survey-iframe');

    vm.surveyUrl = $stateParams.surveyUrl;
    iframeEl.src = vm.surveyUrl;

    var iframeLoadCount = 0;
    iframeEl.addEventListener('load', function () {
      iframeLoadCount += 1;

      // The last load of iframe would be submit confirmation page
      // Assuming all survey question only have 1 page,
      // then second load event for the iframe would submit confirmation page
      var isSubmitted = iframeLoadCount === 2;
      if (isSubmitted) {
        // Wait for 800 m-seconds before going back to chat veiw
        setTimeout(function () {
          // Send message to trigger positive state
          ChatService.processUserMessage('Submitted', null, null, null, true);
          // Go back to chat view
          $ionicViewSwitcher.nextDirection('back');
          $state.go('app.chat');
        }, 800);
      }
    });

    vm.goToChat = function () {
      // Send message to trigger negative state
      ChatService.processUserMessage('Oops', null, null, null, true);
      // Go back to chat view
      $ionicViewSwitcher.nextDirection('back');
      $state.go('app.chat');
    };
  }
}());

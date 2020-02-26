(function () {
  'use strict';

  angular.module('iconverse').directive('feedbackPanel', feedbackPanel);

  feedbackPanel.$inject = ['IconverseService', '$timeout', 'ChatService'];

  function feedbackPanel (IconverseService, $timeout, ChatService) {
    return {
      scope: {
        chatAppName: '@',
        cid: '=',
        onSubmitted: '&',
        isMobile: '=', // expects boolean
        api: '=' // exposed methods: #show(), #hide(), #toggleVisibility()
      },
      templateUrl: 'js/chat/components/feedback-panel.directive.html',

      link: function (scope) {
        // default config
        scope.state = {
          isShowing: false,
          showSuccessMsg: false
        };

        var resetForm = function () {
          scope.entry = {};
        };
        resetForm(); // init

        scope.submitFeedback = function () {
          var entry = scope.entry;
          console.log(scope.cid);
          IconverseService.saveSurvey(scope.cid, entry.ratingNum, entry.comments).then(function () {
            console.log('successfully submitted feedback!');

            // execute onSubmitted function, if any was passed in
            if (angular.isFunction(scope.onSubmitted)) {
              scope.onSubmitted();
            }

            // default behavior is to show success on the button
            // then hide the directive
            scope.state.showSuccessMsg = true;

            // after some time, reset the form and hide self
            $timeout(function () {
              scope.state.showSuccessMsg = false;
              scope.api.hide();
              resetForm();
            }, 1000);
          });
        };

        // Expose this directive's API
        scope.api = {
          show: function () {
            scope.state.isShowing = true;
          },
          hide: function () {
            scope.state.isShowing = false;
          },
          toggleVisibility: function () {
            scope.state.isShowing = !scope.state.isShowing;
          }
        };
      }
    };
  }
}());

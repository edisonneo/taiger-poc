angular
  .module('iconverse')

  .config(function ($stateProvider, $urlRouterProvider) {
    $stateProvider

      .state('app.chat', {
        url: '/chat',
        params: {
          autoTriggerMessage: null
        },
        views: {
          menuContent: {
            templateUrl: 'js/chat/chat.html',
            controller: 'ChatController',
            controllerAs: 'vm'
          }
        }
      })

      .state('app.chat-detail', {
        url: '/chat-detail',
        views: {
          menuContent: {
            templateUrl: 'js/chat/chat-detail.html',
            controller: 'ChatDetailController',
            controllerAs: 'vm'
          }
        }
      })

      .state('app.chat-option-detail', {
        url: '/chat-option-detail?elementId',
        views: {
          menuContent: {
            templateUrl: 'js/chat/chat-detail.html',
            controller: 'ChatDetailController',
            controllerAs: 'vm'
          }
        }
      })

      .state('app.external-link-iframe', {
        url: '/external-link-iframe?surveyUrl',
        views: {
          menuContent: {
            templateUrl: 'js/chat/external-link-iframe.html',
            controller: 'ExternalLinkIframeController',
            controllerAs: 'vm'
          }
        }
      })

      .state('app.chat-web-fallback', {
        url: '/chat-web-fallback',
        views: {
          menuContent: {
            templateUrl: 'js/chat/chat-web-fallback.html',
            controller: 'ChatWebFallbackController',
            controllerAs: 'vm'
          }
        }
      });
  });

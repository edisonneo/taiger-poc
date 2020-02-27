(function () {
  'use strict';

  angular.module('iconverse').controller('ChatWebFallbackController', ChatWebFallbackController);

  ChatWebFallbackController.$inject = ['ChatService'];

  function ChatWebFallbackController (ChatService) {
    var vm = this;
    vm.message = ChatService.getLatestSelectedMessage();

    vm.getSearchResult = function (message) {
      return _.map(message.payload.elements, function (element) {
        var topPanel = element.properties.topPanel;

        return {
          title: topPanel.title,
          description: topPanel.subtitles[0],
          redirectUrl: topPanel.redirectUrl,
          imageUrl: topPanel.imageUrl
        };
      });
    };

    vm.results = vm.getSearchResult(vm.message);
  }
}());

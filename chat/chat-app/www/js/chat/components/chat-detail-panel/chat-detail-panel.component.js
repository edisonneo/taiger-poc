(function () {
  angular.module('iconverse').component('chatDetailPanel', {
    bindings: {
      panel: '=panelData',
      onClickButtonAction: '&'
    },
    templateUrl: 'js/chat/components/chat-detail-panel/chat-detail-panel.html',
    controller: ChatDetailPanelCtrl
  });

  ChatDetailPanelCtrl.$inject = [];

  function ChatDetailPanelCtrl () {
    var $ctrl = this;

    $ctrl.showMoreDesc = false;
    // Display Show More Button if the text is too long
    var textParagraphContents = _.get($ctrl.panel.contents, '[0]value', false);
    $ctrl.isDisplayShowMore = textParagraphContents && textParagraphContents.length >= 215;

    $ctrl.handleClickButtonAction = function () {
      if (angular.isFunction($ctrl.onClickButtonAction)) {
        $ctrl.onClickButtonAction({ panelClicked: $ctrl.panel });
      }
    };

    // temp fix for empty text panels (should be handled in the backend - backend shouldnt bodypanels with no/invalid content)
    if ($ctrl.panel.type === 'text') {
      var hasTextPanelContents = $ctrl.panel.contents
        && _.find($ctrl.panel.contents, function (content) {
          return angular.isString(content.value) && content.value.trim() !== '';
        });
      $ctrl.isShouldHidePanel = !hasTextPanelContents;
    }
  }
}());

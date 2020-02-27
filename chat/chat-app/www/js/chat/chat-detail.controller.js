(function () {
  'use strict';

  angular.module('iconverse').controller('ChatDetailController', ChatDetailController);

  ChatDetailController.$inject = [
    'ChatService',
    '$scope',
    '$stateParams',
    '$state',
    '$ionicScrollDelegate',
    '$ionicViewSwitcher'
  ];

  function ChatDetailController (
    ChatService,
    $scope,
    $stateParams,
    $state,
    $ionicScrollDelegate,
    $ionicViewSwitcher
  ) {
    var vm = this;

    var placeholderImageUrls = {
      dining: 'img/chat-detail-placeholder-dining.jpg',
      attraction: 'img/chat-detail-placeholder-attraction.jpg'
    };

    vm.hasActionButton = function (panels) {
      return _.find(panels, { type: 'button-action' });
    };

    var DISPLAY_OPTS = {
      // Iterates over keys in `msg.display.elementDisplayableKeys`, and prints the relevant key/value pairs found in element.properties
      PRINT_KEY_VALUES: 'print_key_values',
      // Disable clicks/taps on each list item (usually leads into Single Detail view)
      DISALLOW_CLICKS_ON_LIST_ITEM: 'disallow_clicks_on_list_item',
      DETAIL_PANEL_LAYOUT: 'detail_panel_layout'
    };

    var transformContent = function (element, msg) {
      // determine the image url, falling back to a placeholder, if specified
      var imageUrl = _.get(element, 'properties.topPanel.imageUrl');
      var placeholderType = _.get(element, 'properties.topPanel.imagePlaceholderType');
      element.uiImageUrl = imageUrl || placeholderImageUrls[placeholderType];

      // Display Options - PRINT KEY VALUES
      // parse and build the values to be printed
      if (vm.displayOptions[DISPLAY_OPTS.PRINT_KEY_VALUES]) {
        element.uiPrintValues = _.reduce(
          msg.display.elementDisplayableKeys,
          function (ret, key) {
            var value = element.properties[key];
            if (key.indexOf('Time') !== -1) {
              value = moment(value).format('DD/MM/YYYY hh:mm a');
            }
            ret[key] = value;
            return ret;
          },
          {}
        );
      }

      if (vm.displayOptions[DISPLAY_OPTS.DETAIL_PANEL_LAYOUT]) {
        // determine the image url, falling back to a placeholder, if specified
        imageUrl = _.get(element, 'properties.topPanel.imageUrl');
        placeholderType = _.get(element, 'properties.topPanel.imagePlaceholderType');
        element.properties.topPanel.uiImageUrl = imageUrl || placeholderImageUrls[placeholderType];
      }

      return element;
    };

    var isValidDisplayOption = function (displayOption) {
      return _.values(DISPLAY_OPTS).indexOf(displayOption) !== -1;
    };

    var loadContent = function () {
      var msg = ChatService.getLatestSelectedMessage();

      // parse display options, if any
      vm.displayOptions = {};

      var displayOpts = _.get(msg, 'display.options');
      if (displayOpts && displayOpts.length) {
        // make sure that options are in whitelist
        var verifiedOpts = _.filter(displayOpts, function (opt) {
          return isValidDisplayOption(opt);
        });
        // build an object like: {print_key_values: true, disallow_clicks_on_list_item: true}
        vm.displayOptions = _.reduce(
          verifiedOpts,
          function (ret, optionKey) {
            ret[optionKey] = true;
            return ret;
          },
          {}
        );
      }

      if (angular.isObject(msg)) {
        var data = ChatService.getMessageTypeAndContent(msg);
        vm.type = data.type;
        vm.content = data.content;

        if (vm.type === 'LINKS') {
          vm.title = 'List of intents';
        }
        else if (vm.type === 'DETAILS') {
          vm.title = 'Select an option';

          vm.content = _.map(data.content, function (element) {
            return transformContent(element, msg);
          });

          // Load single view of element if an ID is detected
          if ($stateParams.elementId) {
            vm.type = 'SINGLE-VIEW';

            vm.theEl = _.find(vm.content, function (el) {
              return el.id === $stateParams.elementId;
            });

            if (vm.displayOptions[DISPLAY_OPTS.DETAIL_PANEL_LAYOUT]) {
              vm.type = 'SINGLE-VIEW-PANEL-LAYOUT';
            }

            vm.title = 'Detail';
            // Transform the filtered element for displaying
            vm.theEl = transformContent(vm.theEl, msg);
          }
          else {
            // list of links
            vm.title = '';

            if (vm.displayOptions[DISPLAY_OPTS.DETAIL_PANEL_LAYOUT]) {
              vm.type = 'LIST-VIEW-PANEL-LAYOUT';
              vm.title = 'Select an Option';
            }
          }
        }
      }
    };

    vm.onClickPanel = function (panelClicked) {
      if (panelClicked.action === 'navigate') {
        ChatService.openNavigator(panelClicked.destinationAddress);
      }
      else if (panelClicked.action === 'open-external-link') {
        ChatService.openNavigator(panelClicked.linkUrl);
      }
      else if (panelClicked.action === 'trigger-user-reply') {
        // trigger a message on behalf of the user
        ChatService.processUserMessage(panelClicked.replyText, null, null, null);
        // then route the user to the chat panel
        $state.go('app.chat');
      }
    };

    // reload content everytime this view in entered
    $scope.$on('$ionicView.beforeEnter', function (event, data) {
      // console.log("State Params: ", data.stateParams);
      loadContent(); // initial load
    });

    vm.getRatingString = function (ratingNum) {
      var ratingInt = Math.floor(ratingNum);
      if (ratingInt >= 5) return 'Excellent';
      if (ratingInt >= 4) return 'Great';
      if (ratingInt >= 3) return 'Good';
      if (ratingInt >= 2) return 'Fair';
      if (ratingInt < 2) return 'Poor';
      return 'no rating';
    };

    vm.onClickSlide = function (media, index) {
      vm.lightboxMedias = vm.theEl.properties.topPanel.carouselMedia;
      vm.lightboxMediaSelectedIndex = index;
      vm.showMediaLightbox = true;
    };

    vm.closeMediaLightbox = function () {
      vm.showMediaLightbox = false;
    };

    vm.selectListItem = function (element) {
      if (!vm.displayOptions[DISPLAY_OPTS.DISALLOW_CLICKS_ON_LIST_ITEM]) {
        $ionicViewSwitcher.nextDirection('forward');
        $state.go('app.chat-option-detail', { elementId: element.id });
      }
    };

    vm.selectLinkItem = function (link) {
      // trigger a message on behalf of the user
      ChatService.processUserMessage(
        link.text,
        null,
        link.element,
        link.query,
        null,
        link.topic,
        link.subtopic,
        link.enquiry
      );
      // then route the user to the chat panel
      $state.go('app.chat');
    };

    // open file in document viewer for mobile
    vm.openInAppForMobile = function (url) {
      if (cordova) {
        cordova.InAppBrowser.open(
          url,
          '_blank',
          'location=no,enableViewportScale=yes,closebuttoncaption=Close'
        );
      }
      else {
        console.err('cordova not found');
      }
    };

    vm.getPropertyName = function (object, property) {
      return _.invert(object)[property];
    };
  }
}());

(function () {
  'use strict';

  angular
    .module('starter.controllers', ['ngSanitize'])

    .controller('AppCtrl', function (
      $state,
      $scope,
      $timeout,
      $rootScope,
      $window,
      $ionicPopup,
      $ionicLoading,
      ChatService,
      AppOptions,
      EnvConfig,
      IdleService,
      ChatEventEmitterService,
      LivechatService,
      FeedbackModalService,
      IconverseService,
      AudioStreamingService,
      VoiceRecognitionService,
      TextToSpeechService,
      $sce,
      FeedbackModalStateService
    ) {
      var vm = this;

      vm.appOptions = null;

      // conversation object to pass into livechat
      vm.conversationId = {};
      // Only make livechat available if license is provided
      vm.isLivechatAvailable = false;
      vm.isLivechatLoading = false;
      vm.isLangSelectOpen = false;
      vm.isMenuSelectOpen = false;
      vm.languages = null;
      vm.selectedLanguage = null;
      vm.isShowLandingPage = null;
      vm.isDetailView = false;
      vm.detailViewTitle = '';
      vm.feedbackModal = null;

      var DISPLAY_OPTS = { DETAIL_PANEL_LAYOUT: 'detail_panel_layout' };
      var historyStates = [];

      window.addEventListener('message', function (e) {
        if (e.data === 'ATTEMPT_TO_CLOSE_CHAT') {
          FeedbackModalStateService.set({ trigger: 'chat_close_button' });
          // Handle the condition where user
          // Don't want to be asked again
          if (ChatService.isSkipPreExitFeedbackPanel()) {
            vm.removeFeedBackModal();
            window.parent.postMessage({ type: 'iconverse-end', timestamp: Date.now() }, '*');
          }
          else if (FeedbackModalStateService.shouldPromptFeedback()) {
            vm.initFeedbackModal({
              isTriggeredOnClose: true,
              isTriggeredByCloseChatButton: true
            });
            FeedbackModalStateService.set({ isFeedbackShowing: true });
          }
          else if (FeedbackModalStateService.shouldExitFeedback()) {
            $rootScope.$emit('app:closeChat');
            vm.removeFeedBackModal();
          }
          else {
            vm.removeFeedBackModal();
            vm.closeChat();
          }
        }
      });

      vm.removeFeedBackModal = function () {
        if (vm.feedbackModal) vm.feedbackModal.remove();
      };

      vm.startChatFromLanding = function () {
        $rootScope.$broadcast('startChatFromLanding');
        vm.isShowLandingPage = false;
      };

      vm.sanitizedCustomHtml = null;

      vm.selectLanguage = function (language) {
        // Exit if selected language is the same
        if (vm.selectedLanguage === language) {
          return;
        }
        vm.selectedLanguage = language;
        ChatService.setLanguage(language);
        AudioStreamingService.setLangCode(language);
        TextToSpeechService.setVoice(language);
        // Create a notification bubble and append it to the most recent chat bubble
        var notificationDiv = document.createElement('div');
        var notificationLineBefore = document.createElement('span');
        notificationLineBefore.className = 'line';
        notificationDiv.appendChild(notificationLineBefore);
        var notificationText = document.createElement('span');
        notificationText.className = 'text';
        notificationText.innerText = 'Language was switched to ' + language.label;
        notificationDiv.appendChild(notificationText);
        var notificationLineAfter = document.createElement('span');
        notificationLineAfter.className = 'line';
        notificationDiv.appendChild(notificationLineAfter);
        notificationDiv.className = 'notification fade-up';
        var chatBubbles = document.querySelectorAll('chat-bubble');
        var mostRecentChatBubble = chatBubbles[chatBubbles.length - 1];
        mostRecentChatBubble.appendChild(notificationDiv);
        // Scroll to the bottom if scroll position is elsewhere;
        $rootScope.$broadcast('scrollChatToBottom');
      };

      vm.historyBack = function () {
        if (historyStates.length) {
          // take previous state
          historyStates.splice(historyStates.length - 1, 1);
          var previousState = historyStates.pop();

          $state.go(previousState);
        }
        else {
          $state.go('app.chat');
        }
      };

      vm.showBasicAlert = function (title, text, onCloseFn) {
        var alertPopup = $ionicPopup.alert({
          title: title,
          template: "<div class='text-center'>" + text + '</div>'
        });

        alertPopup.then(function (res) {
          if (angular.isFunction(onCloseFn)) {
            onCloseFn();
          }
        });
      };

      vm.onCloseChatButtonClick = function (opts) {
        // Check if Feedback Modal is triggered on close in app options
        if (!vm.appOptions.isFeedbackModalTriggeredOnClose) {
          vm.closeChat();
          return;
        }
        // Check if the user has conversed with the VA.
        var isUserConversationStarted = angular.isDefined(ChatService.getLatestUserMessage());
        if (!isUserConversationStarted) {
          vm.closeChat();
          return;
        }

        // Check if user has preference to skip feedback
        var isOptedOut = ChatService.isSkipPreExitFeedbackPanel();

        // Init the feedback modal or close the entire chat
        isOptedOut ? vm.closeChat() : vm.initFeedbackModal({ isTriggeredOnClose: true });
      };

      vm.initFeedbackModalFromDropdown = function () {
        vm.initFeedbackModal({ isTriggeredByCloseChatButton: false });
        FeedbackModalStateService.set({ isFeedbackShowing: true, trigger: 'menu_dropdown' });
      };

      vm.printChatLog = function () {
        ChatService.getCurrentConversationId().then(function (cid) {
          IconverseService.downloadChatLog(cid)
            .then(function (blob) {
              var isIE = Boolean(window.navigator.msSaveOrOpenBlob);

              if (isIE) {
                return window.navigator.msSaveOrOpenBlob(blob, 'chatlog.pdf');
              }

              var fileUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
              var popupWindow = window.open(fileUrl, '_blank', 'height=600,width=800');

              return setTimeout(function () {
                popupWindow.print();
              }, 800);
            });
        });
      };

      vm.initFeedbackModal = function (options) {
        var isTriggeredOnClose = options ? options.isTriggeredOnClose : false;
        var isShowExitChatBtn = isTriggeredOnClose;
        var isExitChatAfterFeedbackSubmit = isTriggeredOnClose;
        var isTriggeredByCloseChatButton = options ? options.isTriggeredByCloseChatButton : false;

        // Notify parent window
        window.parent.postMessage({ type: 'feedback-showing' }, '*');

        FeedbackModalService
          // Return a promise which returns the modal object when resolved
          // params
          // 1. Title of modal
          // 2. $scope
          // 3. Scope key - The namespace on the scope object that this function will attach the modal to
          // 4. isShowExitChatBtn
          // 5. isExitChatAfterFeedbackSubmit
          .getModal(
            'Feedback',
            $scope,
            'feedback',
            isShowExitChatBtn,
            isExitChatAfterFeedbackSubmit,
            isTriggeredByCloseChatButton
          )
          .then(function (modal) {
            vm.feedbackModal = modal;
            modal.show();
          });
      };

      var isValidDisplayOption = function (displayOption) {
        return _.values(DISPLAY_OPTS).indexOf(displayOption) !== -1;
      };

      var loadDetailViewTitle = function () {
        var msg = ChatService.getLatestSelectedMessage();

        // parse display options, if any
        var displayOptions = {};

        var displayOpts = _.get(msg, 'display.options');
        if (displayOpts && displayOpts.length) {
          // make sure that options are in whitelist
          var verifiedOpts = _.filter(displayOpts, function (opt) {
            return isValidDisplayOption(opt);
          });
          // build an object like: {print_key_values: true, disallow_clicks_on_list_item: true}
          displayOptions = _.reduce(
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

          if (data.type === 'LINKS') {
            vm.detailViewTitle = 'List of intents';
          }
          else if (data.type === 'ISEARCH_RESULTS') {
            vm.detailViewTitle = 'List of Websites';
          }
          else if (data.type === 'DETAILS') {
            vm.detailViewTitle = 'Select an option';

            // Load single view of element if an ID is detected
            if ($state.params.elementId) {
              vm.detailViewTitle = 'Detail';
            }
            else {
              // list of links
              vm.detailViewTitle = '';

              if (displayOptions[DISPLAY_OPTS.DETAIL_PANEL_LAYOUT]) {
                vm.detailViewTitle = 'Select an Option';
              }
            }
          }
        }
      };

      $scope.$watch(
        function () {
          return $state.$current.name;
        },
        function (newVal, oldVal) {
          var detailViews = ['app.chat-option-detail', 'app.chat-detail', 'app.chat-web-fallback'];
          vm.isDetailView = detailViews.indexOf(newVal) > -1;

          // Load detail view title if it is detail view
          if (vm.isDetailView) loadDetailViewTitle();

          // Store history state
          if (!_.includes(historyStates, newVal)) {
            historyStates.push(newVal);
          }
          else {
            historyStates = [];
          }
        }
      );

      $rootScope.$on('chatService:idleTimeoutEvent', function () {
        // Check if the popup instance is already created
        if ($scope.confirmAlertPopup) {
          return false;
        }
        vm.showConfirmAlert(
          vm.appOptions.idleMessageTitle,
          vm.appOptions.idleMessageBody,
          function () {
            IdleService.startTracking();
            console.log('continuing session');
            // Remove popup instance
            $scope.confirmAlertPopup = null;
          },
          function () {
            ChatService.endConversation();
            // Remove popup instance
            $scope.confirmAlertPopup = null;
            // close the chat after timeout
            $timeout(function () {
              vm.closeChat();
            }, 3000);
          },
          'Continue',
          'End Chat'
        );
      });

      vm.showSendConversationPopup = function () {
        $scope.sendConvoData = {};
        var termsClause = vm.appOptions.conversationEmailTermsText;
        var sendConvoPopup = $ionicPopup.show({
          template:
            '<div class="text-center"><input autofocus type="text" class="email-input" ng-model="sendConvoData.email"/> <div class="mt-10"><label class="text-sm"><input type="checkbox" ng-model="sendConvoData.acceptedTerms"/>&nbsp;&nbsp;'
            + termsClause
            + '</label></div></div>',
          title: 'Email Conversation Log',
          subTitle: 'What email should we send the conversation to?',
          scope: $scope,
          buttons: [
            { text: 'Cancel' },
            {
              text: '<b>Send</b>',
              type: 'button-positive',
              onTap: function (e) {
                if (!$scope.sendConvoData.email || !$scope.sendConvoData.acceptedTerms) {
                  // don't allow the user to send unless all fields properly entered
                  e.preventDefault();

                  if (!$scope.sendConvoData.email) {
                    vm.showToast('Please enter your email', 2000);
                  }
                  else if (!$scope.sendConvoData.acceptedTerms) {
                    vm.showToast('Please accept the terms', 2000);
                  }
                  return false;
                }

                // validate email pattern
                var isValidEmail = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/.test(
                  $scope.sendConvoData.email
                );
                if (!isValidEmail) {
                  vm.showToast('Please enter a valid email', 2000);
                  e.preventDefault();
                  return false;
                }

                // if validation pass, return the email string
                return $scope.sendConvoData.email;
              }
            }
          ]
        });

        sendConvoPopup.then(function (email) {
          if (email) {
            vm.showLoader(false, 'Sending...');
            var failMessage = 'Sorry, we could not send the email.<br>Please try again later.';
            // retrieve cid
            ChatService.getCurrentConversationId()
              .then(function (cid) {
                // hit the API to trigger the email
                IconverseService.triggerSendConversationToEmail(cid, email)
                  .then(function () {
                    vm.showSuccessToast('Email Sent!', 2000);
                  })
                  .catch(function () {
                    vm.showErrorToast(failMessage, 2000);
                  });
              })
              .catch(function () {
                vm.showErrorToast(failMessage, 2000);
              });
          }
        });
      };

      vm.showConfirmAlert = function (title, text, onConfirmFn, onCancelFn, okText, cancelText) {
        $scope.confirmAlertPopup = $ionicPopup.confirm({
          title: title,
          template: "<div class='text-center'>" + text + '</div>',
          okText: okText || 'OK',
          cancelText: cancelText || 'Cancel'
        });

        $scope.confirmAlertPopup.then(function (isConfirm) {
          if (isConfirm && angular.isFunction(onConfirmFn)) {
            onConfirmFn();
          }
          else if (angular.isFunction(onCancelFn)) {
            onCancelFn();
          }
        });
      };

      vm.showLoader = function (html, text) {
        $ionicLoading.show({
          template: html || '<ion-spinner></ion-spinner><br>' + (text || 'Loading...')
        });
      };

      vm.hideLoader = function () {
        $ionicLoading.hide();
      };

      vm.showToast = function (text, durationMs, iconClass, iconSize) {
        var iconHtml = '';
        if (!iconSize) iconSize = 'icon-1-5x';
        if (iconClass) iconHtml = '<i class="icon ' + iconClass + ' ' + iconSize + '"></i>';

        vm.hideLoader(); // hide any pre-existing loader/toast

        $ionicLoading.show({
          template: (iconHtml ? iconHtml + '<br>' : '') + text
        });

        if (durationMs) {
          $timeout(function () {
            $ionicLoading.hide();
          }, durationMs);
        }
      };

      vm.showSuccessToast = function (successText, durationMs) {
        vm.showToast(successText || 'Success', durationMs, 'ion-checkmark');
      };

      vm.showErrorToast = function (errorText, durationMs) {
        vm.showToast(errorText || 'Error', durationMs, 'ion-close');
      };

      vm.closeContextMenu = function () {
        vm.toggleMenuSelect();
      };

      vm.closeLanguageMenu = function () {
        vm.toggleLangSelect();
      };

      vm.restartConvo = function () {
        // prompt first
        vm.showConfirmAlert(
          'Restart Chat',
          'Are you sure you want to restart the current chat? This will also clear the chat log.',
          function () {
            ChatService.restartConversation();
          }
        );
      };

      vm.openFeedbackPanel = function () {
        $rootScope.$broadcast('chat:openFeedbackPanel');
      };

      vm.closeChat = function () {
        IdleService.stopTracking();
        ChatEventEmitterService.sendCloseChatEvent();
      };

      $rootScope.$on('app:closeChat', function () {
        vm.closeChat();
        FeedbackModalStateService.reset();
      });

      /**
       * On livechat after successfully loaded
       */
      $rootScope.$on('livechat:onAfterLoad', function () {
        $timeout(function () {
          vm.isLivechatLoading = false;
        }, 0);

        // Make sure livechat is maximized after load
        var isMaximized = LivechatService.isChatWindowMaximized();
        if (!isMaximized) {
          LivechatService.openChatWindow();
        }
      });
      vm.toggleLangSelect = function () {
        vm.isLangSelectOpen = !vm.isLangSelectOpen;
        if (vm.isLangSelectOpen && vm.isMenuSelectOpen) {
          vm.toggleMenuSelect();
        }
      };

      vm.toggleMenuSelect = function () {
        vm.isMenuSelectOpen = !vm.isMenuSelectOpen;
        if (vm.isLangSelectOpen && vm.isMenuSelectOpen) {
          vm.toggleLangSelect();
        }
      };

      vm.checkIsMobile = function () {
        return IconverseService.getChannelType() === 'mobile-web';
      };

      vm.checkIsWebView = function () {
        return window.location.search.indexOf('fromWebView=true') !== -1;
      };

      $rootScope.$on('onTriggerLiveChat', function () {
        vm.openLivechatBtnOnClicked();
      });

      /**
       * Open chat window of Livechat
       */
      vm.openLivechatBtnOnClicked = function () {
        // get all conversation log
        var conversationLog = ChatService.getConversationLog() || [];
        // transform the conversation log into {name,value}
        var transformedConversationLog = vm.getTransformedConversationLog(conversationLog);
        // check is livechat loaded
        var isLivechatLoaded = LivechatService.isLivechatLoaded();
        if (isLivechatLoaded) {
          // setup custom variable for livechat
          var newCustomVariable = transformedConversationLog.concat([vm.conversationId]);
          IdleService.stopTracking();
          LivechatService.setCustomVariables(newCustomVariable);
          LivechatService.openChatWindow();
        }
        else {
          vm.isLivechatLoading = true;
          ChatService.getCurrentConversationId().then(function (cid) {
            vm.conversationId = { name: 'conversationId', value: cid };
            // setup params for livechat
            var newParams = transformedConversationLog.concat([vm.conversationId]);
            IdleService.stopTracking();
            LivechatService.setParams(newParams);
            LivechatService.loadLivechat(vm.appOptions.livechatLicense);
          });
        }
      };

      /**
       * Take the last 10 element from array,
       * Then transform the messages to {name, value} format
       */
      vm.getTransformedConversationLog = function (messages) {
        function mapMessage (message, index) {
          return {
            name: index + '-' + message.source,
            value: message.text
          };
        }

        var maxArrLength = 10;
        return _(messages)
          .takeRight(maxArrLength)
          .map(mapMessage)
          .value();
      };

      /**
       * On livechat after post chat survey submitted
       */
      $rootScope.$on('livechat:onPostchatSurveySubmitted', function () {
        document.getElementById('chat-widget-container').classList.remove('post-survey-activated');
        document.getElementById('chat-widget-container').classList.remove('mobile');
        LivechatService.hideChatWindow();
      });

      /**
       * On livechat after chat ended, before post chat survey
       */
      $rootScope.$on('livechat:onChatEnded', function () {
        // Hide the chat window if there is no post chat survey
        if (!vm.appOptions.livechatHasPostChatSurvey) {
          LivechatService.hideChatWindow();
        }
        else {
          document.getElementById('chat-widget-container').classList.add('post-survey-activated');

          if (vm.checkIsMobile()) {
            document.getElementById('chat-widget-container').classList.add('mobile');
          }
        }
      });

      /**
       * On livechat after chat ended, before post chat survey
       */
      $rootScope.$on('livechat:onChatWindowMinimized', function () {
        vm.isLivechatLoading = false;
        IdleService.startTracking();
      });

      var isVoiceRecognitionSwitchedOn = function (options) {
        return options.isVoiceRecognitionAvailable
          && options.voiceRecognitionEndpoint
          && options.voiceRecognitionEndpoint;
      };

      var setupVoiceRecognitionService = function (options) {
        // Set up voice recognition service
        AudioStreamingService.getUserMediaAccess().then(function () {
          $rootScope.$broadcast('voiceRecognition:hasAcess');
          VoiceRecognitionService.setupServerPath(options.voiceRecognitionEndpoint);
          VoiceRecognitionService.setupWebsocketPath(options.voiceRecognitionWebSocket);
          AudioStreamingService.setupWebsocketPath();
        });
      };

      var loadBotConfig = function () {
        IconverseService.getBotConfig()
          .then(function (response) {
            var botConfig = response.data.data;
            AppOptions.merge(botConfig);
            $rootScope.$broadcast('appOptions:updated');
          })
          .catch(function () {
            $rootScope.$broadcast('appOptions:updated');
          });
      };

      $rootScope.$on('app:loaded', function (e) {
        AppOptions.merge(window.__appOptions);
        EnvConfig.merge(window.__envConfig);
        IconverseService.setServerUrl(EnvConfig.get().chatEndpoint);
        loadBotConfig();
      });

      $rootScope.$on('appOptions:updated', function () {
        vm.appOptions = AppOptions.get();

        // Set up livechat function
        vm.isLivechatAvailable = !!vm.appOptions.livechatLicense;

        // Set up language selector
        vm.languages = vm.appOptions.languages;
        vm.selectedLanguage = vm.languages[0];
        ChatService.setLanguage(vm.selectedLanguage);
        AudioStreamingService.setLangCode(vm.selectedLanguage);
        TextToSpeechService.setVoice(vm.selectedLanguage);

        // Set up landing page
        vm.isShowLandingPage = vm.appOptions.isLandingPage;
        vm.sanitizedCustomHtml = $sce.trustAsHtml(vm.appOptions.customLandingPageHtml);

        IconverseService.setBotId(vm.appOptions.botId);
        IdleService.setIdleDelayTimeMins(vm.appOptions.idleDelayTimeMins);
        ChatService.setFirstMsgTypingTimeMs(vm.appOptions.firstMessageTypingDelayMs);
        ChatService.setMaxTypingTimeMs(vm.appOptions.typingDelayMs);
        ChatService.setBot(vm.appOptions.botId);

        if (isVoiceRecognitionSwitchedOn(vm.appOptions)) {
          setupVoiceRecognitionService(vm.appOptions);
        }
      });
    });
}());

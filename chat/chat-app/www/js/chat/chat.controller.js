angular
  .module('iconverse')

  .controller('ChatController', function (
    $scope,
    ChatService,
    $state,
    $stateParams,
    $rootScope,
    $ionicScrollDelegate,
    AppOptions,
    $timeout,
    $document,
    $window,
    $ionicSideMenuDelegate,
    $http,
    ionicDatePicker,
    NumberPickerPopup,
    IconverseService,
    AudioStreamingService,
    FeedbackModalStateService
  ) {
    var vm = this;

    vm.file = {};
    vm.isFileUploadBarAreaHidden = true;
    vm.isFileUploadFailedAreaHidden = true;
    vm.fileUploadBarUploadingText = 'Uploading...';
    vm.fileUploadBarProcessingUploadText = '';
    vm.isAutocompleteVisible = false;
    vm.queryMinLength = null;
    vm.feedbackMessage = null;
    vm.afterFeedbackMessage = null;
    vm.isExpectTypeInput = null;
    vm.isDropdownExpectInput = null;
    vm.dateInputLimits = {};
    vm.suggestions = [];
    vm.isInitialisingConversation = false;
    vm.FALLBACK_TYPE = IconverseService.FALLBACK_TYPE;
    vm.cid = '';
    vm.autocompleteTextInput = '';

    // set the default input placeholder (this depending on the expected input type)
    var DEFAULT_INPUT_PLACEHOLDER = null;
    vm.userInputPlaceholder = null;

    vm.isVoiceRecognitionAvailable = false;

    vm.isSearching = false;
    vm.isLanguageSelectionMenuOpened = false;
    vm.isRecording = false;
    vm.isVoiceDetected = false;
    vm.getConversationsSessionPromise = null;

    var version = '1.3.1';
    console.info('converse-ui version: ' + version);

    // disable draggable content on ionic, so as not to interfere with copy and pasting of text
    $ionicSideMenuDelegate.canDragContent(false);

    // Bind viewmodel to the conversation log, on the property `conversation`
    // conversation is a simply an array of Message objects
    // note: conversation is maintained in ChatService so its state can be shared across controllers
    ChatService.bindConversation(vm, 'conversation');

    /**
     * Receive Events From Parent Window
     * - `OPEN_EVENT` - triggered when user clicks on chat toggle button to open chatbox
     */
    $window.addEventListener('message', function (e) {
      var msg = e.data;
      if (msg === 'OPEN_EVENT') {
        /**
         * Only initialise conversation if:
         * 1. The chat have not initialise (no cid)
         * 2. The chat is not under initialisation state (by checking getConversationsSessionPromise)
         */
        if (!vm.cid && !this.getConversationsSessionPromise) {
          vm.initialiseConversation();
        }
      }
    });

    vm.initialiseConversation = function () {
      vm.isInitialisingConversation = true;

      var acceptUserInput = function () {
        vm.isInitialisingConversation = false;

        // Focus on input after initialised conversation
        $timeout(function () {
          document.getElementById('chatInputField').focus();
        }, 0);
      };

      this.getConversationsSessionPromise = IconverseService.getConversationsSession()
        .then(function (data) {
          if (data && data.activeSession && data.messages && data.messages.length) {
            ChatService.restoreConversationMessages(data.messages);
            ChatService.getCurrentConversationId().then(function (cid) {
              vm.cid = cid;
            });
            acceptUserInput();
            $timeout(function () {
              $rootScope.$broadcast('scrollChatToBottom', {
                duration: 0,
                restoreConversation: true,
                serverTrigger: true
              });
            }, 100);
          }
          else {
            // if there is no conversation, let's welcome the user
            var isSeenUser = angular.isDefined(ChatService.getLastConversationRecord());
            ChatService.startConversation(isSeenUser)
              .then(function () {
                return ChatService.getCurrentConversationId();
              })
              .then(function (cid) {
                vm.cid = cid;
              })
              .finally(function () {
                acceptUserInput();
              });
          }
        })
        .catch(function () {
          acceptUserInput();
        });
    };

    $rootScope.$on('appOptions:updated', function () {
      var appOptions = AppOptions.get();

      vm.queryMinLength = appOptions.autocompleteQueryMinLength;
      vm.feedbackMessage = appOptions.feedbackMessage;
      vm.afterFeedbackMessage = appOptions.afterFeedbackMessage;
      DEFAULT_INPUT_PLACEHOLDER = appOptions.inputPlaceholder;
      vm.userInputPlaceholder = DEFAULT_INPUT_PLACEHOLDER;
    });

    $rootScope.$on('voiceRecognition:hasAcess', function () {
      vm.isVoiceRecognitionAvailable = true;
    });

    $scope.$watch('vm.entry', function () {
      // Set isVoiceDetected to true based on vm.entry
      // until the next time voice recognition is trigger again
      if (vm.entry && vm.entry.length) {
        vm.isVoiceDetected = true;
      }
    });

    $scope.$watch('vm.autocompleteTextInput', function () {
      // Show the panel if there are suggestions and the query min length is fulfilled
      if (vm.autocompleteTextInput && vm.autocompleteTextInput.length > vm.queryMinLength) {
        vm.isAutocompleteVisible = true;
      }
      else {
        vm.isAutocompleteVisible = false;
      }
    });

    $scope.$watch('vm.activeSuggestion', function () {
      if (vm.activeSuggestion) vm.entry = vm.activeSuggestion;
    });

    vm.isChatHomeView = function () {
      return $state.current.name === 'app.chat';
    };

    // handle input selection
    vm.didSelectInput = function () {
      if (vm.isExpectTypeInput === 'date') {
        vm.openDatePicker();
      }
      else if (vm.isExpectTypeInput === 'number') {
        vm.openNumberPicker();
      }
    };

    vm.blurInput = function () {
      document.getElementById('chatInputField').blur();
    };

    vm.openDatePicker = function () {
      // open the datepicker. note: dateInputLimits were set in vm.handleServerReplyMsg
      ionicDatePicker.openDatePicker({
        callback: function (value) {
          console.log('the date picked was ', value);
          // format the selected date into the expected string format
          vm.entry = new moment(value).format('DD MMMM YYYY');
          // trigger message send
          vm.processEntry();
        },
        from: vm.dateInputLimits.min ? vm.dateInputLimits.min : new Date(),
        to: vm.dateInputLimits.max ? vm.dateInputLimits.max : null,
        inputDate: vm.dateInputLimits.min ? vm.dateInputLimits.min : null,
        setLabel: 'Select',
        showTodayButton: false
      });
    };

    vm.openNumberPicker = function () {
      var config = {
        callback: function (value) {
          console.log('the number picked was ', value);
          // trigger message send
          vm.entry = value + ''; // entry must be string
          vm.processEntry();
        }
      };

      if (vm.numberInputLimits.min) {
        config.min = vm.numberInputLimits.min;
        config.start = vm.numberInputLimits.min;
      }
      if (vm.numberInputLimits.max) config.max = vm.numberInputLimits.max;
      if (vm.numberInputLimits.step) config.step = vm.numberInputLimits.step;

      NumberPickerPopup.open(config);
    };

    $rootScope.$on('chat:expectVariableType', function (event, msg) {
      // reset any previously set expectations
      vm.isExpectTypeInput = null;
      vm.dateInputLimits = {};
      vm.numberInputLimits = {};

      if (msg.variableType === 'date') {
        vm.isExpectTypeInput = 'date';
        // read the calendar picker's settings from the message body,
        // if any settings were provied
        vm.dateInputLimits = ChatService.getDateInputLimitsFromMessage(msg, 'date');

        // set the placeholder
        vm.userInputPlaceholder = 'Enter a date';
      }
      else if (msg.variableType === 'number') {
        vm.isExpectTypeInput = 'number';

        vm.numberInputLimits = ChatService.getNumberInputLimitsFromMessage(msg, 'number');

        // set the placeholder
        vm.userInputPlaceholder = 'Enter a number';
      }
      else {
        // reset the input placeholder
        vm.userInputPlaceholder = DEFAULT_INPUT_PLACEHOLDER;
      }
    });

    vm.handleDropdownSelected = function (option) {
      vm.isProcessing = true;

      ChatService.processUserMessage(option.text, 'dropdownOption' + option.value)
        .then(vm.handleServerReplyMsg)
        .catch(ChatService.getGenericErrorHandler())
        .finally(function () {
          vm.isProcessing = false;
        });
    };

    vm.handleServerReplyMsg = function (msg) {
      // handle dropdown input expected
      if (msg.options) {
        $timeout(function () {
          vm.isDropdownExpectInput = 'dropdown';
          vm.userInputPlaceholder = 'Select from dropdown options';
        });
      }
      else {
        $timeout(function () {
          vm.isDropdownExpectInput = null;
        });
      }

      $timeout(function () {
        $rootScope.$broadcast('scrollChatToBottom', { serverTrigger: true });
      });

      console.log('msg received');
    };

    vm.handleInputKeydown = function (event) {
      // on 'ESC': Close autocomplete function and recording
      if (event.keyCode === 27) {
        vm.isAutocompleteVisible = false;
        vm.isRecording = false;
        vm.entry = vm.autocompleteTextInput;
      }
      else if (vm.autocompleteApi && (event.keyCode === 38 || event.keyCode === 40)) {
        vm.controlAutocomplete(event);
      }
      else if (event.keyCode === 13) {
        vm.processEntry();
      }
      else {
        // Do nothing for normal input
      }
    };

    vm.handleInputKeyup = function (event) {
      // Arrow button and ESC key should not trigger change in autocompleteTextInput
      if (
        event.keyCode !== 27
        && event.keyCode !== 37
        && event.keyCode !== 38
        && event.keyCode !== 39
        && event.keyCode !== 40
        && vm.autocompleteTextInput !== event.target.value
      ) {
        vm.autocompleteTextInput = event.target.value;
      }
    };

    vm.handleInputBlur = function () {
      vm.isAutocompleteVisible = false;
      vm.isRecording = false;
    };

    vm.controlAutocomplete = function (event) {
      event.preventDefault();
      if (vm.autocompleteApi) {
        vm.autocompleteApi.keyHandler(event);
      }
    };

    vm.processAutocompleteSuggestion = function (suggestion) {
      vm.entry = suggestion;
      vm.processEntry();
    };

    vm.handleInputSubmit = function () {
      vm.processEntry();
    };

    // process the user entered message
    vm.processEntry = function () {
      // Prevent default processing if there is nothing typed
      // Or if there is an active suggestion highlighted by autocomplete
      if (!vm.entry) return;
      FeedbackModalStateService.set({
        hasTalkedToBot: true
      });
      vm.latestEntry = vm.entry;
      vm.entry = ''; // clear the input

      // Fix IE issue of loss focus after form submit
      $timeout(function () {
        document.getElementById('chatInputField').focus();
      });

      vm.isProcessing = true;

      ChatService.processUserMessage(vm.latestEntry)
        .then(vm.handleServerReplyMsg)
        .catch(ChatService.getGenericErrorHandler())
        .finally(function () {
          vm.isProcessing = false;
        });
    };

    $scope.selectFileToUpload = function () {
      $timeout(function () {
        document.getElementById('fileUpload').click();
      });
    };

    $scope.uploadFileSelected = function (ele) {
      var files = ele.files;
      if (files.length === 0) return;

      var fd = new FormData();
      fd.append('file', files[0]);

      // hide the file upload button
      vm.forceHideUploadFileButton = true;

      // show the upload bar
      vm.isFileUploadBarAreaHidden = false;
      vm.fileUploadBarProcessingUploadText = '';
      vm.fileUploadBarUploadingText = 'Uploading ' + files[0].name + '...';

      ChatService.uploadFile(fd)
        .then(function (response) {
          // send the acknowledge msg
          var replyTxt = response.data.name;
          $timeout(function () {
            vm.fileUploadBarUploadingText = '';
            vm.fileUploadBarProcessingUploadText = 'Processing uploaded file...';

            // Send uploaded file name as prompt variable
            ChatService.processUserMessage(replyTxt, replyTxt)
              .then(function (replyMsg) {
                // hide the file upload button and upload bar
                vm.forceHideUploadFileButton = false;
                vm.isFileUploadBarAreaHidden = true;
              })
              .catch(ChatService.getGenericErrorHandler());
          }, 1000);
        })
        .catch(function (data) {
          console.log('ERROR file upload');
          console.log(data);
          vm.forceHideUploadFileButton = false;
          vm.isFileUploadBarAreaHidden = true;
          vm.fileUploadBarUploadingText = 'Uploading...';
          vm.fileUploadBarProcessingUploadText = '';

          vm.isFileUploadFailedAreaHidden = false;
          $timeout(function () {
            vm.isFileUploadFailedAreaHidden = true;
          }, 2000);
        });
    };

    // if any click is clicked
    vm.clickChatLink = function (link) {
      console.log('link clicked', link);
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
      )
        .then(vm.handleServerReplyMsg)
        .catch(ChatService.getGenericErrorHandler());
    };

    vm.restartSession = function () {
      ChatService.clearConversation();
      ChatService.startConversation();
    };

    // if any message attachment was clicked
    vm.clickAttachment = function (message) {
      console.log('attachment clicked', message);
      ChatService.setLatestSelectedMessage(message);
      $state.go('app.chat-detail');
    };

    // if any choice was selected on a mesage
    vm.clickChoice = function (choice, message) {
      console.log('choice selected', choice);
      console.log('choice for message', message);
      // Remove the element display immediately
      document.getElementById('choicesPanel').style.display = 'none';
      $timeout(function () {
        // Display it after 1 second - this will be long enough
        // until the transitions have ended.
        document.getElementById('choicesPanel').style.display = 'block';
      }, 1000);

      // each choice has a `text` and a `value`
      ChatService.processUserMessage(
        choice.text,
        choice.value,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        choice.type
      )
        .then(vm.handleServerReplyMsg)
        .catch(ChatService.getGenericErrorHandler());
    };

    vm.record = function () {
      var recognition;

      if (angular.isUndefined(window.cordova)) {
        // recognition = new webkitSpeechRecognition(); //To Computer
        $scope.app.showBasicAlert(
          'Note',
          'Speech Recognition is not available when previewing on a web browser'
        );
        return;
      }

      recognition = new SpeechRecognition(); // To Device

      recognition.lang = 'en-US';

      recognition.onresult = function (event) {
        if (event.results.length > 0) {
          vm.entry = event.results[0][0].transcript;
          $scope.$apply();

          // programmatically trigger process after x ms
          $timeout(function () {
            vm.processEntry();
          }, 100);
        }
      };

      recognition.start();
    };

    $rootScope.$on('chat:openFeedbackPanel', function () {
      vm.feedbackPanel.toggleVisibility();
    });

    vm.voiceButtonOnClicked = function () {
      if (vm.entry && vm.entry.length) return;
      vm.isVoiceDetected = false;
      vm.isRecording = true;
      vm.controlVoiceRecognition('start');
    };

    vm.voiceButtonActivatedOnClicked = function () {
      vm.controlVoiceRecognition('stop');
    };

    vm.handleOnVoiceRecognitionStopped = function () {
      $timeout(function () {
        vm.isRecording = false;
      });
    };

    vm.handleOnTextInputChanged = function () {
      /**
       * This is an anti-pattern to force re-rendering of vm.entry in
       * text input box.
       */
      $timeout(function () {});
    };

    vm.controlVoiceRecognition = function (action) {
      if (vm.voiceRecognitionApi) {
        switch (action) {
        case 'start':
          vm.voiceRecognitionApi.start();
          break;
        case 'stop':
          vm.voiceRecognitionApi.stop();
          break;

        default:
          break;
        }
      }
    };

    vm.isFallbackFeedbackShown = function (message) {
      if (!message) return false;

      return message.displayDidThisHelp && !vm.hasFallbackTriggerButton(message);
    };

    vm.isAfterFeedbackMessageShown = function (message) {
      if (!message) return false;
      return message.fallbackType === vm.FALLBACK_TYPE.AFTERFEEDBACK;
    };

    vm.hasFallbackTriggerButton = function (message) {
      if (!message || !message.choices) return false;

      return _.some(message.choices, { type: ChatService.getMessageType().FALLBACK_TRIGGER });
    };

    vm.rateAnswer = function (message, isPositive) {
      message.displayDidThisHelp = false;

      if (!isPositive) {
        vm.triggerFallback();
      }

      if (message.fallbackType === vm.FALLBACK_TYPE.INTENTSEARCH) {
        vm.positiveRateFallbackAnswer(message);
      }

      vm.rateConversation(message, isPositive);
      message.fallbackType = vm.FALLBACK_TYPE.AFTERFEEDBACK;
    };

    vm.positiveRateFallbackAnswer = function (message) {
      IconverseService.suggestUnansweredPhraseIntent(
        message.bot,
        message.cid,
        message.intent
      ).catch(function (err) {});
    };

    vm.rateConversation = function (message, isPositive) {
      IconverseService.rateAnswer(message.cid, isPositive).then(function (response) {
        console.log('successfully rated answer as ', isPositive ? 'positive' : 'negative');
      });
    };

    vm.triggerFallback = function () {
      ChatService.processUserMessage(
        "This didn't help",
        null,
        null,
        null,
        false,
        null,
        null,
        null,
        null,
        null,
        ChatService.getMessageType().FALLBACK_TRIGGER
      ).catch(function (err) {});
    };

    // Detect if the current chat bubble is the most recent one.
    // Used for disabling actions in previous bubbles.
    vm.isCurrentActiveBubble = function (msg) {
      return vm.conversation[vm.conversation.length - 1] === msg;
    };


    // This function is called onkeyup event in the search input.
    // This is throttled to prevent too many api calls
    // $scope.searchAutocomplete = _.throttle(function() {
    //         vm.isSearching = true;
    //         // Prevent the search from being triggered in the input is empty
    //         if(vm.autocompleteEntry === ''){
    //             vm.isSearching = false;
    //             return;
    //         }

    //         // Get enquiries matching the search input
    //         IconverseService.getEnquiriesMatchingText(vm.autocompleteEntry).then(function(response){
    //             // Display the search results
    //             vm.autocompleteSearchResults = response.data;

    //             // If there are no results turn off searching status
    //             if(vm.autocompleteSearchResults.length <= 0){
    //                 vm.isSearching = false;
    //             }
    //         });

    // }, 800);
  });

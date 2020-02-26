(function () {
  'use strict';

  angular.module('iconverse').factory('ChatService', ChatService);

  ChatService.$inject = [
    'IconverseService',
    '$q',
    '$window',
    '$state',
    '$timeout',
    '$ionicScrollDelegate',
    '$http',
    'ChatEventEmitterService',
    'AppOptions',
    'IdleService',
    '$rootScope'
  ];

  function ChatService (
    IconverseService,
    $q,
    $window,
    $state,
    $timeout,
    $ionicScrollDelegate,
    $http,
    ChatEventEmitterService,
    AppOptions,
    IdleService,
    $rootScope
  ) {
    var ICONVERSE_CONFUSED_REPLY_TEXT = "I don't understand";

    var _cid = null;
    var _lang = AppOptions.languages[0];

    // the message which was last selected for viewing details in chat-detail
    var _latestSelectedMessage = null;

    // initialize conversation log
    var _conversationLog = [];

    // statuses of VA
    var STATUSES = {
      IDLE: 'IDLE',
      PROCESSING: 'PROCESSING',
      REPLYING: 'REPLYING'
    };

    var MESSAGE_TYPE = {
      DEFAULT: 'DEFAULT',
      FALLBACK_TRIGGER: 'FALLBACK_TRIGGER'
    };

    var CURRENT_STATUS = STATUSES.IDLE;

    var MAX_TYPING_TIME_MS = AppOptions.typingDelayMs || 200;
    var FIRST_MSG_TYPING_TIME_MS = AppOptions.firstMessageTypingDelayMs || 400;

    var STORAGE_KEYS = {
      LAST_CONVO: 'ic',
      SKIP_FEEDBACK: 'ic.skipPreExitFeedback'
    };

    var self = this;

    return {
      getMessageType: function () {
        return MESSAGE_TYPE;
      },

      setLanguage: function (lang) {
        _lang = lang;
      },

      setupMessage: function (text, cid) {
        return {
          text: text || '',
          cid: cid || _cid || null,
          lang: _lang.iso
        };
      },

      makeSystemMessage: function (text, cid) {
        var msg = this.setupMessage(text, cid);
        msg.source = 'system';
        return msg;
      },

      makeUserMessage: function (
        text,
        cid,
        choice,
        element,
        query,
        topic,
        subtopic,
        enquiry,
        lang,
        mode,
        isAutoTriggered,
        messageType
      ) {
        var msg = this.setupMessage(text, cid);
        msg.channel = IconverseService.getChannelType();

        msg.source = 'user';
        if (choice) {
          msg.value = choice;
        }

        if (element && query) {
          msg.element = element;
          msg.query = query;
        }

        if (topic && subtopic) {
          msg.topic = topic;
          msg.subtopic = subtopic;
        }

        if (enquiry) {
          msg.enquiry = enquiry;
        }

        // If mode is not provided, the default to 'text'
        msg.mode = mode || 'text';

        msg.bot = AppOptions.botId;

        msg.isAutoTriggered = isAutoTriggered;

        msg.type = messageType || MESSAGE_TYPE.DEFAULT;

        return msg;
      },

      // binds the current conversation to the passed in vm, on the specified property name
      bindConversation: function (vm, propertyName) {
        vm[propertyName] = _conversationLog;
      },

      addUserMessage: function (text) {
        _conversationLog.push(this.makeUserMessage(text));
      },

      addSystemMessage: function (text) {
        _conversationLog.push(this.makeSystemMessage(text));
      },

      setLatestSelectedMessage: function (message) {
        _latestSelectedMessage = message;
      },

      getLatestSelectedMessage: function () {
        return _latestSelectedMessage;
      },

      getDefaultReplyText: function () {
        return ICONVERSE_CONFUSED_REPLY_TEXT;
      },

      clearConversation: function () {
        _conversationLog.splice(0, _conversationLog.length);
        console.log(_conversationLog);
      },

      startConversation: function (isSeenUser) {
        var self = this;
        var msg = isSeenUser ? 'hello again' : 'hello';
        return this.processUserMessage(msg, null, null, null, true).catch(
          self.getGenericErrorHandler(
            'Sorry, you are unable to reach me at the moment. Please contact Taiger for support.'
          )
        );
      },

      endConversation: function () {
        // programmatically send bye message to end session
        return this.processUserMessage('bye', null, null, null, true).then(function () {
          // clear the cid in memory
          _cid = null;
        });
      },

      restartConversation: function () {
        console.log('restarting convo...');
        _cid = null;
        $state.go('app.chat');
        // clear conversation
        this.clearConversation();
        // start convo
        return this.startConversation();
      },

      getGenericErrorHandler: function (optionalMessage) {
        var self = this;
        var msg = optionalMessage
          || "My apologies, but I'm not available the moment. Could we speak again a little later?";
        return function (err) {
          console.log(err);
          self.addSystemMessage(msg);
        };
      },

      addProcessingMessage: function () {
        var msg = this.makeSystemMessage();
        msg.isProcessingMsg = true;
        _conversationLog.push(msg);
        // scroll to bottom at the end of the digest cycle
        $timeout(function () {
          $rootScope.$broadcast('scrollChatToBottom');
        });
      },

      removeProcessingMessage: function () {
        var deferred = $q.defer();

        var idx = _.findIndex(_conversationLog, function (msg) {
          return msg.isProcessingMsg;
        });

        if (idx === -1) {
          deferred.resolve();
        }
        else {
          $timeout(function () {
            // check again if the processing message
            // referenced at the idx still exists when this code executes
            var theMessage = _conversationLog[idx];
            if (theMessage && theMessage.isProcessingMsg) {
              _conversationLog[idx].isExiting = true;

              $timeout(function () {
                _conversationLog.splice(idx, 1);
                deferred.resolve();
              }, 250);
            }
            else {
              // if the message doesnt exist anymore, resolve now
              deferred.resolve();
            }
          }, 500);
        }

        return deferred.promise;
      },

      // used for removing the processing message
      removeLastMessage: function (delay) {
        var deferred = $q.defer();

        $timeout(function () {
          _conversationLog[_conversationLog.length - 1].isExiting = true;

          $timeout(function () {
            _conversationLog.pop();
            deferred.resolve();
          }, 250);
        }, delay);

        return deferred.promise;
      },

      // resolves with the current CID. If not CID is present
      // a new session is started and the newly created CID returned.
      // internally also sets the current CID
      getCurrentConversationId: function () {
        console.log('get current conversation')
        var deferred = $q.defer();
        if (_cid) {
          deferred.resolve(_cid);
        }
        else {
          IconverseService.startSession()
            .then(function (data) {
              console.log(data.data);
              var id = data.data;
              _cid = id;

              if (!_cid) {
                deferred.reject(
                  'iConverse Server returned null cid. Could not start iconverse session!'
                );
              }
              else {
                ChatEventEmitterService.onConversationStarted(_cid);

                deferred.resolve(id);
              }
            })
            .catch(function (err) {
              deferred.reject('Error starting iConverse Session: ' + JSON.stringify(err));
            });
        }

        return deferred.promise;
      },

      saveConversation: function (convoId) {
        if (convoId) {
          var record = {
            cid: convoId,
            timestamp: new Date().getTime()
          };
          $window.localStorage[STORAGE_KEYS.LAST_CONVO] = JSON.stringify(record);
          console.log('saved ls');
        }
      },

      getLastConversationRecord: function () {
        try {
          var record = JSON.parse($window.localStorage[STORAGE_KEYS.LAST_CONVO]);
          return new Date().getTime() - record.timestamp < 24 * 60 * 60 * 1000 ? record : undefined;
        }
        catch (e) {
          return undefined;
        }
      },

      // Sets the skip feedback record in session storage, which will be checked using `isSkipPreExitFeedbackPanel`
      // Note: sessionStorage persists only for a browser session (destroyed when tab/window is closed)
      saveSkipFeedbackPreference: function () {
        if (_cid) {
          var record = {
            cid: _cid,
            timestamp: new Date().getTime()
          };
          $window.sessionStorage.setItem(STORAGE_KEYS.SKIP_FEEDBACK, JSON.stringify(record));
          console.log('saved ls skipfeedbackpref');
        }
      },

      isSkipPreExitFeedbackPanel: function () {
        try {
          var record = JSON.parse($window.sessionStorage.getItem(STORAGE_KEYS.SKIP_FEEDBACK));
          return record || false;
        }
        catch (e) {
          return false;
        }
      },
      processCustomMessage: function (textEntry) {
        var deferred = $q.defer();
        var self = this;

        this.addUserMessage(textEntry);
        var payload =
        {
          "context": window.customData.contextInput,
          "questions": [
            textEntry
          ]
        }

        self.addProcessingMessage();

        IconverseService.customSendMessage(payload)
          .then(function(response){
            self.removeProcessingMessage().then(function(){
              var message = {
                text: response.questions[0].answer
              }
              // ChatEventEmitterService.onMessageReceived(message);
              _conversationLog.push(message);
            })
          })


        return deferred.promise;
      },

      processUserMessage: function (
        text,
        choiceValue,
        element,
        query,
        isAutoTriggered,
        topic,
        subtopic,
        enquiry,
        lang,
        mode,
        messageType
      ) {
        console.log('process user message')
        var self = this;
        var deferred = $q.defer();

        if (CURRENT_STATUS !== STATUSES.IDLE) {
          console.warn('Unable to send new message while VA status is not IDLE');
          return deferred.reject();
        }

        // start tracking idle-ness
        IdleService.startTracking();

        // record the convo
        this.saveConversation(_cid);

        if (!isAutoTriggered) {
          this.addUserMessage(text); // push user message into log
        }

        var tempReplyMsg;

        CURRENT_STATUS = STATUSES.PROCESSING;

        this.getCurrentConversationId()
          .then(function (cid) {
            var msg = self.makeUserMessage(
              text,
              cid,
              choiceValue,
              element,
              query,
              topic,
              subtopic,
              enquiry,
              lang,
              mode,
              isAutoTriggered,
              messageType
            );

            if (!isAutoTriggered) {
              // user triggered
              if (choiceValue) {
                ChatEventEmitterService.onChoiceSelected(msg, choiceValue);
              }
              else {
                ChatEventEmitterService.onMessageSent(msg);
              }
            }

            self.addProcessingMessage();

            return IconverseService.sendMessage(msg);
          })
          .then(function (replyMsg) {
            // this case occurs if the backend doesn't have a enquiry that handles RATE_MESSAGES
            if (
              topic === IconverseService.RATE_MESSAGE.TOPIC
              && replyMsg.text === IconverseService.RATE_MESSAGE.INVALID_TEXT
            ) {
              // resolve without printing to chat log
              throw new Error('Backend does not handle Rate Messages!');
            }

            self.processReplyMessage(replyMsg);

            replyMsg = self.buildMessageParts(replyMsg);

            _cid = replyMsg.cid;

            tempReplyMsg = replyMsg; // note: will be a message object augmented with `parts` built in buildMessageParts

            ChatEventEmitterService.onMessageReceived(replyMsg);

            console.log('replyMsg', replyMsg);

            return self.processMessageParts(replyMsg); // remove the processing message
          })
          .then(function () {
            CURRENT_STATUS = STATUSES.IDLE;

            deferred.resolve(tempReplyMsg); // resolve
          })
          .catch(function (err) {
            console.error(err);

            CURRENT_STATUS = STATUSES.IDLE;

            self
              .removeProcessingMessage() // remove the processing message before rejecting, since controller level handles the error by inserting a message
              .then(function () {
                // self.addSystemMessage(JSON.stringify(err));
                deferred.reject(err);
              });
          });

        return deferred.promise;
      },

      buildMessageParts: function (msg) {
        var self = this;

        var originalMessageCopy = _.cloneDeep(msg);

        // split message up to simulate humanistic chat
        msg.parts = msg.text.split('<hr>').map(function (part) {
          return self.makeSystemMessage(part, msg.cid);
        });

        msg.parts = _.reject(msg.parts, function (parts) {
          return !parts.text;
        });

        // all the payload/elements should go to the last message
        // replace the text of the copy of the original message
        originalMessageCopy.text = msg.parts[msg.parts.length - 1].text;

        // replace the last msg of the parts
        msg.parts.splice(msg.parts.length - 1, 1, originalMessageCopy);

        // set a flag on the first message on a segment
        msg.parts[0].isFirst = true;

        msg.parts[msg.parts.length - 1].isLast = true;

        return msg;
      },

      processMessageParts: function (replyMsgWithParts) {
        // returns a promise series that resolves when messages have been animated in

        // at the last message, also trigger #processReplyMsg
        var self = this;
        var msgParts = replyMsgWithParts.parts;

        return _.reduce(
          msgParts.slice(1, msgParts.length),
          function (promise, nextPart) {
            return promise.then(function () {
              return self.processMessagePart(nextPart);
            });
          },
          self.processMessagePart(msgParts[0])
        );
      },

      processMessagePart: function (msgPart) {
        var self = this;
        // show loader, hide after random delay,
        // add message part into convo log
        // set userHasRead true
        // scroll bottom
        // resolve
        var deferred = $q.defer();

        var typingTime = _.clamp(msgPart.text.length * 15, MAX_TYPING_TIME_MS);

        if (msgPart.isFirst) {
          typingTime = FIRST_MSG_TYPING_TIME_MS;
          // self.addProcessingMessage();
        }

        $timeout(function () {
          self.removeProcessingMessage().then(function () {
            console.log('pushed', msgPart);
            _conversationLog.push(msgPart);
            // indicate that the message is not new (influences animation css classes)
            $timeout(function () {
              msgPart.userHasRead = true;
            }, 1000);

            deferred.resolve(msgPart);
          });
        }, typingTime);

        return deferred.promise;
      },

      immediateProcessMessageParts: function (replyMsgWithParts) {
        var msgParts = replyMsgWithParts.parts;

        for (var i = 0; i < msgParts.length; i++) {
          _conversationLog.push(msgParts[i]);
          msgParts[i].userHasRead = true;
        }
      },

      processReplyMessage: function (replyMsg) {
        // find the latest message with a choices
        if (replyMsg.text !== ICONVERSE_CONFUSED_REPLY_TEXT) {
          var latestChoiceMsg = _.findLast(_conversationLog, function (logItem) {
            return (
              angular.isArray(logItem.choices) && logItem.choices.length && !logItem.choiceSelected
            );
          });
          console.log('latest choice', latestChoiceMsg);
          if (latestChoiceMsg) {
            // set the property on the msg, so the UI will behave accordingly
            latestChoiceMsg.choiceSelected = replyMsg.text;
            console.log('lcset', latestChoiceMsg);
          }
        }

        // -- broadcast event for handling expected variable type --
        // note: we need to handle this here because multiple controllers
        // can call ChatService.processUserMessage > processReplyMsg,
        // and for all cases, chat.controller needs to modify its state
        // so as to trigger Date/Number popups
        $rootScope.$broadcast('chat:expectVariableType', replyMsg);
      },

      openNavigator: function (destination) {
        $state.go('app.navigator', { destination: destination });
      },

      getLatestReplyMessage: function () {
        return _conversationLog[_conversationLog.length - 1];
      },

      getLatestUserMessage: function () {
        return _.findLast(_conversationLog, function (message) {
          return message.source === 'user';
        });
      },

      uploadFile: function (formData) {
        console.log('Call uploadFile');
        formData.append('cid', _cid);
        return IconverseService.uploadFile(formData);
      },

      // LOGIC METHODS
      isMessageWithList: function (message) {
        return angular.isArray(message.links) && message.links.length > 0;
      },

      isMessageWithDetailedContent: function (message) {
        return angular.isObject(message.payload) && message.payload.size > 0;
      },

      isMessageWithWeather: function (message) {
        return (
          angular.isObject(message.payload)
          && message.payload.size === 1
          && message.payload.elements[0].properties.temperatureValue
        );
      },

      isMessageWithAttachment: function (message) {
        return (
          this.isMessageWithList(message)
          || (this.isMessageWithDetailedContent(message)
            && message.variableType !== 'date'
            && message.variableType !== 'number')
        );
      },

      isMessageFromUser: function (message) {
        return message.source === 'user';
      },

      getMessageTypeAndContent: function (message) {
        var content;
        if (this.isMessageWithDetailedContent(message)) {
          content = message.payload.elements; // is an array of detailed content
          return { type: 'DETAILS', content: content };
        }
        if (this.isMessageWithList(message)) {
          content = message.links; // is a list of links
          return { type: 'LINKS', content: content };
        }
      },

      getDateInputLimitsFromMessage: function (message) {
        var limits = _.get(message, 'payload.elements[0].properties');

        if (!limits) {
          return {
            min: new Date(),
            max: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
          };
        }

        // expect the limit object to be like e.g. {min: "2018-07-24T00:27:43.894", max: "2019-06-24T00:27:43.894", values: null}
        return {
          min: limits.min ? new Date(limits.min) : null,
          max: limits.max ? new Date(limits.max) : null,
          values:
            limits.values && limits.values.length
              ? _.map(limits.values, function (val) {
                return new Date(val);
              })
              : null
        };
      },

      getNumberInputLimitsFromMessage: function (message) {
        var limits = _.get(message, 'payload.elements[0].properties');

        if (!limits) return {};

        // expect number limits like: {min: 1, max: 5, step: 1, values: []}
        return {
          min: angular.isNumber(limits.min) ? limits.min : null,
          max: angular.isNumber(limits.max) ? limits.max : null,
          values: limits.values && limits.values.length ? limits.values.length : null,
          step: angular.isNumber(limits.step) ? limits.step : null
        };
      },

      hasConversationStarted: function () {
        return angular.isString(_cid);
      },

      // Handle events passed in from parent context
      handleChatBoxOpened: function () {
        // if the conversation has not started, then start it
        if (!this.hasConversationStarted()) {
          this.startConversation(true);
        }
      },

      // Get conversation log
      getConversationLog: function () {
        return _conversationLog;
      },

      restoreConversationMessages: function (messages) {
        var self = this;

        for (var i = 0; i < messages.length; i++) {
          var replyMsg = messages[i];

          // Do not restore conversation message if it is auto triggered
          if (replyMsg.isAutoTriggered) {
            continue;
          }

          replyMsg = self.buildMessageParts(replyMsg);
          self.immediateProcessMessageParts(replyMsg);
        }
        _cid = messages[messages.length - 1].cid;
        CURRENT_STATUS = STATUSES.IDLE;
      }
    };
  }
}());

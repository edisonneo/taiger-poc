angular
  .module('iconverse')

  .filter('sanitize', [
    '$sce',
    function ($sce) {
      return function (htmlCode) {
        return $sce.trustAsHtml(htmlCode);
      };
    }
  ])

  // NOTE: links should come in as data-trigger="blabla blabla"
  // ONLY SUPPORTS double quotes!!
  .filter('buildLinks', function () {
    return function (str, functionName) {
      if (!str) return;
      var linkList = str.match(/<a data-trigger=".+">.+<\/a>/gi);
      if (linkList) {
        linkList.forEach(function (link) {
          var triggerAttr = link.match(/data-trigger=".+"/i)[0];
          var value = triggerAttr.replace('data-trigger=', '');
          value = value.replace(/\"/g, ''); // remove residual approstrophies
          var newAttr = "ng-click='" + functionName + '("' + value + '")\'';
          str = str.replace(link, link.replace(triggerAttr, newAttr));
        });
      }
      return str;
    };
  })

  .filter('htmlToPlaintext', function () {
    return function (text) {
      // Remove html tags and replace nbsp entities
      // TODO: Find better way to replace all types of html entities
      if (text) {
        var string = String(text)
          .replace(/<[^>]+>/gm, '')
          .replace('&nbsp;', '');
        return string;
      }
      return '';
    };
  })

  // Used to format fight details in PHG. To remove
  .filter('semiColonsToBreaks', function () {
    return function (text) {
      // Remove html tags and replace semis with <br> entities
      if (text) {
        var string = String(text).replace(/;/gm, '<br>');
        return string;
      }
      return '';
    };
  });

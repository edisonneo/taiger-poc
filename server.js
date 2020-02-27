var express = require('express');
var app = express();

//setting middleware
app.use(express.static(__dirname + '/dist')); //Serves resources from public folder


var server = app.listen(4200);

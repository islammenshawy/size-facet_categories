"use strict";
var mappings = require('./size_mappings')
var Excel = require('exceljs');

var workbook2 = new Excel.Workbook();
var workbook = new Excel.Workbook();

var express = require('express')
var app = express()
var tagsSfcCache = undefined;
var sfcsSizeModelCache = undefined;


//set the size facet categories cache
var setSfcCache = function(cache){
  tagsSfcCache = cache;
  console.warn(tagsSfcCache);
};

//set the size facet size model cache
var setSfcSzModelCache = function(cache){
  sfcsSizeModelCache = cache;
  console.warn(sfcsSizeModelCache);
};

mappings.readValidSfcs(workbook, workbook2, setSfcCache, setSfcSzModelCache);

app.get('/sizefacets', function (req, res, next) {
  var pid = req.query.pid;
  var szmodel = req.query.szmodel;
  console.log('Product: ' + pid + ', size model: ' + szmodel);
  var response = mappings.getProductSfcs(pid, szmodel, tagsSfcCache, sfcsSizeModelCache);
  //console.log(response);
  res.set('Content-Type', 'application/json');
  res.send(response);
});


/* Start listening! */
var server = app.listen(8080, function () {
  console.log('Local server running on localhost:' + 8080);
});


/* gracefully shutdown server*/
function shutdown() {
  server.close(function(){
    process.exit();
  }); // socket file is automatically removed here
}

process.on('SIGTERM', shutdown);

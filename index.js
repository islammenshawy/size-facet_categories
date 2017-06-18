"use strict";
var mappings = require('./size_mappings')
var Excel = require('exceljs');
require('console-stamp')(console, '[HH:MM:ss.l]');


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

mappings.loadSfcsCache(workbook, workbook2, setSfcCache, setSfcSzModelCache);

app.get('/sizefacets', function (req, res, next) {
  var pid = req.query.pid;
  var szmodel = req.query.szmodel;
  console.log('Product: ' + pid + ', size model: ' + szmodel);
  var response = mappings.getProductSfcs(pid, szmodel, tagsSfcCache, sfcsSizeModelCache);
  res.set('Content-Type', 'application/json');
  res.send(response);
  next();
});

app.get('/sizefacets/breadcrumbs', function (req, res, next) {
  var pid = req.query.pid;
  var szmodel = req.query.szmodel;
  console.log('Product: ' + pid + ', size model: ' + szmodel);
  var szFctsMappingsBradcrumbs = [];
  var alreadyAddedBreadCrumbs = {};
  var sizeMappings = mappings.getProductSfcs(pid, szmodel, tagsSfcCache, sfcsSizeModelCache);
  for(var mappingObject of sizeMappings){
    var mappingBreadCrumb = mappingObject['sizeFacetBreadCrumb'];
    if(!alreadyAddedBreadCrumbs[mappingBreadCrumb]){
      szFctsMappingsBradcrumbs.push(mappingBreadCrumb);
      alreadyAddedBreadCrumbs[mappingBreadCrumb]=true;
    }
  }
  res.set('Content-Type', 'application/json');
  res.send(szFctsMappingsBradcrumbs);
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

"use strict";
var Excel = require('exceljs');
var request = require('sync-request');

var sfcfilename = __dirname + "/size_facet_categories.xlsx";
var szModelfilename = __dirname + "/size_model_facets_mappings.xlsx"

var i = 1

function getProductSkus(productIdVar){
  var res = request('GET', 'http://oldnavy.gap.com/resources/productStyle/v1/' + productIdVar + '?redirect=true&?isActive=true');
  var availableSizeCodes = {};
  var bodyjson = JSON.parse(res.getBody());
  for(var variant of bodyjson['productStyleV1']['productStyleVariantList']) {
    for(var stylecolor of variant['productStyleColors']){
      for(var sku of stylecolor['productStyleColorSkus']){
        var sizeCode = sku['businessCatalogItemId'].substring(9,13);
        availableSizeCodes[sizeCode] = sizeCode;
      }
    }
  }
  return availableSizeCodes;
}

var getProductTags = function(productIdVar){
  var res = request('GET', 'http://oldnavy.gap.com/resources/productTags/v1/' + productIdVar);
  return JSON.parse(res.getBody());
}

//Function to build the c
function buildSFCsCacheTagKey(departmentTag, productTypeTag, categoryGroupTag){
  var pipe = '|';
  return departmentTag + pipe + productTypeTag + pipe + categoryGroupTag;
}

var getProductSfcs = function(productId, sizeModel, tagsCache, sizeModelCache){
  var tagsJson = getProductTags(productId);
  var results = [];
  var handledSizeModels = {};
  var departmentTag = tagsJson['ProductTags']['DepartmentTags']['value'];
  var productTypeTag = tagsJson['ProductTags']['ProductTypeTags']['value'];
  var categoryGroupTag = tagsJson['ProductTags']['CategoryTags']['value'];
  var tagsKey = buildSFCsCacheTagKey(departmentTag, productTypeTag, categoryGroupTag);
  var validSfcs = tagsCache[tagsKey];
  var validSfcsMap = {};
  for(var sfc of validSfcs){
    validSfcsMap[sfc] = sfc;
  }
  var skus = getProductSkus(productId);
  var sizeModels = sizeModelCache[sizeModel];

  for(var sizeModel of sizeModels){
    var currentSizeCode = sizeModel['sizeCode'];
    var currentSfcId = sizeModel['sfcId'];
    var currentDimension = sizeModel['dimension'];
    if(skus[currentSizeCode] !== undefined
            && validSfcsMap[currentSfcId] !== undefined
                && !handledSizeModels[currentSizeCode + '_' + currentDimension]){
      results.push(sizeModel);
      handledSizeModels[currentSizeCode + '_' + currentDimension] = true;
    }
  }
  return results;
}


//Read valid categories from the json
var readValidSfcs = function(workbook, workbook2, sfcacheCallback, szmodelCacheCallback){
    var tagsCache = {};
    workbook.xlsx.readFile(sfcfilename)
    .then(function() {
      var worksheet = workbook.getWorksheet(i);
      worksheet.eachRow(function(row, rowNumber) {
        var categoryGroupTag = row.getCell('P').value.toString().trim();
        var departmentTag = row.getCell('Q').value.toString().trim();
        var productTypeTag = row.getCell('R').value.toString().trim();
        var rowSfctgId = row.getCell('A').value.toString().trim(); //Category Id Size Facet
        var cacheTagkey = buildSFCsCacheTagKey(departmentTag, productTypeTag, categoryGroupTag);
        var cacheTagValue = tagsCache[cacheTagkey];
        if(cacheTagValue !== undefined){
          var alreadyExists = false;
          for(var currentSfcId of cacheTagValue){
            if(currentSfcId == rowSfctgId){
              alreadyExists = true;
            }
          }
          if(!alreadyExists) {
            cacheTagValue.push(rowSfctgId);
          }
        }
        else{
          var cacheTagValueArray = [];
          cacheTagValueArray.push(rowSfctgId);
          tagsCache[cacheTagkey] = cacheTagValueArray;
        }
      });
      sfcacheCallback(tagsCache);
      readSzModelSzCodeFcts(workbook2, szmodelCacheCallback);
    });
};

function buildSizeModelKey(sizeModel){
  return sizeModel;
}

function readSzModelSzCodeFcts(workbook2, loadCacheCallback){
  workbook2.xlsx.readFile(szModelfilename)
    .then(function() {
      var worksheet = workbook2.getWorksheet(i);
      var sizeModelCache = {};

      worksheet.eachRow(function(row, rowNumber) {
          var rowSizeModel = row.getCell('B').value;
          var rowsizeCode = row.getCell('C').value;
          var dimension = row.getCell('E').value;
          var sfcId = row.getCell('A').value;

          // **** Size facet id/Model cache logic ***
          var cacheKey = buildSizeModelKey(rowSizeModel);
          var cacheValue = sizeModelCache[cacheKey];
          var currentBrdCrumb = buildSizeFacetBreadCrumb(row, rowsizeCode + '_' + dimension);

          //current Row from implementation.
          var currentRow = {};
          currentRow['sfcId'] = sfcId;
          currentRow['sizeCode'] = rowsizeCode;
          currentRow['dimension'] = dimension;
          currentRow['sizeFacetBreadCrumb'] = currentBrdCrumb;

          //Already exists
          if(cacheValue !== undefined){
            var alreadyAdded = false;
            for(var sizeModelCurrent of cacheValue){
              if(JSON.stringify(sizeModelCurrent) == JSON.stringify(currentRow)){
                alreadyAdded = true;
              }
            }
            if(!alreadyAdded){
              cacheValue.push(currentRow);
            }
          }
          else{ //doesn't exist
              var sizeKeyArray = [];
              sizeKeyArray.push(currentRow);
              sizeModelCache[cacheKey] = sizeKeyArray;
          }
      });
      loadCacheCallback(sizeModelCache);
    });

  };

//Function to build the size facet breadCrumb
function buildSizeFacetBreadCrumb(row, sizeCodeWithDimension){
      var sizeFacetWebName = row.getCell('H');
      var sizeFacetDimName = row.getCell('I');
      var variant = row.getCell('M');
      var sizeFacetVar1Selected = row.getCell('K');
      var sizeFacetVar2Selected = row.getCell('L');
      var pipe = '|';
      var key = pipe + sizeFacetWebName + pipe + sizeFacetDimName + pipe
        + variant + pipe + sizeFacetVar1Selected + pipe + sizeFacetVar2Selected + pipe;
      return key;
    };

module.exports = {readValidSfcs, readSzModelSzCodeFcts, getProductSfcs};

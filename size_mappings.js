"use strict";
var Excel = require('exceljs');
var request = require('sync-request');
var sfcfilename = __dirname + "/size_facet_categories.xlsx";
var szModelfilename = __dirname + "/size_model_facets_mappings.xlsx"
var i = 1

//Function to check if element is json array
function isJsonArray(element) {
  return Object.prototype.toString.call(element).trim() == '[object Array]';
}

// function to handle the Json arrays sometimes coming back as objects in service,
// not very clean implementation for the service contract that had to be handled by some logic or custom serializer
function flattenVariantResponse(bodyjson){
  var variants = [];

  if (!isJsonArray(bodyjson['productStyleV1']['productStyleVariantList'])){
    console.log('variants is not an array')
    variants.push(bodyjson['productStyleV1']['productStyleVariantList']);
  }
  else{
    variants = bodyjson['productStyleV1']['productStyleVariantList'];
  }

  for(var variant of variants){
    var stylecolors = [];
    if(!isJsonArray(variant['productStyleColors'])){
      //console.log(JSON.stringify(variants[0]));
      stylecolors.push(variant['productStyleColors']);
      variant['productStyleColors'] = stylecolors;
    }
    else{
      stylecolors = variant['productStyleColors'];
    }

    //Handle stylecolor SKUs
    for(var stylecolor of stylecolors){
      var skusSizeCodes = [];
      if(!isJsonArray(stylecolor['productStyleColorSkus'])){
        skusSizeCodes.push(stylecolor['productStyleColorSkus']);
        variant['productStyleColors']['productStyleColorSkus'] = skusSizeCodes;
      }
    }
  }
  return variants;
}

/**
** Function to query product skus from the product style service
**/
function getProductSkus(productIdVar){
  var res = request('GET', 'http://oldnavy.gap.com/resources/productStyle/v1/' + productIdVar + '?redirect=true&isActive=true');
  var availableSizeCodes = {};
  var bodyjson = JSON.parse(res.getBody());
  var variants = flattenVariantResponse(bodyjson);

  // Loop on response to get the size code from SKUs
  for(var variant of variants) {
    for(var stylecolor of variant['productStyleColors']){
      if(stylecolor['isInStock'] == 'true'){
        for(var sku of stylecolor['productStyleColorSkus']){
          if(sku['inventoryStatusId'] == '0'){
            var sizeCode = sku['businessCatalogItemId'].substring(9,13);
            availableSizeCodes[sizeCode] = sizeCode;
          }
        }
      }
    }
  }
  return availableSizeCodes;
}

/**
** Function to hit product tags API and get the response for a product
**/
var getProductTags = function(productIdVar){
  var res = request('GET', 'http://oldnavy.gap.com/resources/productTags/v1/' + productIdVar);
  return JSON.parse(res.getBody());
}

/**
** Function to build the cache key for sfcs
**/
function buildSFCsCacheTagKey(departmentTag, productTypeTag, categoryGroupTag){
  var pipe = '|';
  return departmentTag + pipe + productTypeTag + pipe + categoryGroupTag;
}

/**
** Function to build the products sfcs from the cache
**/
var getProductSfcs = function(productId, sizeModel, tagsCache, sizeModelCache){
  console.log('Start: Query style tags');
  var tagsJson = getProductTags(productId);
  console.log('End: Query style tags');

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
  console.log('Start: Query Skus ');
  var skus = getProductSkus(productId);
  console.log('End: Query Skus ');
  var sizeModels = sizeModelCache[sizeModel];

  console.log('Start: Size Model loop Skus ');
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
  console.log('End: Size Model loop Skus ');

  return results;
}


/**
** Function to load the size facet categories cache from the excel sheet.
**/
var loadSfcsCache = function(workbook, workbook2, sfcacheCallback, szmodelCacheCallback){
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
      loadSzModelSzCodeFctsCache(workbook2, szmodelCacheCallback);
    });
};

function buildSizeModelKey(sizeModel){
  return sizeModel;
}

/**
** Function to load the size code facets cache
**/
function loadSzModelSzCodeFctsCache(workbook2, loadCacheCallback){
  workbook2.xlsx.readFile(szModelfilename)
    .then(function() {
      var worksheet = workbook2.getWorksheet(i);
      var sizeModelCache = {};

      worksheet.eachRow(function(row, rowNumber) {
          var rowSizeModel = row.getCell('B').value;
          var rowsizeCode = row.getCell('C').value;
          var rowsizeFacetName = row.getCell('G').value;
          var dimension = row.getCell('E').value;
          var sfcId = row.getCell('A').value;

          // **** Size facet id/Model cache logic ***
          var cacheKey = buildSizeModelKey(rowSizeModel);
          var cacheValue = sizeModelCache[cacheKey];
          var currentBrdCrumb = buildSizeFacetBreadCrumb(row);

          //current Row from implementation.
          var currentRow = {};
          currentRow['sfcId'] = sfcId;
          currentRow['sizeCode'] = rowsizeCode;
          currentRow['sizeFacetName'] = rowsizeFacetName;
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

/**
** Function to build the size facet breadCrumb
**/
function buildSizeFacetBreadCrumb(row){
      var sizeFacetWebName = row.getCell('H');
      var sizeFacetDimName = row.getCell('I');
      var variant = row.getCell('M');
      var dimension = row.getCell('E');
      var sizeFacetVar1Selected = row.getCell('K');
      var sizeFacetVar2Selected = row.getCell('L');
      var pipe = '|';
      var key = pipe + sizeFacetWebName + pipe + sizeFacetDimName + pipe
        + variant + pipe + sizeFacetVar1Selected + pipe + sizeFacetVar2Selected
        + pipe + 'Dim_' +dimension + pipe;
      return key;
    };

module.exports = {loadSfcsCache, loadSzModelSzCodeFctsCache, getProductSfcs};

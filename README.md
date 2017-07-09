# Size Facet Categories Service
This service is purposed to outline the process of compiling the size facets mappings for products based on the size facet query from the oracle tools DB into excel sheets that will be utilized as a cache.

The service will use product style (First 6 digits of any product from the brand website) and size model (Available in the product feed) to compile the valid size facet categories for a specific style by mapping this information on the SKU level. Each in stock SKU will have 2 dimensions and each dimension maps to a SFC that will be represented by a breadcrumb.

## Getting Started
These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. Also the service is deployed cloud foundry to help test products.

### Prerequisites for running in local
```
install node v6.10.3
run using command: node index.js
```
### Hitting service end points
In Local you can use the below urls to compile the size codes for a style.

* All size facets for a style: http://localhost:8080/sizefacets?pid=${productStyle}&szmodel=${sizeModel}
* Filter only sfc breadcrumbs: http://localhost:8080/sizefacets/breadcrumbs?pid=${productStyle}&szmodel=${sizeModel}

### Examples from the cloud instance
* http://sfc-validator.cfapps.io/sizefacets?pid=604325&szmodel=M38
* http://sfc-validator.cfapps.io/sizefacets/breadcrumbs?pid=604325&szmodel=M38

(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
angular.module('ngFormioGrid', [
  'formio',
  'ngSanitize',
  'ui.grid',
  'ui.grid.pagination',
  'ui.grid.resizeColumns',
  'ui.grid.autoResize',
  'angular-bind-html-compile'
])
.directive('formioGrid', function() {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      src: '=',
      query: '=?',
      columns: '=?',
      buttons: '=?',
      gridOptions: '=?'
    },
    template: '<div><div ui-grid="gridOptionsDef" ui-grid-pagination ui-grid-auto-resize ui-grid-resize-columns ui-grid-move-columns class="grid"></div></div>',
    controller: [
      '$scope',
      '$element',
      '$timeout',
      'Formio',
      'formioComponents',
      'FormioUtils',
      'uiGridConstants',
      '$http',
      function(
        $scope,
        $element,
        $timeout,
        Formio,
        formioComponents,
        FormioUtils,
        uiGridConstants,
        $http
      ) {
        var formio = null;
        var paginationOptions = {
          pageNumber: 1,
          pageSize: 25,
          sort: null
        };

        $scope.gridOptionsDef = angular.merge({
          namespace: 'row',
          dataRoot: 'data.',
          endpoint: '',
          paginationPageSizes: [25, 50, 75],
          paginationPageSize: paginationOptions.pageSize,
          enableHorizontalScrollbar: uiGridConstants.scrollbars.NEVER,
          enableVerticalScrollbar: uiGridConstants.scrollbars.NEVER,
          useExternalPagination: true,
          useExternalSorting: true,
          columnDefs: [],
          data: [],
          onRegisterApi: function(gridApi) {
            $scope.gridApi = gridApi;
            gridApi.pagination.on.paginationChanged($scope, function(newPage, pageSize) {
              paginationOptions.pageNumber = newPage;
              paginationOptions.pageSize = pageSize;
              getPage();
            });
            // Ui Grid External sort code.
            gridApi.core.on.sortChanged($scope,function(grid, sortColumns) {
              if (sortColumns.length === 0) {
                paginationOptions.sort = null;
              } else {
                switch(sortColumns[0].sort.direction) {
                  case uiGridConstants.ASC:
                    paginationOptions.sort = sortColumns[0].colDef.field;
                    break;
                  case uiGridConstants.DESC:
                    paginationOptions.sort = '-'+sortColumns[0].colDef.field;
                    break;
                  case undefined:
                    paginationOptions.sort = null;
                    break;
                }
              }
              getPage();
            });
          }
        }, $scope.gridOptions);
        paginationOptions.pageSize = $scope.gridOptionsDef.paginationPageSize;

        $scope.buttons = $scope.buttons ||  [{
            id: 'view',
            key: 'view',
            event: $scope.gridOptionsDef.namespace + 'View',
            label: '',
            width: 35,
            icon: 'glyphicon glyphicon-share-alt'
          }];

        $scope.buttonClick = function(event, entity) {
          $scope.$emit(event, entity);
        };

        if (angular.isUndefined($scope.query)) {
          $scope.query = {};
        }

        var getPage = function() {
          if (!formio) { return; }
          if (!$scope.gridOptionsDef.columnDefs.length) { return; }
          if (paginationOptions.pageSize) {
            $scope.query.limit = paginationOptions.pageSize;
          }
          if (paginationOptions.pageNumber) {
            $scope.query.skip = (paginationOptions.pageNumber - 1) * paginationOptions.pageSize;
          }
          
          $scope.query.sort = paginationOptions.sort;

          if ($scope.gridOptionsDef.endpoint) {
            var endpoint = $scope.gridOptionsDef.endpoint;
            var serialize = function(obj) {
              var str = [];
              for(var p in obj)
                if (obj.hasOwnProperty(p)) {
                  str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
                }
              return str.join("&");
            };
            if ($scope.query) {
              var query = serialize($scope.query);
              if (query) {
                endpoint += ('?' + query);
              }
            }
            $http.get(endpoint, {
              headers: {
                'x-jwt-token': Formio.getToken()
              }
            }).then(function successCallback(response) {
              $scope.gridOptionsDef.data = response.data;
              setTableHeight(response.data.length);
            }, function errorCallback(response) {
              console.log('Error: ' + response.message);
            });
          }
          else {
            formio.loadSubmissions({params: $scope.query}).then(function(submissions) {
              $scope.gridOptionsDef.totalItems = submissions.serverCount;
              $scope.gridOptionsDef.data = submissions;
              setTableHeight(submissions.length);
            });
          }
        };

        var setTableHeight = function(renderableRows) {
          $timeout(function() {
            var newHeight = ($scope.gridApi.grid.getVisibleRowCount() * 27) + 85;
            angular.element($element).children().css('height', newHeight + 'px');
          }, 10);
          return renderableRows;
        };

        // Load a new grid view.
        var loadGrid = function() {
          if (!$scope.src) { return; }
          formio = new Formio($scope.src);
          formio.loadForm().then(function(form) {

            var names = {};
            var increment = 1;
            $scope.gridOptionsDef.columnDefs = ($scope.gridOptions && $scope.gridOptions.columnDefs ? angular.copy($scope.gridOptions.columnDefs) : []);
            $scope.buttons.forEach(function(button) {
              var btnClass = button.class || 'btn btn-sm btn-default';
              names[button.label] = true;
              $scope.gridOptionsDef.columnDefs.unshift({
                name: button.label,
                field: button.key,
                width: button.width,
                cellTemplate: '<a class="' + btnClass + '" ng-click="grid.appScope.buttonClick(\'' + button.event + '\', row.entity)"><span class="' + button.icon + '" aria-hidden="true"></span>' + button.label + '</a>'
              });
            });

            var addColumn = function(component, column) {
              // Ensure that the labels do not collide.
              var label;
              if (column && column.label) {
                label = column.label;
              }
              else {
                label = component.label || component.key;
              }

              while (names.hasOwnProperty(label)) {
                label = component.label + increment++;
              }

              names[label] = true;
              $scope.gridOptionsDef.columnDefs.push({
                component: component,
                name: label,
                field: $scope.gridOptionsDef.dataRoot + component.key,
                cellTemplate: '<div class="ui-grid-cell-contents" bind-html-compile="COL_FIELD | tableFieldView:this.col.colDef.component"></div>'
              });
            };

            if ($scope.columns && $scope.columns.length > 0) {
              var components = FormioUtils.flattenComponents(form.components);
              var column;
              $scope.columns.forEach(function(key) {
                // Pass in either column key or column def
                if (typeof key === 'object') {
                  column = key;
                  key = column.key;
                }
                else {
                  column = false;
                }
                if (components.hasOwnProperty(key)) {
                  addColumn(components[key], column);
                }
              });
            }
            else {
              FormioUtils.eachComponent(form.components, function(component) {
                if (component.input && component.tableView && component.key) {
                  addColumn(component);
                }
              });
            }

            getPage();
          });
        };

        $scope.$on('reloadGrid', function(event, src, query) {
          if (src) {
            $scope.src = src;
          }
          if (query) {
            $scope.query = query;
          }
          loadGrid();
        });

        loadGrid();
      }
    ]
  };
});

},{}]},{},[1]);

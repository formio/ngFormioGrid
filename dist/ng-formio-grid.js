(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
angular.module('ngFormioGrid', [
  'formio',
  'ngSanitize',
  'ui.grid',
  'ui.grid.pagination',
  'ui.grid.resizeColumns',
  'ui.grid.autoResize',
  'ui.grid.selection',
  'ui.grid.edit',
  'ui.grid.cellNav'
])
.directive('formioGridCell', ['$compile', 'formioTableView', function ($compile, formioTableView) {
  return {
    restrict: 'E',
    scope: {
      data: '=',
      component: '='
    },
    link: function (scope, element) {
      scope.$watch('data', function(data) {
        var html = formioTableView(data, scope.component);
        if (Array.isArray(html)) {
          html = html.join(', ');
        }
        element.html(html);
      });
    }
  };
}])
.directive('formioGrid', ['$compile', function($compile) {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      src: '=',
      service: '=?',
      query: '=?',
      aggregate: '=?',
      columns: '=?',
      buttons: '=?',
      gridOptions: '=?',
      gridApi: '=?',
      limit: '=?'
    },
    link: function(scope, element, attrs) {
      var template = '<div ui-grid="gridOptionsDef" ui-grid-pagination ui-grid-auto-resize ui-grid-resize-columns ui-grid-move-columns ui-grid-selection class="grid"></div>';
      if (scope.gridOptions) {
        if (scope.gridOptions.enableCellEdit) {
          template = '<div ui-grid="gridOptionsDef" ui-grid-pagination ui-grid-auto-resize ui-grid-resize-columns ui-grid-move-columns ui-grid-edit ui-grid-cellNav class="grid"></div>';
        }
      }
      element.html(template).show();
      $compile(element.contents())(scope);
    },
    template: '<div></div>',
    controller: [
      '$scope',
      '$element',
      '$timeout',
      'Formio',
      'formioComponents',
      'FormioUtils',
      'uiGridConstants',
      '$http',
      '$q',
      function(
        $scope,
        $element,
        $timeout,
        Formio,
        formioComponents,
        FormioUtils,
        uiGridConstants,
        $http,
        $q
      ) {
        var ready = $q.defer();
        var loadReady = ready.promise;
        var formio = $scope.service || null;
        var paginationOptions = {
          pageNumber: 1,
          pageSize: 25,
          sort: null
        };
        if ($scope.query && $scope.query.sort) {
          paginationOptions.sort = $scope.query.sort;
        }

        var gridColumns = {};
        var setupGridColumns = function() {
          // Setup the grid columns.
          gridColumns = $scope.columns;
          if (Array.isArray($scope.columns)) {
            gridColumns = {};
            $scope.columns.forEach(function(key) {
              if (typeof key === 'string') {
                gridColumns[key] = {};
              }
              else {
                gridColumns[key.key] = key;
              }
            });
          }
        };
        setupGridColumns();

        var setSort = function(sort, field) {
          switch(sort.direction) {
            case uiGridConstants.ASC:
              paginationOptions.sort = field;
              break;
            case uiGridConstants.DESC:
              paginationOptions.sort = '-' + field;
              break;
            case undefined:
              paginationOptions.sort = null;
              break;
          }
        };

        var setLoading = function(loading) {
          var loaderElement = angular.element('.ui-grid-contents-wrapper .ui-grid-loader', $element);
          if (loading && (loaderElement.length == 0)) {
            var loader = '<i style="font-size:2em;position:absolute;z-index:200;left: 50%;top:50%;margin-left:-1em;margin-top:-1em;" class="ui-grid-loader glyphicon glyphicon-refresh glyphicon-spin"></i>';
            angular.element('.ui-grid-contents-wrapper', $element).prepend(loader);
          }
          else if (loaderElement.length) {
            loaderElement.remove();
          }
        };

        $scope.gridOptionsDef = angular.extend({
          namespace: 'row',
          dataRoot: 'data.',
          responseData: '',
          responseTotal: '',
          endpoint: '',
          paginationPageSizes: [25, 50, 75],
          paginationPageSize: paginationOptions.pageSize,
          enableHorizontalScrollbar: uiGridConstants.scrollbars.NEVER,
          enableVerticalScrollbar: uiGridConstants.scrollbars.NEVER,
          useExternalPagination: true,
          useExternalSorting: true,
          enableCellEdit: false,
          enableCellEditOnFocus: false,
          enableRowSelection: true,
          enableRowHeaderSelection: false,
          enableFiltering: true,
          useExternalFiltering: true,
          multiSelect: false,
          loadOptions: null,
          columnDefs: [],
          data: [],
          initialLoad: true,
          onRegisterApi: function(gridApi) {
            $scope.gridApi = gridApi;
            gridApi.pagination.on.paginationChanged($scope, function(newPage, pageSize) {
              paginationOptions.pageNumber = newPage;
              paginationOptions.pageSize = pageSize;
              getPage();
            });

            // Say we are now loading.
            gridApi.core.on.renderingComplete($scope, function() {
              setLoading(true);
              (function launchDefaultValues() {
                if($scope.gridOptions && $scope.gridOptions.sort){
                  setSort($scope.gridOptions.sort, $scope.gridOptions.sort.defaultCol);
                }
              })();

            });

            var debounce = 0;
            gridApi.core.on.filterChanged($scope, function() {
              var grid = this.grid;
              if (debounce) {
                clearTimeout(debounce);
              }
              debounce = setTimeout(function() {
                grid.columns.forEach(function(column) {
                  var term = '';
                  if (column.filters && column.filters.length > 0) {
                    term = column.filters[0].term;
                  }
                  var filter = column.colDef.filterField || column.colDef.filter || column.colDef.field;
                  if (!filter) {
                    return;
                  }
                  if (typeof filter === 'function') {
                    filter($scope.query, term);
                  }
                  else if (typeof filter === 'object') {
                    if (filter.type === 'select') {
                      if (typeof term === 'boolean') {
                        // Add boolean term to the query.
                        $scope.query[column.colDef.field] = term;
                      }
                      else if (term) {
                        // Add the term to the query.
                        $scope.query[column.colDef.field] = term;
                      }
                      else {
                        delete $scope.query[column.colDef.field];
                      }
                    }
                  }
                  else {
                    if (term) {

                      // Add the term to the query.
                      // FOR-652
                      $scope.query[filter + '__regex'] = '/' + FormioUtils.escapeRegExCharacters(term) + '/i';
                    }
                    else {

                      // Remove this from the query.
                      delete $scope.query[filter + '__regex'];
                    }
                  }
                });
                gridApi.pagination.seek(1);
                getPage();
              }, 500);
            });

            //Identifying if the first row of the grid loaded
            var firstRow = true;
            gridApi.core.on.rowsRendered($scope, function() {
                if (gridApi.grid.renderContainers.body.visibleRowCache.length === 0) { return; }
                $scope.$emit("onGridLoadDone");
                firstRow = false;
            });

            if (gridApi.selection) {
              // When the row is selected, emit an event.
              gridApi.selection.on.rowSelectionChanged($scope, function(row){
                $scope.$emit($scope.gridOptionsDef.namespace + 'Select', row.entity, row.isSelected);
              });

              gridApi.selection.on.rowSelectionChangedBatch($scope, function(rows) {
                var isSelected = rows.length ? rows[0].isSelected : false;
                $scope.$emit($scope.gridOptionsDef.namespace + 'SelectAll', rows, isSelected);
              });
            }

            if (gridApi.edit) {
              gridApi.edit.on.afterCellEdit($scope,function(rowEntity, colDef, newValue, oldValue){
                $scope.$emit($scope.gridOptionsDef.namespace + 'CellEdit', rowEntity, colDef, newValue, oldValue);
                $scope.$apply();
              });
            }

            // Ui Grid External sort code.
            gridApi.core.on.sortChanged($scope,function(grid, sortColumns) {
              if (sortColumns.length === 0) {
                paginationOptions.sort = null;
              } else {
                var lastIndex = sortColumns.length - 1;
                setSort(sortColumns[lastIndex].sort, sortColumns[lastIndex].colDef.sortField || sortColumns[lastIndex].colDef.field);
              }
              gridApi.pagination.seek(1);
              getPage();
            });
          }
        }, $scope.gridOptions);

        paginationOptions.pageSize = $scope.gridOptionsDef.paginationPageSize;

        $scope.buttons = $scope.buttons ||  [];

        $scope.buttonClick = function(event, row) {
          $scope.$emit(event, row.entity, row);
        };

        if (angular.isUndefined($scope.query)) {
          $scope.query = {};
        }

        var getPage = function(_query) {
          loadReady.then(function() {
            // Set the column definitions to the ones provided.
            if ($scope.gridOptions && $scope.gridOptions.columnDefs) {
              $scope.gridOptionsDef.columnDefs = $scope.gridOptions.columnDefs;
            }

            //if (!$scope.gridOptionsDef.columnDefs.length) { return; }
            if (paginationOptions.pageSize) {
              if($scope.limit){
                $scope.query.limit = $scope.limit
              }
              else{
                $scope.query.limit = paginationOptions.pageSize;
              }
            }
            if (paginationOptions.pageNumber) {
              $scope.query.skip = (paginationOptions.pageNumber - 1) * paginationOptions.pageSize;
            }

            if (paginationOptions.sort) {
              $scope.query.sort = paginationOptions.sort;
            }

            if ($scope.gridOptionsDef.endpoint) {
              var endpoint = $scope.gridOptionsDef.endpoint;
              var request = {
                headers: {
                  'x-jwt-token': Formio.getToken()
                }
              };
              // Support aggregation framework.
              if ($scope.aggregate) {
                // Convert sort, limit and skip to aggregate functions.
                var query = _query ? _query : angular.copy($scope.aggregate);
                var matchQuery = {};

                // Find all match queries.
                angular.forEach($scope.query, function(value, key) {
                  if (key.indexOf('data.') === 0) {
                    if (key.indexOf('__regex') !== -1) {
                      var regExValue = value.match(/\/([^\/]+)\//);
                      regExValue = (regExValue && regExValue.length > 1) ? regExValue[1] : '';
                      if (regExValue) {
                        matchQuery[key.replace('__regex', '')] = {'$regex': regExValue, '$options': 'i'};
                      }
                    }
                    else {
                      matchQuery[key] = value;
                    }
                  }
                });
                if (Object.keys(matchQuery).length > 0) {
                  query.push({'$match': matchQuery});
                }

                if ($scope.query.sort) {
                  var sort = { '$sort' : {}};
                  if ($scope.query.sort.charAt(0) === '-') {
                    var field = $scope.query.sort.slice(1);
                    sort['$sort'][field] = -1;
                    query.push(sort);
                  }
                  else {
                    sort['$sort'][$scope.query.sort] = 1;
                    query.push(sort);
                  }
                }
                if ($scope.query.limit) {
                  query.push({ '$limit' : $scope.query.limit });
                }
                if ($scope.query.skip) {
                  query.push({ '$skip' : $scope.query.skip });
                }

                request.headers['x-query'] = JSON.stringify(query);
              }
              else {
                request.params = _query ? _query : $scope.query;
              }

              $scope.$emit("onRequest", query || request.params);
              $scope.$emit('onRequest:' + $scope.gridOptionsDef.namespace, query || request.params);
              $http.get(endpoint, request).then(function successCallback(response) {
                if (!response.data) {
                  response.data = [];
                }
                var range = response.headers('Content-Range');
                if (range) {
                  range = range.split('/');
                  if ((range.length > 1) && (range[1] != '*')) {
                    $scope.gridOptionsDef.totalItems = Number(range[1]);
                  }
                }
                if ($scope.gridOptionsDef.responseData) {
                  $scope.gridOptionsDef.data = response.data[$scope.gridOptionsDef.responseData];
                }
                else {
                  $scope.gridOptionsDef.data = response.data ? response.data : [];
                }
                if ($scope.gridOptionsDef.responseTotal) {
                  $scope.gridOptionsDef.totalItems = response.data[$scope.gridOptionsDef.responseTotal];
                }
                setTableHeight(response.data.length);
                setLoading(false);
                $scope.$emit("onData", response.data);
                $scope.$emit('onData:' + $scope.gridOptionsDef.namespace, response.data);
              }, function errorCallback(response) {
                console.log('Error: ' + response.message);
              });
            }
            else {
              if (!formio) {
                setLoading(false);
                return;
              }
              $scope.gridOptionsDef.data = [];
              $scope.$emit("onRequest", $scope.query);
              $scope.$emit('onRequest:' + $scope.gridOptionsDef.namespace, $scope.query);
              formio.loadSubmissions({params: $scope.query}, $scope.gridOptionsDef.loadOptions).then(function(submissions) {
                $scope.gridOptionsDef.totalItems = submissions.serverCount;
                $scope.gridOptionsDef.data = submissions;
                setTableHeight(submissions.length);
                setLoading(false);
                $scope.$emit("onData", submissions);
                $scope.$emit('onData:' + $scope.gridOptionsDef.namespace, submissions);
              });
            }
          });
        };

        var setTableHeight = function(renderableRows) {
          $timeout(function() {
            var newHeight = ($scope.gridOptions && $scope.gridOptions.height) ? $scope.gridOptions.height : ($scope.gridApi.grid.getVisibleRowCount() * 30) + 100;
            angular.element('.grid', $element).height(newHeight);
          }, 10);
          return renderableRows;
        };

        /**
         * Setup the data grid for a form (if provided)
         * @param form
         */
        var setupGrid = function(form) {

          // Setup the grid columns again.
          setupGridColumns();

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
              enableFiltering: false,
              cellTemplate: '<a class="' + btnClass + '" ng-click="grid.appScope.buttonClick(\'' + button.event + '\', row)"><span class="' + button.icon + '" aria-hidden="true"></span>' + button.label + '</a>'
            });
          });

          var columnIndex = 0;
          var addColumn = function(component, options, key) {
            options = options || {};

            // Default the first column to be a link unless they say otherwise.
            if (columnIndex === 0 && !options.hasOwnProperty('link')) {
              options.link = true;
            }

            // Ensure that the labels do not collide.
            var label = '';
            if (options.hasOwnProperty('label')) {
              label = options.label;
            }
            else if (component) {
              label = component.label || component.key;
              while (names.hasOwnProperty(label)) {
                label = component.label + increment++;
              }
            }

            names[label] = true;

            var template = options.template || '<formio-grid-cell class="ui-grid-cell-contents" data="COL_FIELD" component="col.colDef.component"></formio-grid-cell>';
            if (options.link) {
              var linkClass = options.linkClass;
              var linkEvent = options.linkEvent || ($scope.gridOptionsDef.namespace + 'View');
              template = '<a class="' + linkClass + '" style="cursor:pointer;" ng-click="grid.appScope.buttonClick(\'' + linkEvent + '\', row)">' + template + '</a>';
            }

            var field = options.field;
            if (!options.field) {
              field = component ? ($scope.gridOptionsDef.dataRoot + component.key) : key;
            }

            // Setup the column.
            var column = {
              component: component,
              name: label,
              field: field,
              cellTemplate: template,
              form: form,
              enableCellEdit: !!options.enableCellEdit,
              enableFiltering: !!options.enableFiltering
            };

            // Allow for other options.
            [
              'sort',
              'sortField',
              'filterField',
              'filter',
              'width',
              'sortable',
              'visible',
              'minWidth',
              'maxWidth',
              'resizable',
              'cellClass',
              'headerCellClass',
              'headerCellTemplate',
              'displayName'
            ].forEach(function(option) {
              if (options.hasOwnProperty(option)) {
                column[option] = options[option];
              }
            });

            // Add the column to the grid.
            $scope.gridOptionsDef.columnDefs.push(column);
            columnIndex++;
          };

          if (gridColumns && (Object.keys(gridColumns).length > 0)) {
            var components = form ? FormioUtils.flattenComponents(form.components) : {};
            angular.forEach(gridColumns, function(options, key) {
              if (options.sort && options.sort.direction) {
                var field = components.hasOwnProperty(key) ? 'data.' + key : key;
                setSort(options.sort, options.field || field);
              }

              addColumn(components[key] || options.component, options, key);
            });
          }
          else if (form) {
            FormioUtils.eachComponent(form.components, function(component) {
              if (component.input && component.tableView && component.key) {
                addColumn(component);
              }
            });
          }

          // Only get the page if the initialLoad variable is true.
          ready.resolve();
          if ($scope.gridOptionsDef.initialLoad) {
            getPage();
          }

          // Always make sure that next loads pass through.
          $scope.gridOptionsDef.initialLoad = true;
          $scope.$emit('onGridReady');
          $scope.$emit('onGridReady:' + $scope.gridOptionsDef.namespace);
        };

        // Load a new grid view.
        var loadGrid = function() {
          // If no source, things should be set up manually.
          if (!$scope.src) {
            setupGrid();
            return;
          }
          formio = new Formio($scope.src);
          formio.loadForm().then(setupGrid);
        };

        var selectRow = function(record) {
          if (!$scope.gridOptionsDef.enableRowSelection) {
            return;
          }
          if (typeof record === 'string') {
            angular.forEach($scope.gridOptionsDef.data, function(item) {
              if (item._id.toString() === record) {
                $scope.gridApi.selection.selectRow(item);
              }
            });
          }
          else {
            $scope.gridApi.selection.selectRow(record);
          }
        };

        var refreshGrid = function(query) {
          setLoading(true);
          if (query) {
            $scope.query = query;
          }
          getPage(query);
        };
        var reloadGrid = function(src, query) {
          if (src) {
            $scope.src = src;
          }
          if (query) {
            $scope.query = query;
          }
          setLoading(true);
          loadGrid();
        };

        $scope.$on('selectGridRow:' + $scope.gridOptionsDef.namespace, function (event, record) {
          selectRow(record);
        });

        $scope.$on('selectGridRow', function (event, record) {
          selectRow(record);
        });

        $scope.$on('reloadGrid:' + $scope.gridOptionsDef.namespace, function(event, src, query) {
          reloadGrid(src, query);
        });

        $scope.$on('reloadGrid', function(event, src, query) {
          reloadGrid(src, query);
        });

        $scope.$on('refreshGrid:' + $scope.gridOptionsDef.namespace, function(event, query) {
          refreshGrid(query);
        });

        $scope.$on('setLoading', function(event, loading) {
          setLoading(loading);
        });

        $scope.$on('refreshGrid', function(event, query) {
          refreshGrid(query);
        });

        $scope.$on('adjustHeight', function(event, numRows) {
          setTableHeight(numRows);
        });

        loadGrid();
      }
    ]
  };
}]);

},{}]},{},[1]);

angular.module('ngFormioGrid', [
  'formio',
  'ngSanitize',
  'ui.grid',
  'ui.grid.pagination',
  'ui.grid.resizeColumns',
  'ui.grid.autoResize',
  'ui.grid.selection'
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
.directive('formioGrid', function() {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      src: '=',
      query: '=?',
      aggregate: '=?',
      columns: '=?',
      buttons: '=?',
      gridOptions: '=?'
    },
    template: '<div><div ui-grid="gridOptionsDef" ui-grid-pagination ui-grid-auto-resize ui-grid-resize-columns ui-grid-move-columns ui-grid-selection class="grid"></div></div>',
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

        $scope.gridOptionsDef = angular.merge({
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
          enableRowSelection: false,
          enableRowHeaderSelection: false,
          enableFiltering: true,
          useExternalFiltering: true,
          multiSelect: false,
          columnDefs: [],
          data: [],
          onRegisterApi: function(gridApi) {
            $scope.gridApi = gridApi;
            gridApi.pagination.on.paginationChanged($scope, function(newPage, pageSize) {
              paginationOptions.pageNumber = newPage;
              paginationOptions.pageSize = pageSize;
              getPage();
            });

            var debounce = 0;
            gridApi.core.on.filterChanged($scope, function() {
              var grid = this.grid;
              if (debounce) {
                clearTimeout(debounce);
              }
              debounce = setTimeout(function() {
                grid.columns.forEach(function(column) {
                  if (
                    !column.colDef ||
                    !column.colDef.component ||
                    !column.colDef.component.key
                  ) {
                    return;
                  }
                  var term = '';
                  if (column.filters && column.filters.length > 0) {
                    term = column.filters[0].term;
                  }
                  var filterField = column.colDef.filterField || ('data.' + column.colDef.component.key);
                  if (term) {

                    // Add the term to the query.
                    $scope.query[filterField + '__regex'] = '/' + term + '/i';
                  }
                  else {

                    // Remove this from the query.
                    delete $scope.query[filterField + '__regex'];
                  }
                });
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

            // When the row is selected, emit an event.
            gridApi.selection.on.rowSelectionChanged($scope, function(row){
              $scope.$emit($scope.gridOptionsDef.namespace + 'Select', row.entity, row.isSelected);
            });

            // Ui Grid External sort code.
            gridApi.core.on.sortChanged($scope,function(grid, sortColumns) {
              if (sortColumns.length === 0) {
                paginationOptions.sort = null;
              } else {
                setSort(sortColumns[0].sort, sortColumns[0].colDef.field);
              }
              getPage();
            });
          }
        }, $scope.gridOptions);

        // Make the passed row in parameter selected.
        $scope.$on('selectGridRow', function (event, record) {
          $scope.gridApi.selection.selectRow(record);
        });

        paginationOptions.pageSize = $scope.gridOptionsDef.paginationPageSize;

        $scope.buttons = $scope.buttons ||  [];

        $scope.buttonClick = function(event, entity) {
          $scope.$emit(event, entity);
        };

        if (angular.isUndefined($scope.query)) {
          $scope.query = {};
        }

        var getPage = function() {
          // Set the column definitions to the ones provided.
          if ($scope.gridOptions && $scope.gridOptions.columnDefs) {
            $scope.gridOptionsDef.columnDefs = $scope.gridOptions.columnDefs;
          }

          //if (!$scope.gridOptionsDef.columnDefs.length) { return; }
          if (paginationOptions.pageSize) {
            $scope.query.limit = paginationOptions.pageSize;
          }
          if (paginationOptions.pageNumber) {
            $scope.query.skip = (paginationOptions.pageNumber - 1) * paginationOptions.pageSize;
          }

          $scope.query.sort = paginationOptions.sort;

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
              var query = angular.copy($scope.aggregate);
              var matchQuery = {};

              // Find all match queries.
              angular.forEach($scope.query, function(value, key) {
                if (key.indexOf('data.') === 0) {
                  var regExValue = value.match(/\/([^\/]+)\//);
                  regExValue = (regExValue && regExValue.length > 1) ? regExValue[1] : '';
                  if (regExValue) {
                    matchQuery[key.replace('__regex', '')] = {'$regex': regExValue, '$options': 'i'};
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
              request.params = $scope.query;
            }

            $http.get(endpoint, request).then(function successCallback(response) {
              if ($scope.gridOptionsDef.responseData) {
                $scope.gridOptionsDef.data = response.data[$scope.gridOptionsDef.responseData];
              }
              else {
                $scope.gridOptionsDef.data = response.data;
              }
              if ($scope.gridOptionsDef.responseTotal) {
                $scope.gridOptionsDef.totalItems = response.data[$scope.gridOptionsDef.responseTotal];
              }
              setTableHeight(response.data.length);
              $scope.$emit("onData", response.data);
            }, function errorCallback(response) {
              console.log('Error: ' + response.message);
            });
          }
          else {
            if (!formio) { return; }
            $scope.gridOptionsDef.data = [];
            formio.loadSubmissions({params: $scope.query}).then(function(submissions) {
              $scope.gridOptionsDef.totalItems = submissions.serverCount;
              $scope.gridOptionsDef.data = submissions;
              setTableHeight(submissions.length);
              $scope.$emit("onData", submissions);
            });
          }

        };

        var setTableHeight = function(renderableRows) {
          $timeout(function() {
            var newHeight = ($scope.gridOptions && $scope.gridOptions.height) ? $scope.gridOptions.height : ($scope.gridApi.grid.getVisibleRowCount() * 30) + 100;
            angular.element('.grid', $element).height(newHeight);
          }, 10);
          return renderableRows;
        };

        // Load a new grid view.
        var loadGrid = function() {
          // If no source, things should be set up manually.
          if (!$scope.src) {
            getPage();
            return;
          }
          formio = new Formio($scope.src);
          formio.loadForm().then(function(form) {

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
                cellTemplate: '<a class="' + btnClass + '" ng-click="grid.appScope.buttonClick(\'' + button.event + '\', row.entity)"><span class="' + button.icon + '" aria-hidden="true"></span>' + button.label + '</a>'
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
                template = '<a class="' + linkClass + '" style="cursor:pointer;" ng-click="grid.appScope.buttonClick(\'' + linkEvent + '\', row.entity)">' + template + '</a>';
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
                sort: options.sort,
                filterField: options.filterField,
                enableFiltering: !!options.enableFiltering
              };

              // Allow for other options.
              ['width', 'sortable', 'visible', 'minWidth', 'maxWidth', 'resizable', 'cellClass', 'headerCellClass', 'headerCellTemplate'].forEach(function(option) {
                if (options.hasOwnProperty(option)) {
                  column[option] = options[option];
                }
              });

              // Add the column to the grid.
              $scope.gridOptionsDef.columnDefs.push(column);
              columnIndex++;
            };

            if (gridColumns && (Object.keys(gridColumns).length > 0)) {
              var components = FormioUtils.flattenComponents(form.components);
              angular.forEach(gridColumns, function(options, key) {
                if (options.sort && options.sort.direction) {
                  var field = components.hasOwnProperty(key) ? 'data.' + key : key;
                  setSort(options.sort, field);
                }

                addColumn(components[key], options, key);
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

angular.module('ngFormioGrid', [
  'formio',
  'ngSanitize',
  'ui.grid',
  'ui.grid.pagination',
  'ui.grid.resizeColumns',
  'ui.grid.autoResize',
  'ui.grid.selection'

])
  .filter('tableFieldView', [
  'Formio',
  'formioComponents',
  '$interpolate',
  function (
      Formio,
      formioComponents,
      $interpolate
  ) {
      return function (value, component) {
        var componentInfo = formioComponents.components[component.type];
        if (!componentInfo.tableView) return value;
        if (component.multiple && (value.length > 0)) {
          var values = [];
          angular.forEach(value, function (arrayValue) {
            values.push(componentInfo.tableView(arrayValue, component, $interpolate));
          });
          return values;
        }
        return componentInfo.tableView(value, component, $interpolate);
      };
  }
])
  .directive('formioGridCell', ['$compile', 'formioTableView', function ($compile, formioTableView) {
    return {
      restrict: 'A',
      link: function (scope, element) {
        var value = scope.grid.getCellValue(scope.row, scope.col);
        var component = scope.col.colDef.component;
        var html = formioTableView(value, component);
        if (Array.isArray(html)) {
          html = html.join(', ');
        }
        element.html(html);
      }
    };
}])
  .directive('formioGrid', function () {
    return {
      restrict: 'E',
      replace: true,
      scope: {
        src: '=',
        query: '=?',
        columns: '=?',
        buttons: '=?',
        gridOptions: '=?',
        gridOptionsDef: '=?'
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
      '$q',
      '$http',
      function (
          $scope,
          $element,
          $timeout,
          Formio,
          formioComponents,
          FormioUtils,
          uiGridConstants,
          $q,
          $http
      ) {
          //$scope.apiReady = $q.defer();
          var formio = null;
          var paginationOptions = angular.merge({
            pageNumber: 1,
            pageSize: 25,
            sort: null
          }, $scope.gridOptions);

          var gridColumns = {};
          var setupGridColumns = function () {
            // Setup the grid columns.
            gridColumns = $scope.columns;
            if (Array.isArray($scope.columns)) {
              gridColumns = {};
              $scope.columns.forEach(function (key) {
                if (typeof key === 'string') {
                  gridColumns[key] = {};
                } else {
                  gridColumns[key.key] = key;
                }
              });
            }
          };
          setupGridColumns();

          var setSort = function (sort, field) {
            switch (sort.direction) {
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
            endpoint: '',
            paginationPageSizes: [25, 50, 75],
            paginationPageSize: paginationOptions.pageSize,
            enableHorizontalScrollbar: uiGridConstants.scrollbars.NEVER,
            enableVerticalScrollbar: uiGridConstants.scrollbars.NEVER,
            useExternalPagination: true,
            useExternalSorting: true,
            enableSelectAll: true,
            enableRowSelection: true,
            enableRowHeaderSelection: false,
            enableFiltering: false,
            multiSelect: false,
            columnDefs: [],
            data: [],
            onRegisterApi: function (gridApi) {
              $scope.gridApi = gridApi;
              //$scope.apiReady.resolve(gridApi);
              gridApi.pagination.on.paginationChanged($scope, function (newPage, pageSize) {
                paginationOptions.pageNumber = newPage;
                paginationOptions.pageSize = pageSize;
                getPage();
              });

              // When the row is selected, emit an event.
              gridApi.selection.on.rowSelectionChanged($scope, function (row) {
                $scope.$emit($scope.gridOptionsDef.namespace + 'Select', row.entity, row.isSelected);
              });

              var setSorting = function () {

              };

              // Ui Grid External sort code.
              gridApi.core.on.sortChanged($scope, function (grid, sortColumns) {
                if (sortColumns.length === 0) {
                  paginationOptions.sort = null;
                } else {
                  setSort(sortColumns[0].sort, sortColumns[0].colDef.field);
                }
                getPage();
              });
            }
          }, $scope.gridOptions);

          // Filter record based on two dates.
          /*$scope.formioGridDateBetween = function (startDate, endDate) {
            $scope.query = {
              'data.date__gte': startDate,
              'data.date__lte': endDate
            };
            getPage();
            return $scope.apiReady.promise;
          };*/

          /*$scope.exposeGridApi = function () {
            console.log('in grid api');
            return $scope.apiReady.promise;
          };*/

          $scope.$on('selectGridRow', function (event, record) {
            $scope.gridApi.selection.selectRow(record);
          });

          $scope.$on('refreshGrid', function (event) {
            getPage();
            //return $scope.apiReady.promise;
          });

          paginationOptions.pageSize = $scope.gridOptionsDef.paginationPageSize;

          $scope.buttons = $scope.buttons || [];

          $scope.buttonClick = function (event, entity) {
            $scope.$emit(event, entity);
          };

          if (angular.isUndefined($scope.query)) {
            $scope.query = {};
          }

          var getPage = function () {
            if (!formio) {
              return;
            }
            if (!$scope.gridOptionsDef.columnDefs.length) {
              return;
            }
            if (paginationOptions.pageSize) {
              $scope.query.limit = paginationOptions.pageSize;
            }
            if (paginationOptions.pageNumber) {
              $scope.query.skip = (paginationOptions.pageNumber - 1) * paginationOptions.pageSize;
            }

            $scope.query.sort = paginationOptions.sort;

            if ($scope.gridOptionsDef.endpoint) {
              var endpoint = $scope.gridOptionsDef.endpoint;
              $http.get(endpoint, {
                params: $scope.query,
                headers: {
                  'x-jwt-token': Formio.getToken()
                }
              }).then(function successCallback(response) {
                $scope.gridOptionsDef.data = response.data;
                setTableHeight(response.data.length);
                $scope.$emit("onData", response.data);
              }, function errorCallback(response) {
                console.log('Error: ' + response.message);
              });
            } else {
              formio.loadSubmissions({
                params: $scope.query
              }).then(function (submissions) {
                $scope.gridOptionsDef.totalItems = submissions.serverCount;
                $scope.gridOptionsDef.data = submissions;
                setTableHeight(submissions.length);
                $scope.$emit("onData", submissions);
              });
            }
          };

          var setTableHeight = function (renderableRows) {
            $timeout(function () {
              var newHeight = ($scope.gridOptions && $scope.gridOptions.height) ? $scope.gridOptions.height : ($scope.gridApi.grid.getVisibleRowCount() * 30) + 100;
              angular.element('.grid', $element).height(newHeight);
            }, 10);
            return renderableRows;
          };

          // Load a new grid view.
          var loadGrid = function () {
            if (!$scope.src) {
              return;
            }
            formio = new Formio($scope.src);
            formio.loadForm().then(function (form) {

              // Setup the grid columns again.
              setupGridColumns();

              var names = {};
              var increment = 1;
              $scope.gridOptionsDef.columnDefs = ($scope.gridOptions && $scope.gridOptions.columnDefs ? angular.copy($scope.gridOptions.columnDefs) : []);
              $scope.buttons.forEach(function (button) {
                var btnClass = button.class || 'btn btn-sm btn-default';
                names[button.label] = true;
                $scope.gridOptionsDef.columnDefs.unshift({
                  name: button.label,
                  field: button.key,
                  width: button.width,
                  cellTemplate: '<a class="' + btnClass + '" ng-click="grid.appScope.buttonClick(\'' + button.event + '\', row.entity)"><span class="' + button.icon + '" aria-hidden="true"></span>' + button.label + '</a>'
                });
              });

              var columnIndex = 0;
              var addColumn = function (component, options, key) {
                options = options || {};

                // Default the first column to be a link unless they say otherwise.
                if (columnIndex === 0 && !options.hasOwnProperty('link')) {
                  options.link = true;
                }

                // Ensure that the labels do not collide.
                var label = '';
                if (options.hasOwnProperty('label')) {
                  label = options.label;
                } else if (component) {
                  label = component.label || component.key;
                  while (names.hasOwnProperty(label)) {
                    label = component.label + increment++;
                  }
                }

                names[label] = true;

                var template = options.template || '<div class="ui-grid-cell-contents" formio-grid-cell></div>';
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
                  sort: options.sort
                };

                // Allow for other options.
              ['width', 'sortable', 'visible', 'minWidth', 'maxWidth', 'resizable', 'cellClass', 'headerCellClass', 'headerCellTemplate'].forEach(function (option) {
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
                angular.forEach(gridColumns, function (options, key) {
                  if (options.sort && options.sort.direction) {
                    var field = components.hasOwnProperty(key) ? 'data.' + key : key;
                    setSort(options.sort, field);
                  }

                  addColumn(components[key], options, key);
                });
              } else {

                // Setup the operation column.
                var operationColumn = {
                  name: 'operations',
                  form: form,
                  field: 'data.edit',
                  width: 80,
                  enableColumnMenu: false,
                  cellTemplate: '<div class="operations"><a class="btn btn-default btn-xs" ng-click="$emit(\'rowEdit\', row.entity)"><span class="glyphicon glyphicon-edit" aria-hidden="true"></span></a><a class="btn btn-danger btn-xs" ng-click="$emit(\'rowDelete\', row.entity)"><span class="glyphicon glyphicon-remove-circle" aria-hidden="true"></span></a></div>'
                };

                FormioUtils.eachComponent(form.components, function (component) {
                  if (component.input && component.tableView && component.key) {
                    addColumn(component);
                  }
                });
                $scope.gridOptionsDef.columnDefs.push(operationColumn);
              }

              getPage();
            });
          };

          $scope.$on('reloadGrid', function (event, src, query) {
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

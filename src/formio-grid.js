angular.module('ngFormioGrid', [
  'formio',
  'ngSanitize',
  'ui.grid',
  'ui.grid.pagination',
  'angular-bind-html-compile'
])
.filter('formioTableView', [
  'Formio',
  'formioComponents',
  '$interpolate',
  function(
    Formio,
    formioComponents,
    $interpolate
  ) {
      return function(value, component) {
        var componentInfo = formioComponents.components[component.type];
        if (!componentInfo.tableView) return value;
        if (component.multiple && (value.length > 0)) {
          var values = [];
          angular.forEach(value, function(arrayValue) {
            values.push(componentInfo.tableView(arrayValue, component, $interpolate));
          });
          return values;
        }
        return componentInfo.tableView(value, component, $interpolate);
      };
    }
])
.directive('formioGrid', function() {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      src: '=',
      query: '=?',
      columns: '=?',
      gridOptions: '=?',
      formioGridDateBetween: '=?',
      exposeGridApi: '=?'
    },
    template: '<div><div ui-grid="gridOptions" ui-grid-selection ui-grid-pagination class="grid"></div></div>',
    controller: [
      'Formio',
      'formioComponents',
      'FormioUtils',
      '$scope',
      '$q',
      'uiGridConstants',
      function(
        Formio,
        formioComponents,
        FormioUtils,
        $scope,
        $q,
        uiGridConstants
      ) {
          var formio = null;
          var paginationOptions = {
            pageNumber: 1,
            pageSize: 25
          };
          $scope.apiReady = $q.defer();

          if (angular.isUndefined($scope.query)) {
            $scope.query = {};
          }

          var getPage = function() {
            if (!formio) { return; }
            if (paginationOptions.pageSize) {
              $scope.query.limit = paginationOptions.pageSize;
            }
            if (paginationOptions.pageNumber) {
              $scope.query.skip = (paginationOptions.pageNumber - 1) * paginationOptions.pageSize;
            }
            formio.loadSubmissions({params: $scope.query}).then(function(submissions) {
              $scope.gridOptions.totalItems = submissions.serverCount;
              $scope.gridOptions.data = submissions;
            });
            return $scope.apiReady.promise;
          };

          $scope.gridOptions = angular.merge({
            paginationPageSizes: [25, 50, 75],
            paginationPageSize: paginationOptions.pageSize,
            useExternalPagination: true,
            enableSorting: false,
            enableFiltering: false,
            enableRowSelection: false,
            enableSelectAll: true,            
            columnDefs: [],
            data: [],
            onRegisterApi: function(gridApi) {
              $scope.gridApi = gridApi;
              $scope.apiReady.resolve(gridApi);
              gridApi.pagination.on.paginationChanged($scope, function (newPage, pageSize) {
                paginationOptions.pageNumber = newPage;
                paginationOptions.pageSize = pageSize;
                getPage();
              });
            }              
          },$scope.gridOptions);   

          // Filter record based on two dates.
          $scope.formioGridDateBetween = function(startDate, endDate){                  
            $scope.query={'data.date__gte':startDate,'data.date__lte':endDate};
            getPage();
            return $scope.apiReady.promise;
          };
         
          $scope.exposeGridApi = function(){
            return $scope.apiReady.promise;
          };

          $scope.$on('selectGridRow', function(event, record) {
            $scope.gridApi.selection.selectRow(record);
            return $scope.apiReady.promise;
          });

          $scope.$on('refreshGrid', function(event) {
            getPage();
            return $scope.apiReady.promise;
          });

          // Load a new grid view.
          var loadGrid = function() {
            if (!$scope.src) { return; }
            formio = new Formio($scope.src);
            formio.loadForm().then(function(form) {
              $scope.gridOptions.columnDefs = [];
              FormioUtils.eachComponent(form.components, function(component) {
                if (
                  ($scope.columns && ($scope.columns.indexOf(component.key) !== -1)) ||
                  (!$scope.columns && component.input && component.tableView)
                ) {
                    $scope.gridOptions.columnDefs.push({
                      component: component,
                      name: component.label,
                      field: 'data.' + component.key,
                      cellTemplate: '<div class="ui-grid-cell-contents" ng-click="$emit(\'rowView\', row.entity)" bind-html-compile="COL_FIELD | formioTableView:this.col.colDef.component"></div>'
                    });
                  }
              });
              $scope.gridOptions.columnDefs.push({
                name: 'operations',
                field: 'data.edit',
                width: 80,
                enableColumnMenu: false,
                cellTemplate: '<div class="operations"><a class="btn btn-default btn-xs" ng-click="$emit(\'rowEdit\', row.entity)"><span class="glyphicon glyphicon-edit" aria-hidden="true"></span></a><a class="btn btn-danger btn-xs" ng-click="$emit(\'rowDelete\', row.entity)"><span class="glyphicon glyphicon-remove-circle" aria-hidden="true"></span></a></div>'
              });  
            });
            getPage();                    
          };

          $scope.$on('reloadGrid', function(event, src, query) {
            $scope.src = src;
            $scope.query = query;
            loadGrid();
          });
          loadGrid();
      }
    ]
  };
});

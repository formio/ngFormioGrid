angular.module('ngFormioGrid', [
  'formio',
  'ngSanitize',
  'ui.grid',
  'ui.grid.pagination',
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
      buttons: '=?'
    },
    template: '<div><div ui-grid="gridOptions" ui-grid-pagination class="grid"></div></div>',
    controller: [
      'Formio',
      'formioComponents',
      'FormioUtils',
      '$scope',
      'uiGridConstants',
      function(
        Formio,
        formioComponents,
        FormioUtils,
        $scope,
        uiGridConstants
      ) {
        var formio = null;
        var paginationOptions = {
          pageNumber: 1,
          pageSize: 25,
          sort: null
        };

        $scope.buttons = $scope.buttons ||  [{
            id: '_id',
            key: 'view',
            label: '',
            width: 35,
            icon: 'glyphicon glyphicon-share-alt'
          }];

        if (angular.isUndefined($scope.query)) {
          $scope.query = {};
        }

        var getPage = function() {
          if (!formio) { return; }
          if (!$scope.gridOptions.columnDefs.length) { return; }
          if (paginationOptions.pageSize) {
            $scope.query.limit = paginationOptions.pageSize;
          }
          if (paginationOptions.pageNumber) {
            $scope.query.skip = (paginationOptions.pageNumber - 1) * paginationOptions.pageSize;
          }
          
          $scope.query.sort = paginationOptions.sort;
          formio.loadSubmissions({params: $scope.query}).then(function(submissions) {
            $scope.gridOptions.totalItems = submissions.serverCount;
            $scope.gridOptions.data = submissions;
          });
        };

        $scope.gridOptions = {
          paginationPageSizes: [25, 50, 75],
          paginationPageSize: paginationOptions.pageSize,
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
        };

        $scope.buttonClick = function(entity, button) {
          // For compatibility
          if (button === 'view') {
            $scope.$emit('rowView', entity);
          }
          $scope.$emit('buttonClick', entity, button);
        };

        // Load a new grid view.
        var loadGrid = function() {
          if (!$scope.src) { return; }
          formio = new Formio($scope.src);
          formio.loadForm().then(function(form) {

            var names = {};
            var increment = 1;
            $scope.gridOptions.columnDefs = [];
            $scope.buttons.forEach(function(button) {
              var btnClass = button.class || 'btn btn-sm btn-default';
              names[button.label] = true;
              $scope.gridOptions.columnDefs.push({
                name: button.label,
                field: button.key,
                width: button.width,
                cellTemplate: '<a class="' + btnClass + '" ng-click="grid.appScope.buttonClick(row.entity, \'' + button.key + '\')"><span class="' + button.icon + '" aria-hidden="true"></span>' + button.label + '</a>'
              });
            });

            FormioUtils.eachComponent(form.components, function(component) {
              if (!component.input || !component.tableView || !component.key) {
                return;
              }

              if (
                (!$scope.columns) ||
                ($scope.columns.length && ($scope.columns.indexOf(component.key) !== -1))
              ) {

                // Ensure that the labels do not collide.
                var label = component.label || component.key;
                while (names.hasOwnProperty(label)) {
                  label = component.label + increment++;
                }

                names[label] = true;
                $scope.gridOptions.columnDefs.push({
                  component: component,
                  name: label,
                  field: 'data.' + component.key,
                  cellTemplate: '<div class="ui-grid-cell-contents" bind-html-compile="COL_FIELD | tableFieldView:this.col.colDef.component"></div>'
                });
              }
            });

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

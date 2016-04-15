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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZm9ybWlvLWdyaWQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuYW5ndWxhci5tb2R1bGUoJ25nRm9ybWlvR3JpZCcsIFtcbiAgJ2Zvcm1pbycsXG4gICduZ1Nhbml0aXplJyxcbiAgJ3VpLmdyaWQnLFxuICAndWkuZ3JpZC5wYWdpbmF0aW9uJyxcbiAgJ3VpLmdyaWQucmVzaXplQ29sdW1ucycsXG4gICd1aS5ncmlkLmF1dG9SZXNpemUnLFxuICAnYW5ndWxhci1iaW5kLWh0bWwtY29tcGlsZSdcbl0pXG4uZGlyZWN0aXZlKCdmb3JtaW9HcmlkJywgZnVuY3Rpb24oKSB7XG4gIHJldHVybiB7XG4gICAgcmVzdHJpY3Q6ICdFJyxcbiAgICByZXBsYWNlOiB0cnVlLFxuICAgIHNjb3BlOiB7XG4gICAgICBzcmM6ICc9JyxcbiAgICAgIHF1ZXJ5OiAnPT8nLFxuICAgICAgY29sdW1uczogJz0/JyxcbiAgICAgIGJ1dHRvbnM6ICc9PycsXG4gICAgICBncmlkT3B0aW9uczogJz0/J1xuICAgIH0sXG4gICAgdGVtcGxhdGU6ICc8ZGl2PjxkaXYgdWktZ3JpZD1cImdyaWRPcHRpb25zRGVmXCIgdWktZ3JpZC1wYWdpbmF0aW9uIHVpLWdyaWQtYXV0by1yZXNpemUgdWktZ3JpZC1yZXNpemUtY29sdW1ucyB1aS1ncmlkLW1vdmUtY29sdW1ucyBjbGFzcz1cImdyaWRcIj48L2Rpdj48L2Rpdj4nLFxuICAgIGNvbnRyb2xsZXI6IFtcbiAgICAgICckc2NvcGUnLFxuICAgICAgJyRlbGVtZW50JyxcbiAgICAgICckdGltZW91dCcsXG4gICAgICAnRm9ybWlvJyxcbiAgICAgICdmb3JtaW9Db21wb25lbnRzJyxcbiAgICAgICdGb3JtaW9VdGlscycsXG4gICAgICAndWlHcmlkQ29uc3RhbnRzJyxcbiAgICAgICckaHR0cCcsXG4gICAgICBmdW5jdGlvbihcbiAgICAgICAgJHNjb3BlLFxuICAgICAgICAkZWxlbWVudCxcbiAgICAgICAgJHRpbWVvdXQsXG4gICAgICAgIEZvcm1pbyxcbiAgICAgICAgZm9ybWlvQ29tcG9uZW50cyxcbiAgICAgICAgRm9ybWlvVXRpbHMsXG4gICAgICAgIHVpR3JpZENvbnN0YW50cyxcbiAgICAgICAgJGh0dHBcbiAgICAgICkge1xuICAgICAgICB2YXIgZm9ybWlvID0gbnVsbDtcbiAgICAgICAgdmFyIHBhZ2luYXRpb25PcHRpb25zID0ge1xuICAgICAgICAgIHBhZ2VOdW1iZXI6IDEsXG4gICAgICAgICAgcGFnZVNpemU6IDI1LFxuICAgICAgICAgIHNvcnQ6IG51bGxcbiAgICAgICAgfTtcblxuICAgICAgICAkc2NvcGUuZ3JpZE9wdGlvbnNEZWYgPSBhbmd1bGFyLm1lcmdlKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdyb3cnLFxuICAgICAgICAgIGRhdGFSb290OiAnZGF0YS4nLFxuICAgICAgICAgIGVuZHBvaW50OiAnJyxcbiAgICAgICAgICBwYWdpbmF0aW9uUGFnZVNpemVzOiBbMjUsIDUwLCA3NV0sXG4gICAgICAgICAgcGFnaW5hdGlvblBhZ2VTaXplOiBwYWdpbmF0aW9uT3B0aW9ucy5wYWdlU2l6ZSxcbiAgICAgICAgICBlbmFibGVIb3Jpem9udGFsU2Nyb2xsYmFyOiB1aUdyaWRDb25zdGFudHMuc2Nyb2xsYmFycy5ORVZFUixcbiAgICAgICAgICBlbmFibGVWZXJ0aWNhbFNjcm9sbGJhcjogdWlHcmlkQ29uc3RhbnRzLnNjcm9sbGJhcnMuTkVWRVIsXG4gICAgICAgICAgdXNlRXh0ZXJuYWxQYWdpbmF0aW9uOiB0cnVlLFxuICAgICAgICAgIHVzZUV4dGVybmFsU29ydGluZzogdHJ1ZSxcbiAgICAgICAgICBjb2x1bW5EZWZzOiBbXSxcbiAgICAgICAgICBkYXRhOiBbXSxcbiAgICAgICAgICBvblJlZ2lzdGVyQXBpOiBmdW5jdGlvbihncmlkQXBpKSB7XG4gICAgICAgICAgICAkc2NvcGUuZ3JpZEFwaSA9IGdyaWRBcGk7XG4gICAgICAgICAgICBncmlkQXBpLnBhZ2luYXRpb24ub24ucGFnaW5hdGlvbkNoYW5nZWQoJHNjb3BlLCBmdW5jdGlvbihuZXdQYWdlLCBwYWdlU2l6ZSkge1xuICAgICAgICAgICAgICBwYWdpbmF0aW9uT3B0aW9ucy5wYWdlTnVtYmVyID0gbmV3UGFnZTtcbiAgICAgICAgICAgICAgcGFnaW5hdGlvbk9wdGlvbnMucGFnZVNpemUgPSBwYWdlU2l6ZTtcbiAgICAgICAgICAgICAgZ2V0UGFnZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBVaSBHcmlkIEV4dGVybmFsIHNvcnQgY29kZS5cbiAgICAgICAgICAgIGdyaWRBcGkuY29yZS5vbi5zb3J0Q2hhbmdlZCgkc2NvcGUsZnVuY3Rpb24oZ3JpZCwgc29ydENvbHVtbnMpIHtcbiAgICAgICAgICAgICAgaWYgKHNvcnRDb2x1bW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHBhZ2luYXRpb25PcHRpb25zLnNvcnQgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN3aXRjaChzb3J0Q29sdW1uc1swXS5zb3J0LmRpcmVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgY2FzZSB1aUdyaWRDb25zdGFudHMuQVNDOlxuICAgICAgICAgICAgICAgICAgICBwYWdpbmF0aW9uT3B0aW9ucy5zb3J0ID0gc29ydENvbHVtbnNbMF0uY29sRGVmLmZpZWxkO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgIGNhc2UgdWlHcmlkQ29uc3RhbnRzLkRFU0M6XG4gICAgICAgICAgICAgICAgICAgIHBhZ2luYXRpb25PcHRpb25zLnNvcnQgPSAnLScrc29ydENvbHVtbnNbMF0uY29sRGVmLmZpZWxkO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgICAgICAgICAgICAgICBwYWdpbmF0aW9uT3B0aW9ucy5zb3J0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGdldFBhZ2UoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgJHNjb3BlLmdyaWRPcHRpb25zKTtcbiAgICAgICAgcGFnaW5hdGlvbk9wdGlvbnMucGFnZVNpemUgPSAkc2NvcGUuZ3JpZE9wdGlvbnNEZWYucGFnaW5hdGlvblBhZ2VTaXplO1xuXG4gICAgICAgICRzY29wZS5idXR0b25zID0gJHNjb3BlLmJ1dHRvbnMgfHwgIFt7XG4gICAgICAgICAgICBpZDogJ3ZpZXcnLFxuICAgICAgICAgICAga2V5OiAndmlldycsXG4gICAgICAgICAgICBldmVudDogJHNjb3BlLmdyaWRPcHRpb25zRGVmLm5hbWVzcGFjZSArICdWaWV3JyxcbiAgICAgICAgICAgIGxhYmVsOiAnJyxcbiAgICAgICAgICAgIHdpZHRoOiAzNSxcbiAgICAgICAgICAgIGljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLXNoYXJlLWFsdCdcbiAgICAgICAgICB9XTtcblxuICAgICAgICAkc2NvcGUuYnV0dG9uQ2xpY2sgPSBmdW5jdGlvbihldmVudCwgZW50aXR5KSB7XG4gICAgICAgICAgJHNjb3BlLiRlbWl0KGV2ZW50LCBlbnRpdHkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKCRzY29wZS5xdWVyeSkpIHtcbiAgICAgICAgICAkc2NvcGUucXVlcnkgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBnZXRQYWdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKCFmb3JtaW8pIHsgcmV0dXJuOyB9XG4gICAgICAgICAgaWYgKCEkc2NvcGUuZ3JpZE9wdGlvbnNEZWYuY29sdW1uRGVmcy5sZW5ndGgpIHsgcmV0dXJuOyB9XG4gICAgICAgICAgaWYgKHBhZ2luYXRpb25PcHRpb25zLnBhZ2VTaXplKSB7XG4gICAgICAgICAgICAkc2NvcGUucXVlcnkubGltaXQgPSBwYWdpbmF0aW9uT3B0aW9ucy5wYWdlU2l6ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHBhZ2luYXRpb25PcHRpb25zLnBhZ2VOdW1iZXIpIHtcbiAgICAgICAgICAgICRzY29wZS5xdWVyeS5za2lwID0gKHBhZ2luYXRpb25PcHRpb25zLnBhZ2VOdW1iZXIgLSAxKSAqIHBhZ2luYXRpb25PcHRpb25zLnBhZ2VTaXplO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAkc2NvcGUucXVlcnkuc29ydCA9IHBhZ2luYXRpb25PcHRpb25zLnNvcnQ7XG5cbiAgICAgICAgICBpZiAoJHNjb3BlLmdyaWRPcHRpb25zRGVmLmVuZHBvaW50KSB7XG4gICAgICAgICAgICB2YXIgZW5kcG9pbnQgPSAkc2NvcGUuZ3JpZE9wdGlvbnNEZWYuZW5kcG9pbnQ7XG4gICAgICAgICAgICB2YXIgc2VyaWFsaXplID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgICAgICAgIHZhciBzdHIgPSBbXTtcbiAgICAgICAgICAgICAgZm9yKHZhciBwIGluIG9iailcbiAgICAgICAgICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KHApKSB7XG4gICAgICAgICAgICAgICAgICBzdHIucHVzaChlbmNvZGVVUklDb21wb25lbnQocCkgKyBcIj1cIiArIGVuY29kZVVSSUNvbXBvbmVudChvYmpbcF0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBzdHIuam9pbihcIiZcIik7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKCRzY29wZS5xdWVyeSkge1xuICAgICAgICAgICAgICB2YXIgcXVlcnkgPSBzZXJpYWxpemUoJHNjb3BlLnF1ZXJ5KTtcbiAgICAgICAgICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgZW5kcG9pbnQgKz0gKCc/JyArIHF1ZXJ5KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgJGh0dHAuZ2V0KGVuZHBvaW50LCB7XG4gICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAneC1qd3QtdG9rZW4nOiBGb3JtaW8uZ2V0VG9rZW4oKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS50aGVuKGZ1bmN0aW9uIHN1Y2Nlc3NDYWxsYmFjayhyZXNwb25zZSkge1xuICAgICAgICAgICAgICAkc2NvcGUuZ3JpZE9wdGlvbnNEZWYuZGF0YSA9IHJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICAgIHNldFRhYmxlSGVpZ2h0KHJlc3BvbnNlLmRhdGEubGVuZ3RoKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIGVycm9yQ2FsbGJhY2socmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0Vycm9yOiAnICsgcmVzcG9uc2UubWVzc2FnZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBmb3JtaW8ubG9hZFN1Ym1pc3Npb25zKHtwYXJhbXM6ICRzY29wZS5xdWVyeX0pLnRoZW4oZnVuY3Rpb24oc3VibWlzc2lvbnMpIHtcbiAgICAgICAgICAgICAgJHNjb3BlLmdyaWRPcHRpb25zRGVmLnRvdGFsSXRlbXMgPSBzdWJtaXNzaW9ucy5zZXJ2ZXJDb3VudDtcbiAgICAgICAgICAgICAgJHNjb3BlLmdyaWRPcHRpb25zRGVmLmRhdGEgPSBzdWJtaXNzaW9ucztcbiAgICAgICAgICAgICAgc2V0VGFibGVIZWlnaHQoc3VibWlzc2lvbnMubGVuZ3RoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgc2V0VGFibGVIZWlnaHQgPSBmdW5jdGlvbihyZW5kZXJhYmxlUm93cykge1xuICAgICAgICAgICR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIG5ld0hlaWdodCA9ICgkc2NvcGUuZ3JpZEFwaS5ncmlkLmdldFZpc2libGVSb3dDb3VudCgpICogMjcpICsgODU7XG4gICAgICAgICAgICBhbmd1bGFyLmVsZW1lbnQoJGVsZW1lbnQpLmNoaWxkcmVuKCkuY3NzKCdoZWlnaHQnLCBuZXdIZWlnaHQgKyAncHgnKTtcbiAgICAgICAgICB9LCAxMCk7XG4gICAgICAgICAgcmV0dXJuIHJlbmRlcmFibGVSb3dzO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIExvYWQgYSBuZXcgZ3JpZCB2aWV3LlxuICAgICAgICB2YXIgbG9hZEdyaWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoISRzY29wZS5zcmMpIHsgcmV0dXJuOyB9XG4gICAgICAgICAgZm9ybWlvID0gbmV3IEZvcm1pbygkc2NvcGUuc3JjKTtcbiAgICAgICAgICBmb3JtaW8ubG9hZEZvcm0oKS50aGVuKGZ1bmN0aW9uKGZvcm0pIHtcblxuICAgICAgICAgICAgdmFyIG5hbWVzID0ge307XG4gICAgICAgICAgICB2YXIgaW5jcmVtZW50ID0gMTtcbiAgICAgICAgICAgICRzY29wZS5ncmlkT3B0aW9uc0RlZi5jb2x1bW5EZWZzID0gKCRzY29wZS5ncmlkT3B0aW9ucyAmJiAkc2NvcGUuZ3JpZE9wdGlvbnMuY29sdW1uRGVmcyA/IGFuZ3VsYXIuY29weSgkc2NvcGUuZ3JpZE9wdGlvbnMuY29sdW1uRGVmcykgOiBbXSk7XG4gICAgICAgICAgICAkc2NvcGUuYnV0dG9ucy5mb3JFYWNoKGZ1bmN0aW9uKGJ1dHRvbikge1xuICAgICAgICAgICAgICB2YXIgYnRuQ2xhc3MgPSBidXR0b24uY2xhc3MgfHwgJ2J0biBidG4tc20gYnRuLWRlZmF1bHQnO1xuICAgICAgICAgICAgICBuYW1lc1tidXR0b24ubGFiZWxdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgJHNjb3BlLmdyaWRPcHRpb25zRGVmLmNvbHVtbkRlZnMudW5zaGlmdCh7XG4gICAgICAgICAgICAgICAgbmFtZTogYnV0dG9uLmxhYmVsLFxuICAgICAgICAgICAgICAgIGZpZWxkOiBidXR0b24ua2V5LFxuICAgICAgICAgICAgICAgIHdpZHRoOiBidXR0b24ud2lkdGgsXG4gICAgICAgICAgICAgICAgY2VsbFRlbXBsYXRlOiAnPGEgY2xhc3M9XCInICsgYnRuQ2xhc3MgKyAnXCIgbmctY2xpY2s9XCJncmlkLmFwcFNjb3BlLmJ1dHRvbkNsaWNrKFxcJycgKyBidXR0b24uZXZlbnQgKyAnXFwnLCByb3cuZW50aXR5KVwiPjxzcGFuIGNsYXNzPVwiJyArIGJ1dHRvbi5pY29uICsgJ1wiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjwvc3Bhbj4nICsgYnV0dG9uLmxhYmVsICsgJzwvYT4nXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZhciBhZGRDb2x1bW4gPSBmdW5jdGlvbihjb21wb25lbnQsIGNvbHVtbikge1xuICAgICAgICAgICAgICAvLyBFbnN1cmUgdGhhdCB0aGUgbGFiZWxzIGRvIG5vdCBjb2xsaWRlLlxuICAgICAgICAgICAgICB2YXIgbGFiZWw7XG4gICAgICAgICAgICAgIGlmIChjb2x1bW4gJiYgY29sdW1uLmxhYmVsKSB7XG4gICAgICAgICAgICAgICAgbGFiZWwgPSBjb2x1bW4ubGFiZWw7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbGFiZWwgPSBjb21wb25lbnQubGFiZWwgfHwgY29tcG9uZW50LmtleTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHdoaWxlIChuYW1lcy5oYXNPd25Qcm9wZXJ0eShsYWJlbCkpIHtcbiAgICAgICAgICAgICAgICBsYWJlbCA9IGNvbXBvbmVudC5sYWJlbCArIGluY3JlbWVudCsrO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgbmFtZXNbbGFiZWxdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgJHNjb3BlLmdyaWRPcHRpb25zRGVmLmNvbHVtbkRlZnMucHVzaCh7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50OiBjb21wb25lbnQsXG4gICAgICAgICAgICAgICAgbmFtZTogbGFiZWwsXG4gICAgICAgICAgICAgICAgZmllbGQ6ICRzY29wZS5ncmlkT3B0aW9uc0RlZi5kYXRhUm9vdCArIGNvbXBvbmVudC5rZXksXG4gICAgICAgICAgICAgICAgY2VsbFRlbXBsYXRlOiAnPGRpdiBjbGFzcz1cInVpLWdyaWQtY2VsbC1jb250ZW50c1wiIGJpbmQtaHRtbC1jb21waWxlPVwiQ09MX0ZJRUxEIHwgdGFibGVGaWVsZFZpZXc6dGhpcy5jb2wuY29sRGVmLmNvbXBvbmVudFwiPjwvZGl2PidcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoJHNjb3BlLmNvbHVtbnMgJiYgJHNjb3BlLmNvbHVtbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICB2YXIgY29tcG9uZW50cyA9IEZvcm1pb1V0aWxzLmZsYXR0ZW5Db21wb25lbnRzKGZvcm0uY29tcG9uZW50cyk7XG4gICAgICAgICAgICAgIHZhciBjb2x1bW47XG4gICAgICAgICAgICAgICRzY29wZS5jb2x1bW5zLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgICAgICAgICAgLy8gUGFzcyBpbiBlaXRoZXIgY29sdW1uIGtleSBvciBjb2x1bW4gZGVmXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBrZXkgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICBjb2x1bW4gPSBrZXk7XG4gICAgICAgICAgICAgICAgICBrZXkgPSBjb2x1bW4ua2V5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGNvbHVtbiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICBhZGRDb2x1bW4oY29tcG9uZW50c1trZXldLCBjb2x1bW4pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgRm9ybWlvVXRpbHMuZWFjaENvbXBvbmVudChmb3JtLmNvbXBvbmVudHMsIGZ1bmN0aW9uKGNvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQuaW5wdXQgJiYgY29tcG9uZW50LnRhYmxlVmlldyAmJiBjb21wb25lbnQua2V5KSB7XG4gICAgICAgICAgICAgICAgICBhZGRDb2x1bW4oY29tcG9uZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBnZXRQYWdlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgJHNjb3BlLiRvbigncmVsb2FkR3JpZCcsIGZ1bmN0aW9uKGV2ZW50LCBzcmMsIHF1ZXJ5KSB7XG4gICAgICAgICAgaWYgKHNyYykge1xuICAgICAgICAgICAgJHNjb3BlLnNyYyA9IHNyYztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgICAgICAkc2NvcGUucXVlcnkgPSBxdWVyeTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbG9hZEdyaWQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbG9hZEdyaWQoKTtcbiAgICAgIH1cbiAgICBdXG4gIH07XG59KTtcbiJdfQ==

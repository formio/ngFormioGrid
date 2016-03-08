(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
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
      buttons: '=?',
      gridOptions: '=?'
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
        var paginationOptions = angular.merge({
          pageNumber: 1,
          pageSize: 25,
          sort: null
        }, $scope.gridOptions);

        $scope.buttons = $scope.buttons ||  [{
            id: 'view',
            key: 'view',
            event: 'rowView',
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

        $scope.buttonClick = function(event, entity) {
          $scope.$emit(event, entity);
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
                cellTemplate: '<a class="' + btnClass + '" ng-click="grid.appScope.buttonClick(\'' + button.event + '\', row.entity)"><span class="' + button.icon + '" aria-hidden="true"></span>' + button.label + '</a>'
              });
            });

            var addColumn = function(component) {
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
            };

            if ($scope.columns && $scope.columns.length > 0) {
              var components = FormioUtils.flattenComponents(form.components);
              $scope.columns.forEach(function(key) {
                if (components.hasOwnProperty(key)) {
                  addColumn(components[key]);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZm9ybWlvLWdyaWQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuYW5ndWxhci5tb2R1bGUoJ25nRm9ybWlvR3JpZCcsIFtcbiAgJ2Zvcm1pbycsXG4gICduZ1Nhbml0aXplJyxcbiAgJ3VpLmdyaWQnLFxuICAndWkuZ3JpZC5wYWdpbmF0aW9uJyxcbiAgJ2FuZ3VsYXItYmluZC1odG1sLWNvbXBpbGUnXG5dKVxuLmRpcmVjdGl2ZSgnZm9ybWlvR3JpZCcsIGZ1bmN0aW9uKCkge1xuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnRScsXG4gICAgcmVwbGFjZTogdHJ1ZSxcbiAgICBzY29wZToge1xuICAgICAgc3JjOiAnPScsXG4gICAgICBxdWVyeTogJz0/JyxcbiAgICAgIGNvbHVtbnM6ICc9PycsXG4gICAgICBidXR0b25zOiAnPT8nLFxuICAgICAgZ3JpZE9wdGlvbnM6ICc9PydcbiAgICB9LFxuICAgIHRlbXBsYXRlOiAnPGRpdj48ZGl2IHVpLWdyaWQ9XCJncmlkT3B0aW9uc1wiIHVpLWdyaWQtcGFnaW5hdGlvbiBjbGFzcz1cImdyaWRcIj48L2Rpdj48L2Rpdj4nLFxuICAgIGNvbnRyb2xsZXI6IFtcbiAgICAgICdGb3JtaW8nLFxuICAgICAgJ2Zvcm1pb0NvbXBvbmVudHMnLFxuICAgICAgJ0Zvcm1pb1V0aWxzJyxcbiAgICAgICckc2NvcGUnLFxuICAgICAgJ3VpR3JpZENvbnN0YW50cycsXG4gICAgICBmdW5jdGlvbihcbiAgICAgICAgRm9ybWlvLFxuICAgICAgICBmb3JtaW9Db21wb25lbnRzLFxuICAgICAgICBGb3JtaW9VdGlscyxcbiAgICAgICAgJHNjb3BlLFxuICAgICAgICB1aUdyaWRDb25zdGFudHNcbiAgICAgICkge1xuICAgICAgICB2YXIgZm9ybWlvID0gbnVsbDtcbiAgICAgICAgdmFyIHBhZ2luYXRpb25PcHRpb25zID0gYW5ndWxhci5tZXJnZSh7XG4gICAgICAgICAgcGFnZU51bWJlcjogMSxcbiAgICAgICAgICBwYWdlU2l6ZTogMjUsXG4gICAgICAgICAgc29ydDogbnVsbFxuICAgICAgICB9LCAkc2NvcGUuZ3JpZE9wdGlvbnMpO1xuXG4gICAgICAgICRzY29wZS5idXR0b25zID0gJHNjb3BlLmJ1dHRvbnMgfHwgIFt7XG4gICAgICAgICAgICBpZDogJ3ZpZXcnLFxuICAgICAgICAgICAga2V5OiAndmlldycsXG4gICAgICAgICAgICBldmVudDogJ3Jvd1ZpZXcnLFxuICAgICAgICAgICAgbGFiZWw6ICcnLFxuICAgICAgICAgICAgd2lkdGg6IDM1LFxuICAgICAgICAgICAgaWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tc2hhcmUtYWx0J1xuICAgICAgICAgIH1dO1xuXG4gICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKCRzY29wZS5xdWVyeSkpIHtcbiAgICAgICAgICAkc2NvcGUucXVlcnkgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBnZXRQYWdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKCFmb3JtaW8pIHsgcmV0dXJuOyB9XG4gICAgICAgICAgaWYgKCEkc2NvcGUuZ3JpZE9wdGlvbnMuY29sdW1uRGVmcy5sZW5ndGgpIHsgcmV0dXJuOyB9XG4gICAgICAgICAgaWYgKHBhZ2luYXRpb25PcHRpb25zLnBhZ2VTaXplKSB7XG4gICAgICAgICAgICAkc2NvcGUucXVlcnkubGltaXQgPSBwYWdpbmF0aW9uT3B0aW9ucy5wYWdlU2l6ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHBhZ2luYXRpb25PcHRpb25zLnBhZ2VOdW1iZXIpIHtcbiAgICAgICAgICAgICRzY29wZS5xdWVyeS5za2lwID0gKHBhZ2luYXRpb25PcHRpb25zLnBhZ2VOdW1iZXIgLSAxKSAqIHBhZ2luYXRpb25PcHRpb25zLnBhZ2VTaXplO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAkc2NvcGUucXVlcnkuc29ydCA9IHBhZ2luYXRpb25PcHRpb25zLnNvcnQ7XG4gICAgICAgICAgZm9ybWlvLmxvYWRTdWJtaXNzaW9ucyh7cGFyYW1zOiAkc2NvcGUucXVlcnl9KS50aGVuKGZ1bmN0aW9uKHN1Ym1pc3Npb25zKSB7XG4gICAgICAgICAgICAkc2NvcGUuZ3JpZE9wdGlvbnMudG90YWxJdGVtcyA9IHN1Ym1pc3Npb25zLnNlcnZlckNvdW50O1xuICAgICAgICAgICAgJHNjb3BlLmdyaWRPcHRpb25zLmRhdGEgPSBzdWJtaXNzaW9ucztcbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICAkc2NvcGUuZ3JpZE9wdGlvbnMgPSB7XG4gICAgICAgICAgcGFnaW5hdGlvblBhZ2VTaXplczogWzI1LCA1MCwgNzVdLFxuICAgICAgICAgIHBhZ2luYXRpb25QYWdlU2l6ZTogcGFnaW5hdGlvbk9wdGlvbnMucGFnZVNpemUsXG4gICAgICAgICAgdXNlRXh0ZXJuYWxQYWdpbmF0aW9uOiB0cnVlLFxuICAgICAgICAgIHVzZUV4dGVybmFsU29ydGluZzogdHJ1ZSxcbiAgICAgICAgICBjb2x1bW5EZWZzOiBbXSxcbiAgICAgICAgICBkYXRhOiBbXSxcbiAgICAgICAgICBvblJlZ2lzdGVyQXBpOiBmdW5jdGlvbihncmlkQXBpKSB7XG4gICAgICAgICAgICAkc2NvcGUuZ3JpZEFwaSA9IGdyaWRBcGk7XG4gICAgICAgICAgICBncmlkQXBpLnBhZ2luYXRpb24ub24ucGFnaW5hdGlvbkNoYW5nZWQoJHNjb3BlLCBmdW5jdGlvbihuZXdQYWdlLCBwYWdlU2l6ZSkge1xuICAgICAgICAgICAgICBwYWdpbmF0aW9uT3B0aW9ucy5wYWdlTnVtYmVyID0gbmV3UGFnZTtcbiAgICAgICAgICAgICAgcGFnaW5hdGlvbk9wdGlvbnMucGFnZVNpemUgPSBwYWdlU2l6ZTtcbiAgICAgICAgICAgICAgZ2V0UGFnZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBVaSBHcmlkIEV4dGVybmFsIHNvcnQgY29kZS5cbiAgICAgICAgICAgIGdyaWRBcGkuY29yZS5vbi5zb3J0Q2hhbmdlZCgkc2NvcGUsZnVuY3Rpb24oZ3JpZCwgc29ydENvbHVtbnMpIHtcbiAgICAgICAgICAgICAgaWYgKHNvcnRDb2x1bW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHBhZ2luYXRpb25PcHRpb25zLnNvcnQgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN3aXRjaChzb3J0Q29sdW1uc1swXS5zb3J0LmRpcmVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgY2FzZSB1aUdyaWRDb25zdGFudHMuQVNDOlxuICAgICAgICAgICAgICAgICAgICBwYWdpbmF0aW9uT3B0aW9ucy5zb3J0ID0gc29ydENvbHVtbnNbMF0uY29sRGVmLmZpZWxkO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgIGNhc2UgdWlHcmlkQ29uc3RhbnRzLkRFU0M6XG4gICAgICAgICAgICAgICAgICAgIHBhZ2luYXRpb25PcHRpb25zLnNvcnQgPSAnLScrc29ydENvbHVtbnNbMF0uY29sRGVmLmZpZWxkO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgICAgICAgICAgICAgICBwYWdpbmF0aW9uT3B0aW9ucy5zb3J0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGdldFBhZ2UoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICAkc2NvcGUuYnV0dG9uQ2xpY2sgPSBmdW5jdGlvbihldmVudCwgZW50aXR5KSB7XG4gICAgICAgICAgJHNjb3BlLiRlbWl0KGV2ZW50LCBlbnRpdHkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIExvYWQgYSBuZXcgZ3JpZCB2aWV3LlxuICAgICAgICB2YXIgbG9hZEdyaWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoISRzY29wZS5zcmMpIHsgcmV0dXJuOyB9XG4gICAgICAgICAgZm9ybWlvID0gbmV3IEZvcm1pbygkc2NvcGUuc3JjKTtcbiAgICAgICAgICBmb3JtaW8ubG9hZEZvcm0oKS50aGVuKGZ1bmN0aW9uKGZvcm0pIHtcblxuICAgICAgICAgICAgdmFyIG5hbWVzID0ge307XG4gICAgICAgICAgICB2YXIgaW5jcmVtZW50ID0gMTtcbiAgICAgICAgICAgICRzY29wZS5ncmlkT3B0aW9ucy5jb2x1bW5EZWZzID0gW107XG4gICAgICAgICAgICAkc2NvcGUuYnV0dG9ucy5mb3JFYWNoKGZ1bmN0aW9uKGJ1dHRvbikge1xuICAgICAgICAgICAgICB2YXIgYnRuQ2xhc3MgPSBidXR0b24uY2xhc3MgfHwgJ2J0biBidG4tc20gYnRuLWRlZmF1bHQnO1xuICAgICAgICAgICAgICBuYW1lc1tidXR0b24ubGFiZWxdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgJHNjb3BlLmdyaWRPcHRpb25zLmNvbHVtbkRlZnMucHVzaCh7XG4gICAgICAgICAgICAgICAgbmFtZTogYnV0dG9uLmxhYmVsLFxuICAgICAgICAgICAgICAgIGZpZWxkOiBidXR0b24ua2V5LFxuICAgICAgICAgICAgICAgIHdpZHRoOiBidXR0b24ud2lkdGgsXG4gICAgICAgICAgICAgICAgY2VsbFRlbXBsYXRlOiAnPGEgY2xhc3M9XCInICsgYnRuQ2xhc3MgKyAnXCIgbmctY2xpY2s9XCJncmlkLmFwcFNjb3BlLmJ1dHRvbkNsaWNrKFxcJycgKyBidXR0b24uZXZlbnQgKyAnXFwnLCByb3cuZW50aXR5KVwiPjxzcGFuIGNsYXNzPVwiJyArIGJ1dHRvbi5pY29uICsgJ1wiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjwvc3Bhbj4nICsgYnV0dG9uLmxhYmVsICsgJzwvYT4nXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZhciBhZGRDb2x1bW4gPSBmdW5jdGlvbihjb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgLy8gRW5zdXJlIHRoYXQgdGhlIGxhYmVscyBkbyBub3QgY29sbGlkZS5cbiAgICAgICAgICAgICAgdmFyIGxhYmVsID0gY29tcG9uZW50LmxhYmVsIHx8IGNvbXBvbmVudC5rZXk7XG4gICAgICAgICAgICAgIHdoaWxlIChuYW1lcy5oYXNPd25Qcm9wZXJ0eShsYWJlbCkpIHtcbiAgICAgICAgICAgICAgICBsYWJlbCA9IGNvbXBvbmVudC5sYWJlbCArIGluY3JlbWVudCsrO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgbmFtZXNbbGFiZWxdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgJHNjb3BlLmdyaWRPcHRpb25zLmNvbHVtbkRlZnMucHVzaCh7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50OiBjb21wb25lbnQsXG4gICAgICAgICAgICAgICAgbmFtZTogbGFiZWwsXG4gICAgICAgICAgICAgICAgZmllbGQ6ICdkYXRhLicgKyBjb21wb25lbnQua2V5LFxuICAgICAgICAgICAgICAgIGNlbGxUZW1wbGF0ZTogJzxkaXYgY2xhc3M9XCJ1aS1ncmlkLWNlbGwtY29udGVudHNcIiBiaW5kLWh0bWwtY29tcGlsZT1cIkNPTF9GSUVMRCB8IHRhYmxlRmllbGRWaWV3OnRoaXMuY29sLmNvbERlZi5jb21wb25lbnRcIj48L2Rpdj4nXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKCRzY29wZS5jb2x1bW5zICYmICRzY29wZS5jb2x1bW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgdmFyIGNvbXBvbmVudHMgPSBGb3JtaW9VdGlscy5mbGF0dGVuQ29tcG9uZW50cyhmb3JtLmNvbXBvbmVudHMpO1xuICAgICAgICAgICAgICAkc2NvcGUuY29sdW1ucy5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnRzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgIGFkZENvbHVtbihjb21wb25lbnRzW2tleV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgRm9ybWlvVXRpbHMuZWFjaENvbXBvbmVudChmb3JtLmNvbXBvbmVudHMsIGZ1bmN0aW9uKGNvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQuaW5wdXQgJiYgY29tcG9uZW50LnRhYmxlVmlldyAmJiBjb21wb25lbnQua2V5KSB7XG4gICAgICAgICAgICAgICAgICBhZGRDb2x1bW4oY29tcG9uZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBnZXRQYWdlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgJHNjb3BlLiRvbigncmVsb2FkR3JpZCcsIGZ1bmN0aW9uKGV2ZW50LCBzcmMsIHF1ZXJ5KSB7XG4gICAgICAgICAgaWYgKHNyYykge1xuICAgICAgICAgICAgJHNjb3BlLnNyYyA9IHNyYztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgICAgICAkc2NvcGUucXVlcnkgPSBxdWVyeTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbG9hZEdyaWQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbG9hZEdyaWQoKTtcbiAgICAgIH1cbiAgICBdXG4gIH07XG59KTtcbiJdfQ==

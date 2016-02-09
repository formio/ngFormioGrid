(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
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
            columns: '=?'
        },
        template: '<div><div ui-grid="gridOptions" ui-grid-pagination class="grid"></div></div>',
        controller: [
            'Formio',
            'formioComponents',
            'FormioUtils',
            '$scope',
            function(
                Formio,
                formioComponents,
                FormioUtils,
                $scope
            ) {
                var formio = null;
                var paginationOptions = {
                    pageNumber: 1,
                    pageSize: 25
                };

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
                };

                $scope.gridOptions = {
                    paginationPageSizes: [25, 50, 75],
                    paginationPageSize: paginationOptions.pageSize,
                    useExternalPagination: true,
                    enableSorting: false,
                    columnDefs: [],
                    data: [],
                    onRegisterApi: function(gridApi) {
                        $scope.gridApi = gridApi;
                        gridApi.pagination.on.paginationChanged($scope, function (newPage, pageSize) {
                            paginationOptions.pageNumber = newPage;
                            paginationOptions.pageSize = pageSize;
                            getPage();
                        });
                    }
                };

                // Load a new grid view.
                var loadGrid = function() {
                    if (!$scope.src) { return; }
                    formio = new Formio($scope.src);
                    formio.loadForm().then(function(form) {
                        $scope.gridOptions.columnDefs = [];
                        $scope.gridOptions.columnDefs.push({
                            name: '',
                            field: '_id',
                            width: 35,
                            cellTemplate: '<a class="btn btn-sm btn-default" ng-click="$emit(\'rowView\', row.entity)"><span class="glyphicon glyphicon-share-alt" aria-hidden="true"></span></a>'
                        });
                        FormioUtils.eachComponent(form.components, function(component) {
                            if (
                                ($scope.columns && ($scope.columns.indexOf(component.key) !== -1)) ||
                                (!$scope.columns && component.input && component.tableView)
                            ) {
                                $scope.gridOptions.columnDefs.push({
                                    component: component,
                                    name: component.label,
                                    field: 'data.' + component.key,
                                    cellTemplate: '<div class="ui-grid-cell-contents" bind-html-compile="COL_FIELD | formioTableView:this.col.colDef.component"></div>'
                                });
                            }
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

},{}]},{},[1]);

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
                    $scope.query.sort = paginationOptions.sort;
                    formio.loadSubmissions({params: $scope.query}).then(function(submissions) {
                        $scope.gridOptions.totalItems = submissions.serverCount;
                        $scope.gridOptions.data = submissions;
                    });
                };

                $scope.gridOptions = {
                    paginationPageSizes: [5,25, 50, 75],
                    paginationPageSize: paginationOptions.pageSize,
                    useExternalPagination: true,
                    useExternalSorting: true,
                    columnDefs: [],
                    data: [],
                    onRegisterApi: function(gridApi) {
                        $scope.gridApi = gridApi;
                        gridApi.pagination.on.paginationChanged($scope, function (newPage, pageSize) {
                            paginationOptions.pageNumber = newPage;
                            paginationOptions.pageSize = pageSize;
                            getPage();
                        });
                        // Ui Grid External sort code.
                        gridApi.core.on.sortChanged($scope,function(grid, sortColumns) {
                            if( sortColumns.length === 0) {
                                  paginationOptions.sort = null;
                            } else {
                                switch( sortColumns[0].sort.direction ) {
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

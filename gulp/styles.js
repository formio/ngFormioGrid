module.exports = function(gulp, plugins) {
    return function () {
        return gulp.src(['bower_components/angular-ui-grid/ui-grid.css'])
            .pipe(plugins.cssnano())
            .pipe(plugins.rename('ng-formio-grid-full.min.css'))
            .pipe(gulp.dest('dist'));
    };
};
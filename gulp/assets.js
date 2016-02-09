module.exports = function(gulp) {
    return function () {
        return gulp.src([
                'bower_components/angular-ui-grid/ui-grid.eot',
                'bower_components/angular-ui-grid/ui-grid.svg',
                'bower_components/angular-ui-grid/ui-grid.ttf',
                'bower_components/angular-ui-grid/ui-grid.woff'
            ])
            .pipe(gulp.dest('dist'));
    };
};
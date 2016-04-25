module.exports = function (gulp, plugins) {
  return function () {
    return plugins.browserify({
        entries: './src/formio-grid-full.js',
        debug: false
      })
      .bundle()
      .pipe(plugins.source('ng-formio-grid-full.js'))
      .pipe(gulp.dest('dist/'))
      .pipe(plugins.rename('ng-formio-grid-full.min.js'))
      .pipe(plugins.streamify(plugins.uglify()))
      .pipe(gulp.dest('dist/'));
  };
};
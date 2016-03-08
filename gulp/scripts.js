var path = require('path');
module.exports = function(gulp, plugins, bundle) {

  return function() {
    bundle = bundle || plugins.browserify({
      entries: './src/formio-grid.js',
      debug: false
    });

    return bundle
      .bundle()
      .pipe(plugins.source('ng-formio-grid.js'))
      .pipe(gulp.dest('dist/'))
      .pipe(plugins.rename('ng-formio-grid.min.js'))
      .pipe(plugins.streamify(plugins.uglify()))
      .pipe(gulp.dest('dist/'))
      .on('error', function(err){
        console.log(err);
        this.emit('end');
      });
  };
};

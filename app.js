
/**
 * Module dependencies.
 */

var express = require('express'),
    request = require('request'),
    // database
    mongoose = require('mongoose'),
    // authentication
    passport = require('passport'),
    TwitterStrategy = require('passport-twitter').Strategy,
    FacebookStrategy = require('passport-facebook').Strategy;

require('express-mongoose');
require('datejs/lib/date-es-ES');

module.exports = function (config) {
  /**
   * Database configuration
   */
  mongoose.connect('mongodb://localhost/' + config.db.name );

  // modelos
  require('./models/user');
  require('./models/message');

  /**
   * Auth configuration
   */
  var auth = require('./auth'),
    sche = config.secure ? 'https' : 'http';

  passport.use(new TwitterStrategy({
      consumerKey: config.twitter.consumerKey,
      consumerSecret: config.twitter.consumerSecret,
      callbackURL: sche+"://"+config.host+":"+config.port+"/auth/twitter/callback"
    }, auth.twitter));

  passport.use(new FacebookStrategy({
      clientID: config.facebook.appId,
      clientSecret: config.facebook.appSecret,
      callbackURL: sche+"://"+config.host+":"+config.port+"/auth/facebook/callback"
    }, auth.facebook));

  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(auth.user);

  /*
   * Session configurations
   */
  var sessionStore = new (require('connect-mongo')(express))({ db: config.db.name });

  /*
   * App configuration
   */
  var app = express();

  app.configure(function(){
    app.set('port', config.port);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');

    app.use(express.static(__dirname + '/public'));
    app.use(express.favicon(__dirname + '/public/images/favicon.ico'));

    app.use(express.logger('tiny'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser(config.cookie.secret));
    app.use(express.session({secret: config.session.secret, key: config.session.key, store: sessionStore }));

    app.use(passport.initialize());
    app.use(passport.session());

    app.use(function (req, res, next) {
      if(req.user && !req.user.ip) {
        request({ url: 'https://mejorando.la/locateme?ip='+req.ip },
          function (err, response, body) {
            if(err) return next();

            req.user.ip = req.ip;
            req.user.pais = body;

            req.user.save();

            next();
        });
      } else {
        next();
      }
    });

    app.use(app.router);

    app.use(require('raven').middleware.express(config.sentry_dsn));
  });

  app.configure('development', function(){
    app.use(express.logger('dev'));
    app.use(express.errorHandler());
  });

  /*
   * Routes
   */
  require('./routes')(app, passport);

  return { app: app, sessionStore: sessionStore };
};
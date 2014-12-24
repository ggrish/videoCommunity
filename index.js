var express = require('express');
var mongodb = require('mongodb');
var bodyParser = require('body-parser');
var MongoClient = mongodb.MongoClient;
var ObjectID = mongodb.ObjectID;
var auth = require('http-auth');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcrypt');

var app = express();
app.collection = {};
app.use(bodyParser.urlencoded({'extended': true}));

function wwwRedirect(req, res, next) {
    if (req.headers.host.slice(0, 4) === 'www.') {
        var newHost = req.headers.host.slice(4);
        return res.redirect(301, req.protocol + '://' + newHost + req.originalUrl);
    }
    next();
}

app.set('trust proxy', true);
app.use(wwwRedirect);

app.use(passport.initialize());
app.use(express.static(__dirname + '/static'));


app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/contactus', function (req, res) {
    res.render('contactus');
});

var basic = auth.basic({
        realm: "Web."
    }, function (username, password, callback) { // Custom authentication method.
        callback(username === "vizzit" && password === "T00rL00k");
    }
);


app.get('/tour', auth.connect(basic), function (req, res) {
    app.collection.tour.find({}).toArray(
        function (err, tours) {
            res.render('tour', {
                tours: tours
            });
        }
    );
});

app.post('/tour', function (req, res) {
    var videoUrl = req.body['videoUrl'];
    var newTour = {
        videoUrl: videoUrl
    };
    app.collection.tour.insert(newTour, function (err, dbTour) {
        if (err) {
            console.log('DB err' + err);
        }
    });
    res.redirect('/tour');
});

app.get('/tour/:tid', function (req, res) {
    var tid = req.param('tid');
    app.collection.tour.findOne({'_id': ObjectID(tid)}, function (err, tour) {
        app.collection.property.findOne({'_id': ObjectID(tour.property)}, function (err, property) {
            app.collection.agent.findOne({'_id': ObjectID(property.agent)}, function (err, agent) {
                res.render('tour_details', {
                    tour: tour,
                    property: property,
                    mapQuery: property.address.replace(' ', '+'),
                    agent: agent
                });

            });
        });

    });
});

app.get('/login', function (req, res) {
    res.render('login');
});

app.post('/login',
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login'
    })
);

app.get('/signup', function (req, res) {
    res.render('signup');
});

passport.use(new LocalStrategy(
    function (email, password, done) {
        app.collection.agent.findOne({email: email}, function (err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false, {message: 'Incorrect username.'});
            }
            if (!bcrypt.compareSync(password, user.passwordHash)) {
                return done(null, false, {message: 'Incorrect password.'});
            }
            return done(null, user);
        });
    }
));

var mongoURI = 'mongodb://vizzit123:321tizziv@proximus.modulusmongo.net:27017/i8Jypyzy';
var port = process.env.PORT || 3000;

MongoClient.connect(mongoURI, function (dbErr, db) {
    if (dbErr) throw dbErr;

    app.collection.tour = db.collection('tour');
    app.collection.property = db.collection('property');
    app.collection.agent = db.collection('agent');

    app.use(session({
        secret: 'VizzitSessionSecret',
        resave: false,
        saveUninitialized: false,
        store: new MongoStore({
            db: db
        })
    }));
    app.use(passport.session());

    app.listen(port, function () {
        console.log('Vizzit app listening at port:%s', port)
    });
});


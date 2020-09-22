var express  = require('express');
var cookieParser = require('cookie-parser');
var i18n = require('./i18n');
var session  = require('express-session');
var redis = require("redis");
var RedisStore = require('connect-redis')(session);
var client  = redis.createClient();
var app      = express();
var path     = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
var flash    = require('connect-flash');
var async    = require('async');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var nodemailer = require("nodemailer");
var schedule = require('node-schedule');
var mongojs = require('mongojs');
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var host="mildwall.com";
var validUser = mongojs('mildwall',['validCheck']);
var tempPwd = mongojs('mildwall',['findpwd']);
var tempCoord = mongojs('mildwall',['saveCoord']);
var protect = mongojs('mildwall',['protectImg']);
var tempUser = mongojs('mildwall',['optUser']);
var image = mongojs('mildwall',['imageInfo']);
var personal = mongojs('mildwall',['userImage']);
var security = mongojs('mildwall',['share']);
var search = mongojs('mildwall',['keyword']);
var save = mongojs('mildwall',['url']);
var each = mongojs('mildwall',['chat']);
var map = mongojs('mildwall',['gps']);
var pageInfo = mongojs('mildwall',['userPage']);
var clients =[];
var todayVisitor = 0;
var today = mongojs('mildwall',['visitor']);
var sum = mongojs('mildwall',['total']);
var smtpTransport = nodemailer.createTransport("SMTP",{
      service: "Gmail",
      auth: {
          user: "",
          pass: ""
      }
    });
mongoose.connect("mongodb://localhost/mildwall");
var db = mongoose.connection;
db.once("open",function () {
  console.log("DB connected!");
});
db.on("error",function (err) {
  console.log("DB ERROR :", err);
});
var postSchema = mongoose.Schema({
  title: {type:String, required:true},
  body: {type:String, required:true},
  author: {type:mongoose.Schema.Types.ObjectId, ref:'user', required:true},
  createdAt: {type:Date, default:Date.now},
  updatedAt: Date
});
var Post = mongoose.model('post',postSchema);
var bcrypt = require("bcrypt-nodejs");
var friends = require("mongoose-friends");
var userSchema = mongoose.Schema({
  email: {type:String, required:true, unique:true},
  nickname: {type:String, required:true},
  password: {type:String, required:true},
  gender: {type:String, required:true},
  genderShow: {type:String},
  randValue : {type:String},
  class : {type:String},
  findpwd: {type:String},
  createdAt: {type:Date, default:Date.now}
});
userSchema.plugin(friends({pathName: "relation"}));
var editCheck = false;
userSchema.pre("save", function (next){
    var user = this;
    var rand,mailOptions,link;
    if(!user.isModified("password")){
      return next();
    } else{
      if (editCheck) {
        editCheck = false;
        user.password = bcrypt.hashSync(user.password);
        return next();
      }else{
      user.password = bcrypt.hashSync(user.password);
      rand=Math.floor(((Math.random() * 100) + 54)*((Math.random() * 100) + 46));
      link="http://"+host+"/verify?id="+rand;
      validUser.validCheck.insert({randValue : rand, randLink : link});
      mailOptions={
        from : 'MildWall Service Team <mildwall.service@gmail.com>',
        to : user.email,
        subject : "온라인 낙서장 MildWall에 가입을 축하드립니다.",
        html : "<h1 style='color:#ffb347'>MildWall</h1><h2>안녕하세요,</h2><p style='font-size:20px'>"+user.nickname+"님의 가입을 진심으로 환영합니다.<br>평소 못했던 말들!!!<br>이제 MildWall에서 낙서하세요.<br>항상 발전하는 MildWall이 되기 위해 최선을 다하겠습니다.<br><a href="+link+">이메일 인증하기</a></p>",
      }
      smtpTransport.sendMail(mailOptions);
      user.randValue = rand;
      user.class = "user";
      user.findpwd = "yet";
      return next();
    }
  }
});
userSchema.methods.authenticate = function (password) {
  var user = this;
  return bcrypt.compareSync(password,user.password);
};
var User = mongoose.model('user',userSchema);
app.get('/verify',function(req,res){
  validUser.validCheck.find(function(error, value){
    for(var i in value){
      if(value[i].randLink==("http://"+host+"/verify?id="+req.query.id)){
        validUser.validCheck.find(function(error, data){
          for(var j in data){
            if(data[j].randValue==req.query.id){
              User.findOneAndUpdate({ randValue: data[j].randValue }, { randValue: 'access' }, function(err, changed) {
                if (err) throw err;
                if(changed){
                  pageInfo.userPage.insert({id:""+changed._id,pageN:"1",show:"yes",edit:"yes"});
                  pageInfo.userPage.insert({id:""+changed._id,pageN:"2",show:"yes",edit:"yes"});
                  pageInfo.userPage.insert({id:""+changed._id,pageN:"3",show:"yes",edit:"yes"});
                }
              });
              res.end("<h1 style='color:#ffb347'>MildWall</h1><p style='font-size:20px'>Your Email is verified<br>Thank you<br><a href=http://"+host+"/>Go to MildWall</a></p>");
              validUser.validCheck.remove({randValue : data[j].randValue});
              break;
            }
          }
        });
        break;
      }
    }
  });
});
app.get('/findpwd/',function(req,res){
  tempPwd.findpwd.find(function(err,data){
    for(var i in data){
      if(data[i].link==("http://"+host+"/findpwd?id="+req.query.id)){
        if(data[i].rand==req.query.id){
          var temp = bcrypt.hashSync(data[i].rand);
          User.findOneAndUpdate({ findpwd: data[i].rand }, { password: temp }, function(err, changed) {
            if (err) throw err;
          });
          res.end("<h1>Your password is changed<br>Now, you can login using "+data[i].rand+"<br>Please, eidt your password.<br><a href=http://"+host+"/>Go to MildWall</a></h1>");
          tempPwd.findpwd.remove({rand:data[i].rand});
          break;
        }
      }
    }
  });
});
app.set("view engine", 'ejs');
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.use(flash());
app.use(session({
    store: new RedisStore({ host: 'localhost', port: 6379, client: client}),
    secret: 'mildwallSecret',
    resave: false,
    saveUninitialized: true,
    cookie:{
      maxAge:365*24*60*60*1000
    }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(i18n);
passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});
var LocalStrategy = require('passport-local').Strategy;
passport.use('local-login',
  new LocalStrategy({
      usernameField : 'email',
      passwordField : 'password',
      passReqToCallback : true
    },
    function(req, email, password, done) {
      User.findOne({ 'email' :  email }, function(err, user) {
        if (err) return done(err);

        if (!user){
            req.flash("email", req.body.email);
            return done(null, false, req.flash('loginError', 'No user found.'));
        }
        if (!user.authenticate(password)){
            req.flash("email", req.body.email);
            return done(null, false, req.flash('loginError', 'Password does not Match.'));
        }
        if (user.randValue!='access') {
          req.flash("email", req.body.email);
          return done(null, false, req.flash('loginError', 'Please verify your email first.'));
        }
        return done(null, user);
      });
    }
  )
);
io.sockets.on('connection',function(socket){
    socket.on('f_clnt',function(data){
      var Canvas = require('canvas')
        , Image = Canvas.Image
        , width = data.aa_c-data.a_c
        , height = data.b_c-data.bb_c
        , canvas = new Canvas(width, height)
        , ctx = canvas.getContext('2d');
     image.imageInfo.find({$and:[
       {$or:[{xx:{$gt:data.a_c,$lte:data.aa_c}},{x:{$gte:data.a_c,$lt:data.aa_c}}]}
       ,{$or:[{yy:{$gte:data.bb_c,$lt:data.b_c}},{y:{$gt:data.bb_c,$lte:data.b_c}}]}
     ]}).sort({'createdAt': 1},function(err, imageInfo) {
         if(err) return res.json({success:false, message:err});
         for(var i in imageInfo){
           var image = new Image;
           image.src = imageInfo[i].dataURL;
           ctx.drawImage(image,imageInfo[i].x-data.a_c,-imageInfo[i].y+data.b_c);
         }
         var dataURL = canvas.toDataURL();
         if(data.doubleCheck==1){
           doubleCheck=data.doubleCheck;
           socket.emit('t_clnt',{dataURL:dataURL,doubleCheck:doubleCheck});
         }else{
           var doubleCheck = 0;
           socket.emit('t_clnt',{dataURL:dataURL,doubleCheck:doubleCheck});
         }
     });
     search.keyword.find({},function(err,keyword){
       var count=0;
       for(var j in keyword){
         if(parseInt(keyword[j].x-2500)<parseInt(data.a_c)&&parseInt(data.a_c)<parseInt(keyword[j].x+2500)&&parseInt(keyword[j].y-2500)<parseInt(data.b_c)&&parseInt(data.b_c)<parseInt(keyword[j].y+2500)){
           socket.emit('keyList',keyword[j].keyword);
         }else{
           count++;
         }
       }
       if(count==keyword.length){
         var key = "";
         socket.emit('keyList',key);
       }
     });
   });
   socket.on('a_Img',function(data){
     if(data.nick=="MildWall"){
       protect.protectImg.findOne({x:data.a_c,y:data.b_c,xx:data.aa_c,yy:data.bb_c},function(err,opt){
         if(!opt){
           protect.protectImg.insert({x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)});
         }
       });
     }else{
       image.imageInfo.insert({new:"new",opt:"n",dataURL:data.dataURL,x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c),createdAt:new Date()});
       tempCoord.saveCoord.findOne({x:data.a_c,y:data.b_c,xx:data.aa_c,yy:data.bb_c},function(err,opt){
         if(!opt){
           tempCoord.saveCoord.insert({x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)});
         }
       });
       map.gps.find({$and:[
       {$and:[{xx:{$gte:data.aa_c-100}},{x:{$lte:data.a_c+100}}]}
       ,{$and:[{yy:{$lte:data.bb_c+100}},{y:{$gte:data.b_c-100}}]}
     ]},function(err, user) {
           if(err) throw err;
           for(var j in user){
             for(var i=0, len=clients.length; i<len; ++i){
               var c = clients[i];
               if(c){
                 if(user[j].id==c.clientId&&data.id!=c.clientId){
                   if(clients[i].socketId){
                     if(io.sockets.connected[c.socketId]!=undefined){
                       io.sockets.connected[c.socketId].emit('ad_ed',data);
                     }
                   }
                 }
               }
             }
           }
       });
     }
   });
   socket.on('pageReq',function(data){
     pageInfo.userPage.find({id:data},function(err,page){
       socket.emit('pageInfo',page);
     });
   });
   socket.on('f_clntP',function(data){
     var Canvas = require('canvas')
       , Image = Canvas.Image
       , width = data.aa_c-data.a_c
       , height = data.b_c-data.bb_c
       , canvas = new Canvas(width, height)
       , ctx = canvas.getContext('2d');
     personal.userImage.find({id:data.id,pageN:""+data.pageN}).sort({'_id': 1},function(err, imageInfo) {
         if(err) return res.json({success:false, message:err});
         if(imageInfo){
           for(var i in imageInfo){
             var image = new Image;
             image.src = imageInfo[i].dataURL;
             ctx.drawImage(image,imageInfo[i].x-data.a_c,-imageInfo[i].y+data.b_c);
           }
           var dataURL = canvas.toDataURL();
           if(data.doubleCheck==1){
             doubleCheck=data.doubleCheck;
             socket.emit('t_clnt',{dataURL:dataURL,doubleCheck:doubleCheck});
           }else{
             var doubleCheck = 0;
             socket.emit('t_clnt',{dataURL:dataURL,doubleCheck:doubleCheck});
           }
         }
     });
  });
  socket.on('addImageP',function(data){
    personal.userImage.insert({new:"new",pageN:""+data.pageN,opt:"n",id:data.id,dataURL:data.dataURL,x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)});
    tempUser.optUser.findOne({id:data.id,pageN:""+data.pageN,x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)},function(err,userOpt){
      if(!userOpt){
        tempUser.optUser.insert({id:data.id,pageN:""+data.pageN,x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)});
      }
    });
    map.gps.find({page:data.id},function(err, user) {
      if(err) throw err;
      for(var j in user){
        for(var i=0, len=clients.length; i<len; ++i){
          var c = clients[i];
          if(c.clientId!=undefined&&user[j].id==c.clientId&&data.me!=c.clientId){
            if(clients[i].socketId){
              if(io.sockets.connected[c.socketId]!=undefined){
                io.sockets.connected[c.socketId].emit('ad_ed',data);
              }
            }
          break;
          }
        }
      }
    });
  });
  socket.on('z_clnt',function(data){
    var Canvas = require('canvas')
      , Image = Canvas.Image
      , width = data.aa_c-data.a_c
      , height = data.b_c-data.bb_c
      , canvas = new Canvas(width, height)
      , ctx = canvas.getContext('2d');
      ctx.scale(1/3,1/3);
   image.imageInfo.find({$and:[
     {$or:[{xx:{$gt:data.a_c,$lte:data.aa_c}},{x:{$gte:data.a_c,$lt:data.aa_c}}]}
     ,{$or:[{yy:{$gte:data.bb_c,$lt:data.b_c}},{y:{$gt:data.bb_c,$lte:data.b_c}}]}
   ]}).sort({'createdAt': 1},function(err, imageInfo) {
       if(err) throw err;
       for(var i in imageInfo){
         var image = new Image;
         image.src = imageInfo[i].dataURL;
         ctx.drawImage(image,(imageInfo[i].x-data.a_c)*0.977,(-imageInfo[i].y+data.b_c)*0.977);
       }
       var dataURL = canvas.toDataURL();
       if(data.doubleCheck==1){
         doubleCheck=data.doubleCheck;
         socket.emit('t_clnt',{dataURL:dataURL,doubleCheck:doubleCheck});
       }else{
         var doubleCheck = 0;
         socket.emit('t_clnt',{dataURL:dataURL,doubleCheck:doubleCheck});
       }
   });
  });
   socket.on('fnd_E',function(data){
     var count = 3;
     function empty(){
       var random1 = Math.round(Math.random()*1000)*count*(Math.round(Math.random()) * 2 - 1)
       ,random2 = Math.round(Math.random()*1000)*count*(Math.round(Math.random()) * 2 - 1)
       ,randomX = random1+data.a_c
       ,randomY = random2+data.b_c
       ,randomXX = random1+data.aa_c
       ,randomYY = random2+data.bb_c;
        image.imageInfo.findOne({$and:[
          {$or:[{xx:{$gt:randomX,$lte:randomXX}},{x:{$gte:randomX,$lt:randomXX}}]}
          ,{$or:[{yy:{$gte:randomYY,$lt:randomY}},{y:{$gt:randomYY,$lte:randomY}}]}
        ]},function(err, imageInfo){
            if(err) throw err;
            if(imageInfo){
              empty();
            }else{
              var x=randomX;
              var y=randomY;
              socket.emit('found',x,y);
            }
          });
        count++;
      };
      empty();
    });
   socket.on('fnd_D',function(x,y){
     var number=0;
     var len = x.length;
     var xCoord = x;
     var yCoord = y;
     image.imageInfo.count(function(err,count){
       number=count;
     });
     function doodle(){
       image.imageInfo.find({}).limit(1).skip(Math.random()*number,function(err,datum){
         if(datum[0]){
           var checkItOut=0;
           async.waterfall(
               [
                 function(callback) {
                   for(var i=0; i<len; i++){
                     if(datum[0].x==xCoord[i]&&datum[0].y==yCoord[i]){
                       doodle();
                     }else{
                       checkItOut++;
                     }
                   }
                   if(checkItOut==len){
                     isValid=true;
                     callback(null, isValid);
                   }
                }
                 ],
                 function(err, isValid) {
                   if(isValid){
                     var x = datum[0].x;
                     var y = datum[0].y;
                     socket.emit('found',x,y);
                   }else{
                     doodle();
                   }
           });
         }
       });
     };
     doodle();
   });
   socket.on('lctn',function(data){
     var myId = data.id;
     if(data.userPage){
       if(data.doubleCheck==0){
         var clientInfo = new Object();
         clientInfo.clientId = data.id;
         clientInfo.socketId = socket.id;
         for( var i=0, len=clients.length; i<len; ++i ){
           if(clients[i].clientId!=undefined){
             if(clients[i].clientId==data.id){
               clients.splice(i,1);
               break;
             }
           }
         }
         clients.push(clientInfo);
       }
       for( var i=0, len=clients.length; i<len; ++i ){
         var c = clients[i];
         if(data.id==c.clientId){
           if(data.id<1){
             map.gps.find({id:data.id,page:data.page},function(err,randGps){
               if(randGps.length<1) {
                 map.gps.insert({id:data.id,page:data.page});
               }
             });
           }else{
             map.gps.findOne({id:data.id},function(err,double){
               if(double){
                 map.gps.remove({id:data.id});
                 map.gps.insert({id:data.id,page:data.page});
               }
             });
             map.gps.insert({id:data.id,page:data.page},function(err,ad_ed){
               if(data.user){
                 map.gps.findOne({id:""+myId},function(err, data){
                   if(err) throw err;
                   User.findOne({_id:myId},function(err, me){
                     if(me){
                       User.getFriends(me, function(err, friends){
                         if(err) throw err;
                         for(var j in friends){
                           for(var i=0, len=clients.length; i<len; ++i){
                             var c = clients[i];
                             if(c){
                               if(friends[j]._id==c.clientId){
                                 data=ad_ed;
                                 if(clients[i].socketId){
                                   if(io.sockets.connected[c.socketId]!=undefined){
                                     io.sockets.connected[c.socketId].emit('userGps',data);
                                   }
                                 }
                               }
                             }
                           }
                         }
                       });
                     }
                   });
                 });
               }
             });
           }
         }
       }
     }else{
       if(data.id<1){
         if(data.aa_c){
           map.gps.findOne({id:data.id},function(err,play){
             if(play){
               if(play.playWith=="n"){
                 map.gps.remove({id:data.id,x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)});
                 map.gps.insert({id:data.id,playWith:"n",x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)});
               }else{
                 map.gps.remove({id:data.id,x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)});
                 map.gps.insert({id:data.id,playWith:"y",x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)});
               }
             }else{
               map.gps.insert({id:data.id,playWith:"y",x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)});
             }
           });
         }
       }else{
         if(data.aa_c){
           map.gps.findOne({id:data.id},function(err,play){
             if(play){
               if(play.playWith=="n"){
                 map.gps.remove({id:data.id,x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)});
                 map.gps.insert({id:data.id,playWith:"n",x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)},function(err, ad_ed){
                   if(data.user){
                     map.gps.findOne({id:""+myId},function(err, data){
                       if(err) throw err;
                       User.findOne({_id:myId},function(err, me){
                         if(me){
                           User.getFriends(me, function(err, friends){
                             if(err) throw err;
                             for(var j in friends){
                               for(var i=0, len=clients.length; i<len; ++i){
                                 var c = clients[i];
                                 if(c.clientId!=undefined){
                                   if(friends[j]._id==c.clientId){
                                     data=ad_ed;
                                     if(clients[i].socketId){
                                       if(io.sockets.connected[c.socketId]!=undefined){
                                         io.sockets.connected[c.socketId].emit('userGps',data);
                                       }
                                     }
                                   }
                                 }
                               }
                             }
                           });
                         }
                       });
                     });
                   }
                 });
               }else{
                 map.gps.remove({id:data.id,x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)});
                 map.gps.insert({id:data.id,playWith:"y",x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)},function(err, ad_ed){
                   if(data.user){
                     map.gps.findOne({id:""+myId},function(err, data){
                       if(err) throw err;
                       User.findOne({_id:myId},function(err, me){
                         if(me){
                           User.getFriends(me, function(err, friends){
                             if(err) throw err;
                             for(var j in friends){
                               for(var i=0, len=clients.length; i<len; ++i){
                                 var c = clients[i];
                                 if(c){
                                   if(c.clientId!=undefined){
                                     if(friends[j]._id==c.clientId){
                                       data=ad_ed;
                                       if(clients[i].socketId){
                                         if(io.sockets.connected[c.socketId]!=undefined){
                                           io.sockets.connected[c.socketId].emit('userGps',data);
                                         }
                                       }
                                     }
                                   }
                                 }
                               }
                             }
                           });
                         }
                       });
                     });
                   }
                 });
               }
             }else{
               map.gps.insert({id:data.id,playWith:"y",x:parseInt(data.a_c),y:parseInt(data.b_c),xx:parseInt(data.aa_c),yy:parseInt(data.bb_c)},function(err, ad_ed){
                 if(data.user){
                   map.gps.findOne({id:""+myId},function(err, data){
                     if(err) throw err;
                     User.findOne({_id:myId},function(err, me){
                       if(me){
                         User.getFriends(me, function(err, friends){
                           if(err) throw err;
                           for(var j in friends){
                             for(var i=0, len=clients.length; i<len; ++i){
                               var c = clients[i];
                               if(c.clientId!=undefined){
                                 if(friends[j]._id==c.clientId){
                                   data=ad_ed;
                                   if(clients[i].socketId){
                                     if(io.sockets.connected[c.socketId]!=undefined){
                                       io.sockets.connected[c.socketId].emit('userGps',data);
                                     }
                                   }
                                 }
                               }
                             }
                           }
                         });
                       }
                     });
                   });
                 }
               });
             }
           });
         }
       }
       map.gps.findOne({id:data.id},function(err, gps){
         if(err){
           throw err;
         }else{
           if(gps){
             if(gps.x!=data.a_c || gps.y!=data.b_c){
               map.gps.remove({id:data.id, x:gps.x, y:gps.y});
             }
           }
         }
       });
       if(data.doubleCheck==0&&data.once==1){
         var clientInfo = new Object();
         clientInfo.clientId = data.id;
         clientInfo.socketId = socket.id;
         clients.push(clientInfo);
       }
     }
   });
   socket.on('disconnect', function(){
     for( var i=0, len=clients.length; i<len; ++i ){
       var c = clients[i];
       if(c.socketId == socket.id){
         if(c.clientId<1){
           map.gps.remove({id:c.clientId});
         }else{
           map.gps.remove({id:""+c.clientId},function(err, map){
             if(err) throw err;
             User.findOne({_id:c.clientId},function(err, me){
               if(me){
                 User.getFriends(me, function(err, friends){
                   if(err) throw err;
                   for(var j in friends){
                     for(var k=0, len=clients.length; k<len; ++k){
                       if(friends[j]._id==clients[k].clientId){
                         if(clients[k].socketId){
                           if(io.sockets.connected[clients[k].socketId]!=undefined){
                             io.sockets.connected[clients[k].socketId].emit('userDis',c.clientId);
                           }
                         }
                       }
                     }
                   }
                 });
               }
             });
           });
         }
         clients.splice(i,1);
         break;
       }
     }
   });
   socket.on('callGps',function(){
     map.gps.find({},function(err, gps){
       if(err) throw err;
       socket.emit('gps',gps);
     });
   });
   socket.on('delKeyword',function(data){
     search.keyword.remove({keyword:data});
   });
   socket.on('search',function(data){
     User.find({$or:[{email: RegExp('^'+data+'','i')},{nickname: RegExp('^'+data+'','i')}]},{},{limit:7},function(err, user){
       if(err) throw err;
       socket.emit('userResult',user);
     });
     search.keyword.find({keyword:RegExp('^'+data+'','i')},{},{limit:7}).sort({ keyword: 1 },function(err, keyword){
       if(err) throw err;
       socket.emit('keywordResult',keyword);
     });
   });
   socket.on('keyword',function(data){
     var count = 1;
     function empty(){
       var keyX = Math.round(Math.random()*100000)*count*(Math.round(Math.random()) * 2 - 1)
       ,keyY = Math.round(Math.random()*100000)*count*(Math.round(Math.random()) * 2 - 1)
       ,keyXX = keyX+5000
       ,keyYY = keyY+5000;
        image.imageInfo.findOne({$and:[
          {$or:[{xx:{$gt:keyX,$lte:keyXX}},{x:{$gte:keyX,$lt:keyXX}}]}
          ,{$or:[{yy:{$gte:keyYY,$lt:keyY}},{y:{$gt:keyYY,$lte:keyY}}]}
        ]},function(err, imageInfo){
            if(err) throw err;
            if(imageInfo){
              empty();
            }else{
              var x = (keyX+keyXX)/2
              ,y = (keyY+keyYY)/2;
              socket.emit('found',x,y);
              search.keyword.insert({keyword:data, x:parseInt(x), y:parseInt(y), createdAt:new Date()});
            }
          });
        count++;
      };
      empty();
   });
   socket.on('frRequest',function(data){
     User.requestFriend(data.id, data.frid, function(err, frRequest){
       if(err) throw err;
       socket.emit('reqDoneAlert');
       for( var i=0, len=clients.length; i<len; ++i ){
         var c = clients[i];
         if(data.frid==c.clientId){
           if(clients[i].socketId){
             if(io.sockets.connected[c.socketId]!=undefined){
               io.sockets.connected[c.socketId].emit('frRefresh');
             }
           }
         }
        }
     });
   });
   socket.on('listReq',function(myId){
     if(myId!='none'){
       User.findOne({_id:myId},function(err, me){
         if(me){
           User.getFriends(me,{},null,{sort:{nickname: 1}},function(err, friends){
             if(err) throw err;
             socket.emit('frList',friends);
             for(var i in friends){
               map.gps.findOne({id:""+friends[i]._id},function(err, data){
                 if(err) throw err;
                 socket.emit('userGps',data);
               });
               each.chat.findOne({from:""+friends[i]._id,to:myId,read:'n'},function(err, data){
                 if(data){
                   socket.emit('unread',data.from);
                 }
               });
             }
           });
         }
       });
       save.url.find({id:myId},function(err, data){
         if(err) throw err;
         socket.emit('faList',data);
       });
     }
   });
   socket.on('favorite',function(data){
     save.url.findOne({id:data.id,title:data.title},function(err, favo){
       if(err) throw err;
       if(favo){
         save.url.remove({id:data.id,title:data.title});
         save.url.insert({id:data.id,title:data.title,x:parseInt(data.x),y:parseInt(data.y)});
       }else{
         save.url.insert({id:data.id,title:data.title,x:parseInt(data.x),y:parseInt(data.y)});
       }
       socket.emit('reqDoneAlert');
     });
   });
   socket.on('faCancel',function(data){
     save.url.remove({id:data.id,title:data.title});
     socket.emit('reqDoneAlert');
   });
   socket.on('frCancel',function(data){
     User.findOne({_id:data.id},function(err, me){
       if(err) throw err;
       User.findOne({_id:data.frid},function(err, frid){
         if(err) throw err;
         User.removeFriend(me, frid, function(err, frCancel){
           if(err) throw err;
           socket.emit('reqDoneAlert');
         });
         for( var i=0, len=clients.length; i<len; ++i ){
           var c = clients[i];
           if(data.frid==c.clientId){
             if(clients[i].socketId){
               if(io.sockets.connected[c.socketId]!=undefined){
                 io.sockets.connected[c.socketId].emit('frRefresh');
               }
             }
           }
          }
       });
     });
   });
   socket.on('frAccept',function(data){
     User.requestFriend(data.id, data.frid, function(err, frAccept){
       if(err) throw err;
       socket.emit('reqDoneAlert');
       for( var i=0, len=clients.length; i<len; ++i ){
         var c = clients[i];
         if(data.frid==c.clientId){
           if(clients[i].socketId){
             if(io.sockets.connected[c.socketId]!=undefined){
               io.sockets.connected[c.socketId].emit('frRefresh');
             }
           }
         }
        }
     });
   });
   socket.on('frChat',function(data){
     each.chat.find({from:data.frid,to:data.id,read:'n'},function(err, chat){
       for(var c in chat){
         each.chat.update({from:data.frid,to:data.id,read:'n'},{$set : {'read':'y'}});
       }
     });
     each.chat.find({$or:
       [{from:data.id,to:data.frid}
       ,{from:data.frid,to:data.id}]
     }).sort({'created': 1},function(err, log){
       if(log){
         socket.emit('chatLog',log);
         for( var i=0, len=clients.length; i<len; ++i ){
           var c = clients[i];
           if(data.frid==c.clientId){
             if(clients[i].socketId){
               if(io.sockets.connected[c.socketId]!=undefined){
                 io.sockets.connected[c.socketId].emit('chatLog',log);
               }
             }
           }
         }
       }
     });
   });
   socket.on('chatSend',function(data){
     if(data.frid){
       each.chat.insert({from:data.id,to:data.frid,created:data.date,msg:data.msg,read:'n'},function(msg){
         for( var i=0, len=clients.length; i<len; ++i ){
           var c = clients[i];
           if(data.frid==c.clientId){
             if(clients[i].socketId){
               if(io.sockets.connected[c.socketId]!=undefined){
                 io.sockets.connected[c.socketId].emit('msg',data);
               }
             }
           }
         }
       });
     }
   });
   socket.on('chatRead',function(data){
     each.chat.find({from:data.id,to:data.frid,read:'n'},function(err, chat){
       each.chat.update({from:data.id,to:data.frid,read:'n'},{$set : {'read':'y'}});
     });
   });
   socket.on('shareAll',function(data){
     if(data){
       security.share.remove({id:data});
       security.share.insert({id:data,option:'all'});
     }
   });
   socket.on('shareFr',function(data){
     if(data){
       security.share.remove({id:data});
       security.share.insert({id:data,option:'fr'});
     }
   });
   socket.on('shareNone',function(data){
     if(data){
       security.share.remove({id:data});
       security.share.insert({id:data,option:'none'});
     }
   });
   socket.on('pageShowY',function(data){
     if(data){
       pageInfo.userPage.update({id:data.id,pageN:""+data.pageN}, {$set: {show: "yes"}}, { multi: false });
     }
   });
   socket.on('pageShowN',function(data){
     if(data){
       pageInfo.userPage.update({id:data.id,pageN:""+data.pageN}, {$set: {show: "no"}}, { multi: false });
     }
   });
   socket.on('pageEditY',function(data){
     if(data){
       pageInfo.userPage.update({id:data.id,pageN:""+data.pageN}, {$set: {edit: "yes"}}, { multi: false });
     }
   });
   socket.on('pageEditN',function(data){
     if(data){
       pageInfo.userPage.update({id:data.id,pageN:""+data.pageN}, {$set: {edit: "no"}}, { multi: false });
     }
   });

   socket.on('removeUser',function(data){
     User.remove({_id:data.id},function(err,user){
       if (err) throw err;
     });
     Post.remove({author:data.id},function(err,post){
       if (err) throw err;
     });
     save.url.remove({id:data.id});
     each.chat.remove({$or:[{from:data.id},{to:data.id}]});
     security.share.remove({id:data.id});
     personal.userImage.remove({id:data.id});
     pageInfo.userPage.remove({id:data.id});
     tempPwd.findpwd.remove({email:data.email});
   });
   socket.on('playWith',function(data){
     map.gps.update({id:data}, {$set: {playWith:"y"}}, { multi: false });
   });
   socket.on('playWithCancel',function(data){
     map.gps.update({id:data}, {$set: {playWith:"n"}}, { multi: false });
   });
   socket.on('fnd_P',function(){
     map.gps.find({playWith:"y"},function(err,play){
       var rand=Math.floor((Math.random()*(play.length+1)));
       if(play[rand]){
         var x=play[rand].x
         , y=play[rand].y;
         socket.emit('found',x,y);
       }
     });
   });
 socket.on("whoIsOnReq",function(data){
   map.gps.find({$and:[
      {$and:[{x:{$gte:data.a_c-2500}},{x:{$lte:data.a_c+2500}}]}
      ,{$and:[{y:{$lte:data.b_c+2500}},{y:{$gte:data.b_c-2500}}]}
    ]},function(err, data){
      for(var i in data){
        if(data[i].id<1){
          map.gps.find({id:data[i].id},function(err, location){
            if(location){
              var id=location[0].id;
              socket.emit("whoIsOnList",location,id); //페이지에 검색된 사용자목록을 보내주는 부분
            }
          });
        }else{
          User.find({_id:data[i].id},function(err,datum){
            if(datum){
              var id=datum;
              map.gps.find({id:""+datum[0]._id},function(err, location){
                if(location){
                  socket.emit("whoIsOnList",location,id); //페이지에 검색된 사용자목록을 보내주는 부분
                }
              });
            }
          });
        }
      }
   });
 });
 socket.on("gChatSend",function(data){
   map.gps.find({$and:[
      {$and:[{x:{$gte:data.a_c-2500}},{x:{$lte:data.a_c+2500}}]}
      ,{$and:[{y:{$lte:data.b_c+2500}},{y:{$gte:data.b_c-2500}}]}
    ]},function(err,log){
      for(var j in log){
        for( var i=0, len=clients.length; i<len; ++i ){
          var c = clients[i];
          if(log[j].id==c.clientId){
            if(clients[i].socketId){
              if(io.sockets.connected[c.socketId]!=undefined){
                io.sockets.connected[c.socketId].emit('gmsg',data);
              }
            }
          }
        }
      }
    });
 });
 socket.on("anouncement",function(data){
   socket.broadcast.emit("anouncement",data);
 });
});
app.get('/', function (req,res) {
  todayVisitor++;
  sum.total.findOne({},function(err, count){
    if(count){
      sum.total.remove({});
      if(clients.length+1>count.ccuMAX){
        sum.total.insert({total:count.total+1,ccuMAX:clients.length+1});
      }else{
        sum.total.insert({total:count.total+1,ccuMAX:count.ccuMAX});
      }
    }else{
      sum.total.insert({total:1,ccuMAX:1});
    }
  });
  var randX = Math.round(Math.random()*100000)*(Math.round(Math.random()) * 2 - 1)
  ,randY = Math.round(Math.random()*100000)*(Math.round(Math.random()) * 2 - 1);
  res.render("main/index", {user:req.user,x:randX,y:randY});
});
app.get('/ban', function (req,res) {
  res.render("main/ban");
});
app.get('/about', function (req,res) {
  res.render("main/about", {user:req.user});
});
app.get('/login', function (req,res) {
  res.render('login/login',{email:req.flash("email")[0], loginError:req.flash('loginError')});
});
app.post('/login', function (req,res,next){
    req.flash("email");
    if(req.body.email.length === 0 || req.body.password.length === 0){
      req.flash("email", req.body.email);
      req.flash("loginError","Please enter both email and password.");
      res.redirect('/login');
    } else{
      next();
    }
  }, passport.authenticate('local-login', {
    successRedirect : '/',
    failureRedirect : '/login',
    failureFlash : true
  })
);
app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});
app.get('/users/new', function(req,res){
  res.render('users/new', {
                            formData: req.flash('formData')[0],
                            emailError: req.flash('emailError')[0],
                            nicknameError: req.flash('nicknameError')[0],
                            passwordError: req.flash('passwordError')[0]
                          }
  );
});
app.post('/users', checkUserRegValidation, function(req,res,next){
  if(req.body.user.genderShow==undefined){
    req.body.user.genderShow="no";
  }
  User.create(req.body.user, function (err,user) {
    if(err) {
      req.flash("emailError","- This email is already resistered.");
      res.redirect('/users/new');
    } else{
      req.flash("loginError",req.body.user.email+"로 인증메일이 발송 되었습니다.");
      res.redirect('/login');
      }
  });
});
app.get('/users/:id', function(req,res){
    User.findById(req.params.id, function (err,user) {
      if(user){
        security.share.findOne({id:''+user._id},function(err, share){
          if(err) return res.json({success:false, message:err});
          if(share){
            if(share.option=='fr'){
              if(req.user){
                if(req.user._id==req.params.id){
                  res.render("users/show", {user: user, myId:req.user});
                }else{
                  User.getFriends(user, function(err, friends){
                    if(friends==''){
                      res.redirect('/ban');
                    }else{
                      var j=0;
                      for(var i in friends){
                        if(''+req.user._id==''+friends[i]._id && friends[i].status=='accepted'){
                          res.render("users/show", {user: user, myId:req.user});
                          break;
                        }
                        j++;
                        if(j==friends.length){
                          res.redirect('/ban');
                          break;
                        }
                      }
                    }
                  });
                }
              }else{
                res.redirect('/ban');
              }
            }else if(share.option=='none'){
              if(req.user){
                if(req.user._id==req.params.id){
                  res.render("users/show", {user: user, myId:req.user});
                }else{
                  res.redirect('/ban');
                }
              }else{
                res.redirect('/ban');
              }
            }else{
              if(req.user){
                res.render("users/show", {user: user, myId:req.user});
              } else{
                var none = {_id:"none"};
                res.render("users/show", {user: user, myId:none});
              }
            }
          }else{
            if(req.user){
              if(req.user._id==req.params.id){
                res.render("users/show", {user: user, myId:req.user});
              }else{
                res.redirect('/ban');
              }
            }else{
              res.redirect('/ban');
            }
          }
        });
      }
    });
});
app.get('/users/:id/edit', isLoggedIn, function(req,res){
  if(req.user._id != req.params.id) return res.json({success:false, message:"Unauthrized Attempt"});
  User.findById(req.params.id, function (err,user) {
    if(err) return res.json({success:false, message:err});
    res.render("users/edit", {
                              user: user,
                              formData: req.flash('formData')[0],
                              emailError: req.flash('emailError')[0],
                              nicknameError: req.flash('nicknameError')[0],
                              passwordError: req.flash('passwordError')[0]
                             }
    );
  });
});
app.put('/users/:id', checkUserRegValidation, function(req,res){
  if(req.user._id != req.params.id) return res.json({success:false, message:"Unauthrized Attempt"});
  if(req.body.user.genderShow==undefined){
    req.body.user.genderShow="no";
  }
  User.findById(req.params.id, req.body.user, function (err,user) {
    if(err) return res.json({success:"false", message:err});
    if(user.authenticate(req.body.user.password)){
      if(req.body.user.newPassword){
        user.password = req.body.user.newPassword;
        editCheck = true;
        user.save();
      } else{
        delete req.body.user.password;
        req.flash("formData", req.body.user);
      }
      User.findByIdAndUpdate(req.params.id, req.body.user, function (err,user) {
        if(err) return res.json({success:"false", message:err});
        res.redirect('/users/'+req.params.id);
      });
    } else{
      req.flash("formData", req.body.user);
      req.flash("passwordError", "- Invalid password");
      res.redirect('/users/'+req.params.id+"/edit");
    }
  });
});
app.get('/posts', function(req,res){
  if(req.user){
    res.render("posts/new", {user:req.user});
  }else{
    res.redirect('/login');
  }
});
app.post('/posts', isLoggedIn, function(req,res){
  req.body.post.author=req.user._id;
  Post.create(req.body.post,function (err,post) {
    if(err) return res.json({success:false, message:err});
    res.redirect('/');
  });
});
app.get('/admin', isLoggedIn, function (req,res){
  if(req.user.class=="admin"){
    sum.total.findOne({},function(err,total){
      map.gps.find({},function(err,gps){
        res.render("admin/index", {user:req.user,today:todayVisitor,total:total,ccu:clients.length,gps:gps.length});
      });
    });
  }else{
    res.redirect('/');
  }
});
app.get('/admin/image', isLoggedIn, function (req,res){
  if(req.user.class=="admin"){
    image.imageInfo.find({new:"new"},function(err, imageInfo) {
      if(err) return res.json({success:false, message:err});
      res.json(imageInfo.length);
    });
  }else{
    res.redirect('/');
  }
});
app.get('/admin/imagep', isLoggedIn, function (req,res){
  if(req.user.class=="admin"){
    personal.userImage.find({new:"new"},function(err, imageInfoP) {
      if(err) return res.json({success:false, message:err});
      res.json(imageInfoP.length);
    });
  }else{
    res.redirect('/');
  }
});
app.get('/admin/socket', isLoggedIn, function (req,res){
  if(req.user.class=="admin"){
    res.json(clients);
  }else{
    res.redirect('/');
  }
});
app.get('/admin/gps', isLoggedIn, function (req,res){
  if(req.user.class=="admin"){
    map.gps.find({},function(err,gps){
      if(err) return res.json({success:false, message:err});
      res.json(gps);
    });
  }else{
    res.redirect('/');
  }
});
app.get('/admin/opt', isLoggedIn, function (req,res){
  if(req.user.class=="admin"){
    tempCoord.saveCoord.find({},function(err, opt) {
      if(err) return res.json({success:false, message:err});
      tempUser.optUser.find({},function(err,optP){
        if(err) return res.json({success:false, message:err});
        res.json('MainPage: '+opt.length+'   UserPage: '+optP.length);
      });
    });
  }else{
    res.redirect('/');
  }
});
app.get('/admin/posts', isLoggedIn, function(req,res){
  if(req.user.class=="admin"){
    Post.find({}).populate("author").sort('-createdAt').exec(function (err,posts){
      if(err) return res.json({success:false, message:err});
      res.render("admin/index_posts", {posts:posts, user:req.user});
    });
  }else{
    res.redirect('/');
  }
});

app.get('/admin/keyword', isLoggedIn, function(req,res){
  if(req.user.class=="admin"){
    search.keyword.find({}).sort({'_id': -1},function (err,keyword){
      if(err) return res.json({success:false, message:err});
      res.render("admin/index_keyword", {keyword:keyword, user:req.user});
    });
  }else{
    res.redirect('/');
  }
});
app.get('/posts/:id', isLoggedIn, function(req,res){
  if(req.user.class=="admin"){
    Post.findById(req.params.id).populate("author").exec(function (err,post) {
      if(err) return res.json({success:false, message:err});
      res.render("admin/posts_show", {post:post, user:req.user});
    });
  }else{
    res.redirect('/');
  }
});
app.delete('/posts/:id', isLoggedIn, function(req,res){
  if(req.user.class=="admin"){
    Post.findOneAndRemove({_id:req.params.id}, function (err,post) {
      if(err) return res.json({success:false, message:err});
      if(!post) return res.json({success:false, message:"No data found to delete"});
      res.redirect('/admin/posts');
    });
  }else{
    res.redirect('/');
  }
});
app.get('/admin/users', isLoggedIn, function(req,res){
  if(req.user.class=="admin"){
    User.find({}).sort('-createdAt').exec(function (err,users) {
      if(err) return res.json({success:false, message:err});
      res.render("admin/index_users", {users:users, user:req.user});
    });
  }else{
    res.redirect('/');
  }
});
app.get('/sendemail', isLoggedIn, function(req,res){
  if(req.user.class=="admin"){
    if (req.query.pwd=="ss062092") {
      User.find({randValue : "access"},function(error,user){
        for(var i in user){
            mailOptions={
              from : 'MildWall Service Team <mildwall.service@gmail.com>',
              to : user[i].email,
              subject : req.query.title,
              html : req.query.contents
            }
          smtpTransport.sendMail(mailOptions);
        }
      });
        res.end("done");
    }else{
      res.end("err");
    }
  }else{
    res.redirect('/');
  }
});
app.get('/*y*',function(req,res,next){
  var numArray = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','g','h','i','j','l','m','n','o','p','q','r','s','t','u','v','w','x','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
  var url = req.url;var noY = true;
  var strX='';var strY='';
  var x = 0;var y = 0;
  url=url.slice(1);
  for(var i=0;i<url.length;i++){
    if(url[i]=='y'){noY = false;continue}
    if(noY){strX = strX +url[i];} else{strY = strY +url[i];}
  }
  function findNum(n){
    for(var i=0;i<60;i++){
      if(n===numArray[i]){return i; break}
    }
  }
  for(var i=0;i<strX.length;i++){
    if(strX[strX.length-1]!='k') {
      x += findNum(strX[i])*Math.pow(60,(strX.length-1-i));
    } else{
      if(strX[i]=='k'){x*=-1;break}
      x += findNum(strX[i])*Math.pow(60,(strX.length-2-i));
    }
  }
  for(var i=0;i<strY.length;i++){
    if(strY[strY.length-1]!='k') {
      y += findNum(strY[i])*Math.pow(60,(strY.length-1-i));
    } else{
      if(strY[i]=='k'){y*=-1;break}
      y += findNum(strY[i])*Math.pow(60,(strY.length-2-i));
    }
  }
  todayVisitor++;
  sum.total.findOne({},function(err, count){
    if(count){
      sum.total.remove({});
      if(clients.length+1>count.ccuMAX){
        sum.total.insert({total:count.total+1,ccuMAX:clients.length+1});
      }else{
        sum.total.insert({total:count.total+1,ccuMAX:count.ccuMAX});
      }
    }else{
      sum.total.insert({total:1,ccuMAX:1});
    }
  });
  return res.render("main/index", {user:req.user,x:x,y:y});
});
app.use(function(req,res){
  res.render("main/404", {user:req.user});
});
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()){
    return next();
  }
  res.redirect('/');
}
function checkUserRegValidation(req, res, next) {
  var isValid = true;
  async.waterfall(
    [function(callback) {
      User.findOne({email: req.body.user.email, _id: {$ne: mongoose.Types.ObjectId(req.params.id)}},
        function(err,user){
          if(user){
            isValid = false;
            req.flash("emailError","- This email is already resistered.");
          }
          callback(null, isValid);
        }
      );
    }, function(isValid, callback) {
      User.findOne({nickname: req.body.user.nickname, _id: {$ne: mongoose.Types.ObjectId(req.params.id)}},
        function(err,user){
          if(user){
            isValid = false;
            req.flash("nicknameError","- This nickname is already resistered.");
          }
          callback(null, isValid);
        }
      );
    }], function(err, isValid) {
      if(err) return res.json({success:"false", message:err});
      if(isValid){
        return next();
      } else{
        req.flash("formData",req.body.user);
        res.redirect("back");
      }
    }
  );
}
schedule.scheduleJob( '0 0 15 * * *', function(){
  today.visitor.insert({visitor:todayVisitor,created:new Date()});
  todayVisitor=0;
});
setInterval(function(){
  if(clients.length==0){
    map.gps.remove({});
  }
  async.waterfall(
      [
        function(callback) {
          map.gps.find({},function(err,gps){
            if(gps){
              if(gps.length>clients.length){
                var temp=0;
                for(var j in gps){
                  for(var i=0, len=clients.length; i<len; ++i){
                    var c = clients[i];
                    if(c){
                      if(gps[j].id==c.clientId){
                        break;
                      }else{
                        temp++;
                        if(temp==clients.length){
                          isValid=gps[j].id;
                          callback(null, isValid);
                        }
                      }
                    }
                  }
                }
              }
            }
          });
       }
        ],
        function(err, isValid) {
          if(isValid){
            map.gps.remove({id:isValid});
          }
  });
},10000);
setInterval(function(){
  if(global.gc){
    global.gc();
  }else{
    console.log("nodejs --expose-gc mildwall.js");
  }
},120000);
server.listen(80, function(){
  console.log('Server On!');
});

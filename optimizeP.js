var async    = require('async');
var Canvas = require('canvas');
var mongoose = require('mongoose');
var mongojs = require('mongojs');
var personal = mongojs('mildwall',['userImage']);
var tempUser = mongojs('mildwall',['optUser']);
mongoose.connect("mongodb://localhost/mildwall");
var db = mongoose.connection;
db.once("open",function () {
  console.log("DB connected to optimizeP!");
});
db.on("error",function (err) {
  console.log("DB ERROR(optimize) :", err);
});
var userSchema = mongoose.Schema({
  email: {type:String, required:true, unique:true},
  nickname: {type:String, required:true},
  password: {type:String, required:true},
  gender: {type:String, required:true},
  randValue : {type:String},
  class : {type:String},
  findpwd: {type:String},
  createdAt: {type:Date, default:Date.now}
});
var User = mongoose.model('user',userSchema);
var pressDone=0
  , next=0
  , nextTemp=0;
setInterval(function(){
  tempUser.optUser.findOne({},function(err,optData){
    if(err){
      throw err;
    }
    if(optData){
      var opX=optData.x
        , opY=optData.y
        ,opXX=optData.xx
        ,opYY=optData.yy;
      personal.userImage.find({pageN:optData.pageN,opt:"n",id:optData.id,x:opX,y:opY,xx:opXX,yy:opYY}).sort({'id': 1},function(err,imageInfo){
        if(imageInfo){
          var Image = Canvas.Image
            , canvas = new Canvas(100, 100)
            , ctx = canvas.getContext('2d');
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, 100, 100);
            next=1;
        }
        if(next=1){
          for(var i in imageInfo){
            var images = new Image;
            images.src = imageInfo[i].dataURL;
            ctx.drawImage(images,0,0);
            pressDone++;
          }
          next=0;
        }
        if(pressDone==imageInfo.length){
          var dataURL = canvas.toDataURL();
          var isValid=false;
          async.waterfall(
              [
                function(callback) {
                    if(dataURL!="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABmJLR0QA/wD/AP+gvaeTAAABAElEQVR4nO3RQQ0AIBDAMMC/5+ONAvZoFSzZnplZZJzfAbwMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEkxpAYQ2IMiTEk5gIIYATEt/6qKQAAAABJRU5ErkJggg=="){
                      personal.userImage.insert({pageN:optData.pageN,opt:"y",id:optData.id,dataURL:dataURL,opt:"y",x:opX,y:opY,xx:opXX,yy:opYY},function(err,data){
                        if(data){
                          isValid=true;
                          callback(null, isValid);
                        }
                      });
                    }else{
                      isValid=true;
                      callback(null, isValid);
                    }
                  },
                  function(isValid, callback) {
                    if(isValid){
                      personal.userImage.remove({pageN:optData.pageN,opt:"n",id:optData.id,x:opX,y:opY,xx:opXX,yy:opYY},function(err,data){
                        if(data){
                          isValid=true;
                          callback(null, isValid);
                        }
                      });
                    }
                  },
                ],
                function(err, isValid) {
                  if (isValid) {
                    personal.userImage.update({pageN:optData.pageN,opt:"y",id:optData.id,x:opX,y:opY,xx:opXX,yy:opYY}, {$set: {opt:"n"}}, { multi: true });
                    nextTemp=1;
                  }
                });
          pressDone=0;
        }
      });
      if(nextTemp==1){
        tempUser.optUser.remove({id:optData.id,pageN:optData.pageN,x:opX,y:opY,xx:opXX,yy:opYY});
        nextTemp=0;
      }
    }
  });
},500);
setInterval(function(){
  if(global.gc){
    global.gc();
  }else{
    console.log("nodejs --expose-gc optimizeP.js");
  }
},30000);

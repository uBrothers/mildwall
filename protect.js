var async    = require('async');
var mongojs = require('mongojs');
var Canvas = require('canvas');
var protect = mongojs('mildwall',['protectImg']);
var image = mongojs('mildwall',['imageInfo']);
console.log("DB connected to protect!");
var pressDone=0
  , next=0
  , nextTemp=0;
setInterval(function(){
  protect.protectImg.findOne({},function(err,optData){
    if(err){
      throw err;
    }
    if(optData){
      var opX=optData.x
        , opY=optData.y
        ,opXX=optData.xx
        ,opYY=optData.yy;
      image.imageInfo.find({opt:"n",x:opX,y:opY,xx:opXX,yy:opYY}).sort({'createdAt': 1},function(err,imageInfo){
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
            last=new Date(Date.now() + (2592000000));
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
                      image.imageInfo.insert({dataURL:dataURL,opt:"y",x:opX,y:opY,xx:opXX,yy:opYY,createdAt:last},function(err,data){
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
                      image.imageInfo.remove({opt:"n",x:opX,y:opY,xx:opXX,yy:opYY},function(err,data){
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
                    image.imageInfo.update({opt:"y",x:opX,y:opY,xx:opXX,yy:opYY}, {$set: {opt:"n"}}, { multi: true });
                    nextTemp=1;
                  }
                });
          pressDone=0;
        }
      });
      if(nextTemp==1){
        protect.protectImg.remove({x:opX,y:opY,xx:opXX,yy:opYY});
        nextTemp=0;
      }
    }
  });
},500);
setInterval(function(){
  if(global.gc){
    global.gc();
  }else{
    console.log("nodejs --expose-gc protect.js");
  }
},30000);

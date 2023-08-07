const JWTConfig = require("./jwt-config")
const JWT = require('jsonwebtoken')

let checkToken = (req,res, next)=> {
    let userToken = req.headers['authorization'];
    
    if(userToken){
        // Token avl
        JWT.verify(userToken,JWTConfig.secret,{
            algorithm:JWTConfig.algorithm,
        },(error, data)=>{
            if(error){
                return res.status(401).json({
                    status:0,
                    message:"Token is not valid",
                    data:error
                })
            }else{
                req.user=data;
                next();
            }
        });
    }else{
        return res.status(400).json({
            status:0,
            message:"Please provide authorization token"
        });
    }
}

module.exports={
    checkToken:checkToken
}
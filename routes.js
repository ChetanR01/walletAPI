const express = require("express");
const router = express.Router();
const bodyParser= require('body-parser');
const Sequelize = require('sequelize');
const bcrypt = require('bcrypt');
const Op = require('sequelize').Op // For OR in where condition
const JWT = require("jsonwebtoken");
const JWTConfig = require("./config/jwt-config");
const JwtMiddleware = require("./config/jwt-middleware");
const crypto = require("crypto"); // For TransactionId generation

router.use(bodyParser.json());

// connection with pg database
const sequelize = new Sequelize("node_orm", "postgres", "Chetan@01",{
    host: "localhost",
    dialect: "postgres"
});

// check connection
sequelize.authenticate().then(function(success){
    console.log("Successfully Connected with database");
}).catch(function(error){
    console.log("Error while connecting with DB")
});


// create model => first way
var User = sequelize.define("tbl_uesrs",{
    id:{
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },
    name:{
        type: Sequelize.STRING,
        allowNull:false
    },
    email:{
        type:Sequelize.STRING,
        allowNull: false,
    },
    wallet_id:{
        type:Sequelize.STRING,
        allowNull: false,
    },
    password:{
        type: Sequelize.STRING,
        allowNull: false
    },
    balance:{
        type:Sequelize.FLOAT,
        defaultValue:0
    },
    mobile_no:{
        type:Sequelize.STRING(length=10),
        allowNull:false
    },
    status: {
        type: Sequelize.ENUM("1","0"),
        defaultValue: "1"
    }
    },{
        modelName: "User"
});

// Model for transactions
var Transaction = sequelize.define("tbl_transaction",{
    id:{
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },
    transactionId:{
        type: Sequelize.STRING,
        allowNull:false
    },
    fromId:{
        type:Sequelize.INTEGER,
        allowNull: false,
    },
    toId:{
        type:Sequelize.INTEGER,
        allowNull: false,
    },
    amount:{
        type:Sequelize.INTEGER,
        allowNull: false,
    },
    status:{
        type:Sequelize.ENUM("Failed","Pending","Success"),
        allowNull:false
    },
    remark:{
        type:Sequelize.STRING,
        allowNull:false
    }
    },{
        modelName: "Transaction"
});

// sync model
User.sync();
Transaction.sync();

// create user
router.post("/create-user", (req, res) => {
    let name= req.body.name;
    let email= req.body.email;
    let wallet_id= req.body.wallet_id;
    let password= bcrypt.hashSync(req.body.password,10);
    let mobile_no= req.body.mobile_no;

    User.findOne({
        where:{
            [Op.or]: [{email: email}, {mobile_no: mobile_no}]
          }
    }).then((user) => {
        if(user){
            res.status(500).json({
                status:0,
                message:"User already exist with this email or mobile no"
            });
        }else{
            User.create({
                name:name,
                email:email,
                password:password,
                mobile_no:mobile_no,
                wallet_id:wallet_id
            }).then(function(response){
                res.status(200).json({
                    status:1,
                    message:"User Created Successfully! "
                });
            }).catch(function(error){
                console.log(error)
            });
        }
    }).catch((error)=>{
        console.log(error);
    });
});

// Login User API
router.post('/login',(req,res)=>{
    User.findOne({
        where:{
            email:req.body.email
        }
    }).then((user)=>{
        if(user){
            // we have user data
            if(bcrypt.compareSync(req.body.password,user.password)){
                // password matched
                let userToken= JWT.sign({
                    email:user.email,
                    id:user.id
                },JWTConfig.secret,{
                    expiresIn:JWTConfig.expiresIn,
                    notBefore:JWTConfig.notBefore,
                    algorithm:JWTConfig.algorithm,
                    issuer:JWTConfig.issuer,
                    audience:JWTConfig.audience,
                });

                res.status(200).json({
                    status:1,
                    message:"User Logged In successfully!",
                    token:userToken
                });
            }else{
                // incorrect pass
                res.status(500).json({
                    status:0,
                    message:"Incorrect Password!"
                });
            }
        }else{
            // we dont have user data
            res.status(501).json({
                status:0,
                message:"Use dont exist with this email"
            });
        }
    }).catch((error)=>{
        console.log(error);
    });
});

// check account balance
router.post("/check-balance",JwtMiddleware.checkToken,(req,res)=>{
    User.findOne({
        where:{
            email:req.user.email
        }
    }).then((user)=> {
        if(user){
            // User found 
            res.status(200).json({
                status:1,
                balance:user.balance,
            });
        }else{
            // user not found
            res.status(500).json({
                status:0,
                message:"Unble to load your balance"
            });
        }
    });
});

// Add balance
router.post("/add-balance",JwtMiddleware.checkToken,(req,res)=>{
    User.findOne({
        where:{
            email:req.user.email
        }
    }).then((user)=> {
        if(user){
            // User found 
            let transactionId=crypto.randomBytes(8).toString("hex")
            User.update({
                balance:user.balance+req.body.amount
            },{
                where:{
                    email:req.user.email
                }
            }).then(response => {
                // create record in trans table
                Transaction.create({
                    transactionId:transactionId,
                    fromId:user.id,
                    toId:user.id,
                    remark:"Self Deposit",
                    status:"Success",
                    amount:req.body.amount,
                }).then(function() {
                    console.log("Transaction record created successfully");
                }).catch((error)=> {
                    console.log("failed to create transaction record")
                });

                res.status(200).json({
                    status:1,
                    message:"Balance Added successfully",
                    transactionId:transactionId,
                    balance:user.balance+req.body.amount
                });
            }).catch(error => {
                Transaction.create({
                    transactionId:transactionId,
                    fromId:user.id,
                    toId:user.id,
                    remark:"Self Deposit",
                    amount:req.body.amount,
                    status:"Failed",
                }).then(function() {
                    console.log("Transaction record created successfully");
                }).catch((error)=> {
                    console.log("failed to create transaction record")
                });
                res.status(500).json({
                    status:0,
                    message: "Failed to Add Balance",
                    transactionId:transactionId,
                    error: error
                });
            });
            
        }else{
            // user not found
            res.status(501).json({
                status:0,
                message:"Unable to Add balance"
            });
        }
    }).catch((error)=>{
        console.log(error);
    });
});

// Transfer balance
router.post("/transfer",JwtMiddleware.checkToken,(req,res)=>{
    User.findOne({
        where:{
            id:req.body.transferTo
        }
        }).then((touser)=> {
            if(touser){
            // reciever found
            let transactionId= crypto.randomBytes(8).toString("hex"); // Genrate trans id
            User.findOne({
                where:{
                    id:req.user.id
                }
            }).then((fromuser)=>{
                // sender found
                //update sender bal
                User.update({
                    balance:fromuser.balance-req.body.amount
                },{
                    where:{
                        id:req.user.id
                    }
                }).then(()=>{
                    Transaction.create({
                        transactionId:transactionId,
                        fromId:req.user.id,
                        toId:req.body.transferTo,
                        remark:"Sender Account debited",
                        status:"Pending",
                        amount:req.body.amount
                    }).then(()=>{
                        console.log("Transaction record created: "+transactionId)
                    }).catch((err)=>{
                        console.log("Failed to create transaction record: "+err)
                    })

                    // debited from sender now add to reciever acc

                    // add user balance
                    User.update({
                        balance:touser.balance+req.body.amount
                    },{
                        where:{
                            id:touser.id
                    }
                    }).then(()=>{
                            // add trans
                            Transaction.update({
                                remark:"Reviecer credited",
                                status:"Success",
                            },{where:{
                                transactionId:transactionId
                            }}).then(()=>{
                                res.status(200).json({
                                    status:1,
                                    message:"Transaction Successfull",
                                    transactionId:transactionId,
                                });
                            }).catch((error)=>{
                                console.log("Unable to add to reviecers account = "+error)
                            });
                            }).catch((error)=>{
                                Transaction.update({
                                    remark:"Failed to credit bal",
                                    status:"Failed",
                                }).then(()=>{  
                                    return res.status(500).json({
                                        status:0,
                                        message:"Transaction Failed",
                                        transactionId:transactionId
                                    });
                                });
                            });


                }).catch((error)=>{
                    return res.status(501).json({
                        status:0,
                        message:"Unable to update Sender Balance",
                        error: error
                    })
                })
            }).catch((error)=> {
                return res.status(404).json({
                    status:0,
                    message:"Reciever does not exist",
                })
            })
            // Reciever doesnot exist
        }else{
            res.status(404).json({
                status:0,
                message:"Reciever does not exist",
            })
        }

            });
        });

//  check status
router.post("/check-status",JwtMiddleware.checkToken,(req,res)=>{
    User.findOne({
        where:{
            email:req.user.email
        }
    }).then((user)=> {
        if(user){
            // User found 
            // search for transaction record
            Transaction.findOne({
                where:{
                    transactionId:req.body.transactionId
                }
            }).then((record)=>{
                if(record){
                    res.status(200).json({
                        status:1,
                        message:"Transaction record Found",
                        transactionStatus: record.status
                    });
                }else{
                    res.status(500).json({
                        status:0,
                        message:"No record found with this transactionId"
                    });
                }
            });
        }else{
            // user not found
            res.status(404).json({
                status:0,
                message:"User does not exist"
            });
        }
    });
});

// get statement
router.post("/statement",JwtMiddleware.checkToken,(req,res)=>{
    Transaction.findAll({
        limit:req.body.limit,
        where:{
            [Op.or]: [{fromId: req.user.id}, {toId: req.user.id}]
        }
    }).then((records)=>{
        if(records){
            res.status(200).json({
                status:1,
                message: records.length+" records found",
                data:records
            });
        }else{
            res.status(500).json({
                status:0,
                message:"No transaction records found",
            });
        }
    }).catch((err)=>{
        console.log("Something went wrong : "+err);
    });
})

// deactivate user api
router.put("/deactivate-user", function(req,res){
    User.update({
        status:"0"
    },{
        where:{
            id:req.user.id
        }
    }).then(response => {
        res.status(200).json({
            status: 1,
            message: "User is successfully deactivated"
        });
    }).catch(error => {
        res.status(500).json({
            status:0,
            message: "Failed to deactivate user",
            error: error
        });
    });
});


// Validate TokenAPI
router.post("/validate",(req,res)=>{
    // console.log(req.headers);
    let userToken= req.headers['authorization'];
    if(userToken){
        // we have token
        JWT.verify(userToken, JWTConfig.secret, (error, decoded)=>{
            if(error){
                res.status(500).json({
                    status:0,
                    message:"Invalid Token !",
                    data:error
                }); 
            }else{
                res.status(200).json({
                    status:1,
                    message:"Token is Validated!",
                    data:decoded
                });
            }
        });
    }else{
        // we dont have token
        res.status(500).json({
            status:0,
            message:"Please provide token",
            data:error
        }); 
    }
});

// user prifile data
router.post("/profile", JwtMiddleware.checkToken,(req,res)=>{
    res.status(200).json({
        status:1,
        userdata:req.user,
        message: "Token Value parsed"
    });
});

// Get all users => findAll()
router.get('/users',JwtMiddleware.checkToken,function(req,res){
    User.findAll({
        where:{
            status:"1"
        }
    }).then((users) =>{
        res.status(200).json({
            status:1,
            message: "Users Found",
            data: users 
        });
    }).catch((error) => {
        console.log(error);
    });
});



//delete user
router.delete("/delete-account",function(req,res){
    User.destroy({
        where:{
            id: req.user.id
        }
    }).then(data => {
        res.status(200).json({
            status:1,
            message:"User is deleted successfully!"
        });
    }).catch(error => {
        res.status(500).json({
            status:0,
            message:"Failed to delete users",
            data:error
        });
    });
})

// raw query
router.get("/user-raw", function(req, res){
    sequelize.query("SELECT * FROM tbl_uesrs",{
        type: Sequelize.QueryTypes.SELECT
    }).then(response => {
        res.status(200).json({
            status:1,
            message:"Users Found",
            data: response
        }).catch(error => {
            console.log(error);
        });
    });
});

// route for Home page
router.get("/", function(req, res){
    res.status(200).json({
        status: 1,
        message : "Welcome to Home Page"
    });
});


module.exports= router;
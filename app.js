const express = require('express');
const bodyParser= require('body-parser');
const Sequelize = require('sequelize');
const appRoute = require('./routes')
const app = express();
const PORT =8089



app.use('/',appRoute)

// app listen
app.listen(PORT, function(){
    console.log("Application is Running !!!")
});
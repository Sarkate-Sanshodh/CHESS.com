const express = require("express");
const router = express.Router();

router.get("/" , function(req, res){
   res.render("chessBoard" , {title:"Chess Game"})
})


module.exports = router ;
const express = require("express");
const path = require("path")
const socket = require("socket.io"); 
const {Chess} = require("chess.js");
const http = require("http");
// const { unsubscribe } = require("diagnostics_channel");
// const socketConection = require("./middlewares/")

const index = require("./routes/index")
const welcomePage = require("./routes/welcomePage")

const app = express();

const server = http.Server(app);
const io = socket(server);

const chess = new Chess();

const players = {};
let currentPlayer = "w";

app.set('view engine' , 'ejs')
app.use(express.static(path.join(__dirname , "public")))


app.use("/" , welcomePage)
app.use("/play" ,index)

io.on("connection" , function(uniquesocket){
    console.log('connected');
   

    // here ewe assign the valu to the player as if first person connect then assign the role as white 
     if(!players.white){
        players.white = uniquesocket.id ;
        uniquesocket.emit("playerRole" , "w")
          io.to(players.white).emit("waitingForOpponent");
        //   console.log('White player connected. Waiting for Black');
          
     }   

     // here if the person is second the we check the black role is assign or not if not then we assign role as black
     else if(!players.black){
        players.black = uniquesocket.id;
        uniquesocket.emit("playerRole" , "b" );
        // console.log('black player connected. game starting');


        io.to(players.white).emit('opponentConnected');
        // io.to(players.black).emit('opponentConnected');


         io.emit("boardState" , chess.fen());



     }


     //if third  plyer as come and no any role empty then we assign as role as spectatorRole
     else{
        uniquesocket.emit("spectatorRole");
     }

     //emit the waitin of connection
     


     // this is for disconnect , if plyers.white is desconnevcyt then delete the id of rhe players.white
     uniquesocket.on("disconnect" , function(){
        if(uniquesocket.id === players.white){
            delete players.white ;
        }
        // this is for disconnect , if plyers.black is desconnect then delete the id of rhe players.black
        else if(uniquesocket.id === players.black){
            delete players.black ;
        }

         // Notify other player
        Object.values(players).forEach(id => {
            io.to(id).emit("opponentDisconnected");
        })
     });

     // thie is check the correct move 
     uniquesocket.on("move" , (move)=>{
        try{
             if(chess.turn() == "w"  && uniquesocket.id !== players.white) return ;
             if(chess.turn() == "b"  && uniquesocket.id !== players.black) return ;

            const result =  chess.move(move);
            if(result){
                currentPlayer = chess.turn();
                io.emit("move" , move);
                io.emit("boardState" , chess.fen());

            // chekmate check game over and bordcast the winer
            if(chess.isGameOver()){
                const status = {}
                if(chess.isCheckmate()){
                    status.type = "checkmate"
                    status.winner = chess.turn() === "w" ? "black" : "white" ;
                }
                else if(chess.isDraw()){
                    status.type = "draw"
                }
                else{
                    status.type = "ended"
                }
            io.emit("game-over" , status);
            }
         }

            else{
                uniquesocket.emit("invalid Move" , move);
            }
        }
        catch(err){
            console.log('error during move');
            
            uniquesocket.emit("invalid Move" , move);
        }
     })


    uniquesocket.on("restart" , () =>{
        try{
          chess.reset();
          io.emit("gameRestarted" , chess.fen());

        }
        catch(err){
             console.error("Restart error:", err);
        }
    })
         
});

server.listen(3000 , function(){
    console.log('Listening on port 3000');
    
})

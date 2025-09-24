// const { Chess } = require("chess.js");

const socket = io();
const chess = new Chess();

const boardElement = document.querySelector(".chessboard");
let draggedPiece = null;
let sourceSquare = null ;
let playerRole = null ;
let selectedPiece = null ;
let validMoves = []; 
let isVsComputer = false ;

// check karega ki player ne kya compute mode pe click kiya hai kya ager kiya hai to   isVsComputer = true 
document.addEventListener("DOMContentLoaded", () => {
    // URL FIND GAME MODE
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    if (mode === 'computer') {
        // ✅ IF URL  mode=computer START COMPUTER GAME
        startComputerGame();
    } else {
        // OTHER WISE WAIT 
        startMultiplayerGame();
    }
});

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";

    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add(
                "square",
                (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark"
            );

            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = squareIndex;

            // Highlight selected piece
            if (
                selectedPiece &&
                selectedPiece.row === rowIndex &&
                selectedPiece.col === squareIndex
            ) {
                squareElement.classList.add("selected");
            }

            // Highlight valid moves
            const squareName = `${String.fromCharCode(97 + squareIndex)}${8 - rowIndex}`;
            if (validMoves.includes(squareName)) {
                squareElement.classList.add("highlight");
            }

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add(
                    "piece",
                    square.color === "w" ? "white" : "black"
                );

                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = square.color === playerRole;

                // Drag events
                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: squareIndex };
                        e.dataTransfer.setData("text/plain", "");
                    }
                });

                pieceElement.addEventListener("dragend", (e) => {
                    draggedPiece = null;
                    sourceSquare = null;
                });

                // Click-to-select piece
                pieceElement.addEventListener("click", () => {
                    if (square.color !== playerRole) return;

                    const from = `${String.fromCharCode(97 + squareIndex)}${8 - rowIndex}`;
                    validMoves = chess.moves({ square: from, verbose: true }).map(m => m.to);

                    if (
                        selectedPiece &&
                        selectedPiece.row === rowIndex &&
                        selectedPiece.col === squareIndex
                    ) {
                        selectedPiece = null; // deselect
                        validMoves = [];
                    } else {
                        selectedPiece = { row: rowIndex, col: squareIndex };
                    }

                    renderBoard();
                });

                squareElement.appendChild(pieceElement);
            }

            // Dragover for drag-and-drop
            squareElement.addEventListener("dragover", (e) => e.preventDefault());

            // Drop for drag-and-drop
            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSource = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col),
                    };
                    handleMove(sourceSquare, targetSource);
                }
            });

            // Click-to-move
            squareElement.addEventListener("click", () => {
                if (selectedPiece) {
                    const targetSquareName = `${String.fromCharCode(97 + squareIndex)}${8 - rowIndex}`;
                    if (!validMoves.includes(targetSquareName)) return; // only allow valid moves

                    const targetSource = { row: rowIndex, col: squareIndex };
                    handleMove(selectedPiece, targetSource);

                    // Reset selection
                    selectedPiece = null;
                    validMoves = [];
                    renderBoard();
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    // Flip board for black
    if (playerRole === "b") {
        boardElement.classList.add("flipped");
    } else {
        boardElement.classList.remove("flipped");
    }
};

// valid moves ko handle kar rha hai
const handleMove =  (source , target)=>{
   const move = {
      from : `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
      to : `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
      promotion: 'q',
   }

    const result = chess.move(move);
    if(result){
        renderBoard();
        if(isVsComputer){
            checkGameStatus();
        }

        if(isVsComputer && chess.turn() == 'b' && !chess.game_over()){
            setTimeout(computerMove , 500);
        }

         else if (!isVsComputer) {
            socket.emit("move", move);
        }
    }
};

// esme piece difine hai
function getPieceUnicode(piece) {
  const unicodePiece = {
    P:"♙", R:"♖", N:"♘", B:"♗", Q:"♕", K:"♔", // white
    p:"♙", r:"♜", n:"♞", b:"♝", q:"♛", k:"♚"  // black
  };
//   return unicodePiece[piece.color === "w" ? piece.type.toUpperCase()
//                                           : piece.type.toLowerCase()] || "";
 return unicodePiece[piece.type] || ""    ;
}


// show the messge jb checkmate 
function showPopup(message, withRestart = false) {
    let container = document.querySelector(".popup-container");
    if (!container) {
        container = document.createElement("div");
        container.className = "popup-container";
        document.body.appendChild(container);
    }

    const popup = document.createElement("div");
    popup.className = "popup-message"; // Using className is a good practice
    popup.textContent = message;

    // Add the popup to the page
    container.appendChild(popup);

    if (withRestart) {
        // This is for permanent popups like 'Checkmate' or 'Draw'
        const btn = document.createElement("button");
        btn.className = "popup-restart";
        btn.textContent = "Restart Game";
        
        btn.onclick = restartGame;
        
        popup.appendChild(document.createElement("br")); // For spacing
        popup.appendChild(btn);

    } else {
        // This is for temporary popups like 'Invalid Move'
        setTimeout(() => {
            popup.remove();
            // If the container is empty after removing the popup, remove it too
            if (container.children.length === 0) {
                container.remove();
            }
        }, 2000); // Popup disappears after 2 seconds
    }
}



// client side cheack gamestatus ki gane over to nai ho gya
function checkGameStatus() {
    if (chess.game_over()) {
        if (chess.in_checkmate()) {
            const winner = chess.turn() === "w" ? "Black" : "White";
            showPopup(`♔ Checkmate! ${winner} wins!`, true);
        } else if (chess.isDraw()) {
                 showPopup("💛 Draw!", true);

        }
    }
}


// jb tak second player nai ate to ek message popup karega wating for connection
function showWaitingMessage() {
    let container = document.querySelector(".popup-container");
    if (!container) {
        container = document.createElement("div");
        container.className = "popup-container";
        document.body.appendChild(container);
    }

    // Only create if not already present
     document.getElementById("waiting-popup")?.remove();

        const popup = document.createElement("div");
        popup.className = "popup-message";
        popup.id =  "waiting-popup";
        popup.innerHTML = `<span class="spinner">⏳</span> Waiting for opponent...`;
        container.appendChild(popup);
 }


 // popup meassage ko disapper karega
function hideWaitingPopup() {
    const waitingPopup = document.getElementById("waiting-popup");
    if (waitingPopup) {
        const container = waitingPopup.parentElement;
        waitingPopup.remove();
        // Agar container khali ho gaya hai to use bhi hata do
        if (container && container.children.length === 0) {
            container.remove();
        }
    }
}


// Computer mode ke liye computer random moves ko gen karega
function computerMove(){
    if(chess.game_over()) return ;
    const possibleMoves = chess.moves();
     if (possibleMoves.length === 0) {
        return; // अगर कोई चाल नहीं है, तो फंक्शन से बाहर निकल जाएं
    }
    const randomMove  = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    chess.move(randomMove)
    renderBoard();
    checkGameStatus();
}

// ager isVsComputer me koi click karega to isVsComputer ki value ko true kardega
function startComputerGame() {
    console.log("Starting computer game...");
    isVsComputer = true;
    playerRole = 'w';
    if (socket) socket.disconnect(); 
    chess.reset();
    renderBoard();
    showPopup("You are now playing against the Computer!");
}


// wating for multiplayer
function startMultiplayerGame() {
    console.log("Waiting for multiplayer game...");
}

// check karega ki konsa game mode hai
function restartGame() {
    // Check karein ki kaun sa game mode active hai
    if (isVsComputer) {
        // Computer Mode: Sab kuch client-side par hi reset karo
        chess.reset();
        renderBoard();
        document.querySelector(".popup-container")?.remove(); // Popup ko seedhe hata do
    } else {
        // Multiplayer Mode: Server ko restart ke liye bolo
        socket.emit("restart");
    }
}


socket.on("playerRole", function(role) {
    playerRole = role;
    renderBoard();
});

socket.on("spectatorRole" , function(){
   playerRole = null;
   renderBoard();
});

socket.on("boardState" , function(fen){
  chess.load(fen);
   renderBoard();
//    checkGameStatus();
});

socket.on("move" , function(move){
   chess.move(move);
   renderBoard();
   
// checkGameStatus();
});


socket.on("invalid Move" ,(move) => {
showPopup(`invalid Move ${move.from} ${move.to}`);
renderBoard();

})

// server tell us the game is end 
socket.on("game-over" , (status)=>{
   if(status.type === "checkmate"){
      showPopup(`🏆${status.winner} wins by checkmate!` , true);
   }
   else if(status.type === "draw"){
      showPopup("🤝 Draw!", true);
   }
   else{
      showPopup("Game ended", true);
   }

});

//serever Restart the game
socket.on("gameRestarted" , (fen)=>{
 chess.load(fen);
 renderBoard();
   document.querySelector(".popup-container")?.remove();
});


socket.on("waitingForOpponent", function() {
    showWaitingMessage();
});

socket.on("opponentDisconnected", function() {
    showPopup("⚠ Opponent disconnected", true);
    showWaitingMessage(); // Show waiting again
});




socket.on("waitingForOpponent", () => {
    showWaitingMessage()
});

// Server batayega ki opponent connect ho gaya hai
socket.on("opponentConnected", () => {
    hideWaitingPopup();
});
renderBoard();
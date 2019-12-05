/* 
Author: Trevor Richard
Date: Nov. 30, 2019
Description: A chess game that is used to introduce 2-dimensional arrays in javascript 
    for the COSC 122 course at the University of British Columbia Okanagan.
*/

function Chess_Board() {
    // Create our pieces 2D array (the board is 8x8)
    this.pieces = new Array(8);
    for (let row = 0; row < 8; row++) {
        this.pieces[row] = new Array(8);
    }
    this.pawn_rush = null; // stores the tile that a pawn has skipped over on the last turn, else null (used for en passant)
    this.selected = null;
    this.king = { "w": null, "b": null };
    this.in_check = { "w": false, "b": false };
    this.display = true;
    this.prev = null;
    this.turn = "w";

    this.setup = function () {
        var piece_type = [
            ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
            ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
            ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
        ];

        // Create pieces at each of the indicies to math our setup
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (piece_type[row][col] === null) this.pieces[row][col] = null;
                else this.pieces[row][col] = new Piece(piece_type[row][col], row, col, this);
            }
        }
        board.prev = board.duplicate();
        this.render();
    }

    this.render = function () {
        /* ---------- CREATING THE TABLE ----------
        We need to define the table rows and table data elements within those rows for the html table element.
        We do that by writing the html code in a string and then setting the innerHTML attribute of our table element to that string. 
        Here, our string is called "table_inner_html".
    
        We will have 9 rows on our table, the first 8 will be for the tiles, while the last row will be for column labels (A-H).
        On each row, we will need 9 data elements to represent 9 columns. The first column is reserved for row labels (1-8), 
        while the rest are for our table tiles.
    
        We will accomplish this with a nested for loop.
    
        Keep in mind that we need a way to reference our table tiles, we will do this by assigning an id to each data element that 
        represents its position. Example: The top left tile has the id, "A1", while the bottom right tile has the id, "H8".
        */
        var table = document.getElementById("board");
        var table_inner_html = "";

        for (let row = 0; row < 9; row++) {
            let row_html = "<tr>";
            for (let col = -1; col < 8; col++) {
                if (col == -1) {
                    if (row == 8) var id = " ";
                    else var id = 8 - row;
                    var tile = "<th>" + id + "</th>";
                } else {
                    if (row == 8) {
                        var id = "" + String.fromCharCode(('A').charCodeAt(0) + col);
                        var tile = "<th>" + id + "</th>";
                    } else {
                        var id = get_tile_id(row, col);
                        var tile = "<td id='" + id + "' onclick='board.select(\"" + id + "\", board.turn)'>";
                        var piece = this.pieces[row][col];
                        if (piece === null) {
                            tile += "</td>";
                        } else {
                            var img_name = this.pieces[row][col].color + this.pieces[row][col].type;
                            tile += "<img src='img/" + img_name + ".png'></td>";
                        }
                    }
                }
                row_html += tile;
            }
            row_html += "</tr>";
            table_inner_html += row_html;
        }

        table.innerHTML = table_inner_html;
    }

    this.duplicate = function () {
        let new_board = new Chess_Board();
        new_board.pawn_rush = this.pawn_rush == null ? null : this.pawn_rush.duplicate(new_board);
        new_board.display = this.display;
        new_board.prev = this.prev;
        new_board.turn = this.turn;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (this.pieces[row][col] !== null)
                    new_board.pieces[row][col] = this.pieces[row][col].duplicate(new_board);
                else
                    new_board.pieces[row][col] = null;
            }
        }

        return new_board;
    }

    this.calculate_value_diff = function (color) {
        let value = 0;
        let points = { "p": 1, "b": 3, "n": 3, "r": 5, "q": 9.5, "k": 4 };

        let opposing_color = color == "w" ? "b" : "w";
        this.calculate_check(opposing_color);
        if (this.in_check[opposing_color]) {
            value += 1;
        }

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let piece = this.pieces[r][c];
                if (piece !== null) {
                    if (piece.color == color) {
                        value += points[piece.type];
                    } else {
                        value -= points[piece.type];
                    }
                }
            }
        }
        return value;
    }

    this.has_piece_at = function (row, col, color) {
        if (!on_board(row, col)) return false;
        let piece = this.pieces[row][col];
        if (piece === null) return false;
        if (color !== undefined && piece.color != color) {
            return false;
        }
        return true;
    }

    this.select = function (id, color) {
        let index = get_tile_index(id);
        let row = index.row;
        let col = index.col;

        if (this.selected === null) {
            if (this.has_piece_at(row, col, color)) {
                add_class(row, col, "selected");
                this.pieces[row][col].highlight_moves();
                this.selected = this.pieces[row][col];
            }
        } else {
            // Piece is already selected so try to move it
            if (this.has_piece_at(row, col, color)) {
                // Selected different piece to move
                remove_all_classes();
                add_class(row, col, "selected");
                this.pieces[row][col].highlight_moves();
                this.selected = this.pieces[row][col];
            } else {
                if (has_class(row, col, "promotion")) {
                    let new_type = "";
                    let promote_to = window.prompt("What will you promote the pawn to? (queen, bishop, rook, knight)");
                    while (true) {
                        promote_to = promote_to.toLowerCase();
                        if (promote_to === "queen") {
                            new_type = "q";
                            break;
                        } else if (promote_to === "bishop") {
                            new_type = "b";
                            break;
                        } else if (promote_to === "rook") {
                            new_type = "r";
                            break;
                        } else if (promote_to === "knight") {
                            new_type = "n";
                            break;
                        }
                        promote_to = window.prompt("Invalid Choice. What will you promote the pawn to? (queen, bishop, rook, knight)");
                    }
                    this.selected.type = new_type;
                    this.selected.refresh_image();
                }
                if (has_class(row, col, "available_move")) {
                    // reset pawn rush 
                    this.pawn_rush = null;
                    if (has_class(row, col, "castling")) {
                        if (col < 4) { // left castle
                            this.pieces[row][0].move_to(row, 3);
                        } else if (col > 4) { // right castle
                            this.pieces[row][7].move_to(row, 5);
                        }
                    } else if (has_class(row, col, "pawn_rush")) {
                        this.pawn_rush = this.selected;
                    }
                    this.selected.move_to(row, col);
                    switch_turns();
                } else if (has_class(row, col, "capture_move")) {
                    this.selected.move_to(row, col);
                    // reset pawn rush 
                    this.pawn_rush = null;
                    switch_turns();
                } else {
                    this.selected = null;
                    remove_all_classes();
                }
            }
        }
    }

    this.move_ai = function (depth) {
        if (depth === undefined) depth = 2;
        let best_move = null;
        let max_value = -44;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let piece = this.pieces[r][c];
                if (piece !== null && piece.color == this.turn) {
                    let all_moves = piece.get_moves();
                    let moves = (all_moves.a).concat(all_moves.c);
                    for (let m = 0; m < moves.length; m++) {
                        test_board = this.duplicate();
                        test_board.display = false;
                        piece = test_board.pieces[r][c];

                        test_board.make_move(piece, moves[m], all_moves);

                        let test_board_result = test_board.duplicate();
                        if (depth > 0) {
                            test_board_result.turn = (test_board_result.turn == "w" ? "b" : "w");
                            test_board_result.move_ai(depth - 1);
                        }
                        let test_value = test_board_result.calculate_value_diff(this.turn);
                        if ((test_value > max_value) || (test_value == max_value && Math.random() < 0.33)) {
                            max_value = test_value;
                            best_move = { row: r, col: c, move: moves[m] };
                        }
                    }
                }
            }
        }
        if (best_move !== null) {
            let piece = this.pieces[best_move.row][best_move.col];
            if (this == board) {
                board.display = true;
            }
            this.make_move(piece, best_move.move, piece.get_moves());
        }
    }

    this.make_move = function (piece, move, all_moves) {
        for (let r = 0; r < all_moves.r.length; r++) {
            if (move[0] == all_moves.r[r][0] && move[1] == all_moves.r[r][1]) {
                this.pawn_rush = piece;
            }
        }
        for (let e = 0; e < all_moves.e.length; e++) {
            if (move[0] == all_moves.e[e][0] && move[1] == all_moves.e[e][1]) {
                this.pawn_rush.remove();
            }
        }
        for (let s = 0; s < all_moves.s.length; s++) {
            if (move[0] == all_moves.s[s][0] && move[1] == all_moves.s[s][1]) {
                if (move[1] < 4) { // left castle
                    this.pieces[move[0]][0].move_to(move[0], 3);
                } else if (move[1] > 4) { // right castle
                    this.pieces[move[0]][7].move_to(move[0], 5);
                }
            }
        }
        for (let p = 0; p < all_moves.p.length; p++) {
            if (move[0] == all_moves.p[p][0] && move[1] == all_moves.p[p][1]) {
                // Promotion
                piece.type = "q";
                if (this.display) {
                    piece.refresh_image();
                }
            }
        }
        piece.move_to(move[0], move[1]);
        if (this.pawn_rush !== null && this.pawn_rush.color != piece.color) {
            this.pawn_rush = null;
        }
    }

    this.copy = function (b) {
        this.pieces = b.pieces;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let piece = b.pieces[r][c];
                if (piece !== null) {
                    this.pieces[r][c] = piece.duplicate(this);
                } else {
                    this.pieces[r][c] = null;
                }
            }
        }
        this.pawn_rush = b.pawn_rush;
        this.king = b.king;
        this.in_check = b.in_check;
    }

    this.marked_by = function (color) {
        let marked = new Array(8);
        let marked_tiles = [];
        let dir = (color == "w" ? -1 : 1);
        let opposing_color = (color == "w" ? "b" : "w");
        let king = this.king[opposing_color];
        this.pieces[king.row][king.col] = null; // temporarily remove the king

        for (let r = 0; r < 8; r++) {
            // set up our marked array columns for later.
            marked[r] = new Array(8);
            marked[r].fill(false);
            for (let c = 0; c < 8; c++) {
                let piece = this.pieces[r][c];
                if (piece !== null && piece.color == color) {
                    if (piece.type != "k") {
                        let moves = piece.get_moves(false);
                        marked_tiles = marked_tiles.concat(moves.c);
                        if (piece.type != "p") {
                            marked_tiles = marked_tiles.concat(moves.a).concat(moves.b);
                        } else {
                            let d1 = [piece.row + dir, piece.col + 1];
                            let d2 = [piece.row + dir, piece.col - 1];
                            if (on_board(d1[0], d1[1]))
                                marked_tiles.push(d1);
                            if (on_board(d2[0], d2[1]))
                                marked_tiles.push(d2);
                        }
                    } else {
                        // We need to handle the king differently since if we get its moves through the normal piece.get_all_moves() function, it will end up calling itself again until the call stack is exceeded.
                        let relative_moves = [
                            [1, -1],
                            [1, 0],
                            [1, 1],
                            [-1, -1],
                            [-1, 0],
                            [-1, 1],
                            [0, -1],
                            [0, 1]
                        ];
                        for (let i = 0; i < relative_moves.length; i++) {
                            let kr = piece.row + relative_moves[i][0];
                            let kc = piece.col + relative_moves[i][1];
                            if (on_board(kr, kc)) {
                                marked_tiles.push([kr, kc]);
                            }
                        }
                    }
                }
            }
        }

        for (let i = 0; i < marked_tiles.length; i++) {
            let r = marked_tiles[i][0];
            let c = marked_tiles[i][1];
            if (on_board(r, c)) {
                marked[r][c] = true;
            }
        }

        //set the king back to it's normal place
        this.pieces[king.row][king.col] = king;
        return marked;
    }

    this.calculate_check = function (color) {
        let opposing_color = (color == "w" ? "b" : "w");
        let marked = this.marked_by(opposing_color);
        let king = this.king[color];
        if (marked[king.row][king.col]) this.in_check[color] = true;
        else this.in_check[color] = false;
        return this.in_check[color];
    }

    this.game_status = function (color) {
        // Calculate Check
        let check = this.calculate_check(color);

        // Calculate checkmate / stalemate
        let moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let piece = this.pieces[r][c];
                if (piece !== null && piece.color == color) {
                    piece_moves = piece.get_moves();
                    moves = moves.concat((piece_moves.a).concat(piece_moves.c));
                }
            }
        }

        if (moves.length == 0) {
            if (check) return "checkmate";
            else return "stalemate";
        } else {
            if (check) return "check";
            else return "on-going";
        }
    }
}

function Piece(type, row, col, b) {
    this.color = type.charAt(0); // "w" or "b"
    this.type = type.charAt(1); // "p, r, n, b, q, k"
    this.row = row;
    this.col = col;
    this.board = b;
    this.has_moved = false;

    if (this.type == "k") {
        this.board.king[this.color] = this;
    }

    this.move_to = function (row, col) {
        if (!on_board(row, col)) return false;

        if (this.board.display) {
            // Edit table HTML
            let dest = document.getElementById(get_tile_id(row, col));
            let from = document.getElementById(get_tile_id(this.row, this.col));
            let piece = from.getElementsByTagName("img")[0];
            let bbp = piece.getBoundingClientRect();
            let bbd = dest.getBoundingClientRect();
            let bbt = document.getElementById("board").getBoundingClientRect();
            let start = { x: (bbp.left - bbt.left), y: (bbp.top - bbt.top) };
            let stop = { x: (bbd.left - bbt.left), y: (bbd.top - bbt.top) };

            setTimeout(
                interpolate_image,
                0,
                dest, from, piece, start, stop, 0
            );
        }

        // Edit Board data
        if (this.type == "p") {
            let pr = this.board.pawn_rush;
            if (pr !== null) {
                let dir = pr.color == "w" ? -1 : 1;
                if (col == pr.col && row == pr.row - dir) {
                    //enpassant
                    pr.remove();
                }
            }
        }

        this.board.pieces[row][col] = this;
        this.board.pieces[this.row][this.col] = null;
        this.row = row;
        this.col = col;
        this.has_moved = true;
    }

    this.remove = function () {
        if (this.board.display) {
            // Edit HTML
            let elem = document.getElementById(get_tile_id(this.row, this.col));
            elem.innerHTML = "";
        }

        // Edit Board data
        this.board.pieces[this.row][this.col] = null;
    }

    this.highlight_moves = function () {
        // Get all moves
        let move = this.get_moves();

        // Highlight each possible move

        // Mark Available moves
        for (let i = 0; i < move.a.length; i++) {
            let row = move.a[i][0];
            let col = move.a[i][1];
            add_class(row, col, "available_move");
        }

        // Mark Capture moves
        for (let i = 0; i < move.c.length; i++) {
            let row = move.c[i][0];
            let col = move.c[i][1];
            add_class(row, col, "capture_move");
        }

        // Mark Blocked moves
        for (let i = 0; i < move.b.length; i++) {
            let row = move.b[i][0];
            let col = move.b[i][1];
            add_class(row, col, "blocked_move");
        }

        // Mark Rush moves
        for (let i = 0; i < move.r.length; i++) {
            let row = move.r[i][0];
            let col = move.r[i][1];
            add_class(row, col, "pawn_rush");
        }

        // Mark Enpassant moves
        for (let i = 0; i < move.e.length; i++) {
            let row = move.e[i][0];
            let col = move.e[i][1];
            add_class(row, col, "en_passant");
        }

        // Mark Castle moves
        for (let i = 0; i < move.s.length; i++) {
            let row = move.s[i][0];
            let col = move.s[i][1];
            add_class(row, col, "castling");
        }

        // Mark Promotion moves
        for (let i = 0; i < move.p.length; i++) {
            let row = move.p[i][0];
            let col = move.p[i][1];
            add_class(row, col, "promotion");
        }
    }

    /*
    This function will return 3 arrays that contain the possible coordinates that a piece can move in, attack in, or are blocked in.
    */
    this.get_moves = function (verify_valid) {
        if (verify_valid === undefined) verify_valid = true;
        let piece_type = this.type;
        let color = this.color;
        let row = this.row;
        let col = this.col;
        // the "piece_type" argument that is passed to this function is any of the following: "p": pawn, "r": rook, "n": knight, "b": bishop, "q": queen, "k": king
        // the "color" argument is either "w" for white or "b" for black

        var opposing_color;
        if (color == "w") opposing_color = "b"
        else opposing_color = "w"

        // Here we will define 3 emtpy arrays that represent the different moves a piece can do.
        var available_moves = [];
        var capture_moves = [];
        var blocked_moves = [];
        var rush_moves = [];
        var enpassant_moves = [];
        var castle_moves = [];
        var promotion_moves = [];

        if (piece_type == "p") {
            // We will start by checking if there is any piece infront of the pawn. If so, it can't move forward.
            let move = pawn_move(row, col, color);
            if (on_board(move[0], move[1])) {
                if (this.board.has_piece_at(move[0], move[1])) {
                    blocked_moves = this.push_move(move[0], move[1], blocked_moves, verify_valid);
                } else if (on_board(move[0], move[1])) {
                    available_moves = this.push_move(move[0], move[1], available_moves, verify_valid);
                    if (move[0] == 0 || move[0] == 7)
                        promotion_moves = this.push_move(move[0], move[1], promotion_moves, verify_valid);
                }
            }

            // Next we will check diagonal captures for the pawn
            let captures = pawn_capture_moves(row, col, color);

            let c_left = captures[0];
            let c_right = captures[1];
            if (on_board(c_left[0], c_left[1]) && this.board.has_piece_at(c_left[0], c_left[1], opposing_color)) {
                capture_moves = this.push_move(c_left[0], c_left[1], capture_moves, verify_valid);
                if (c_left[0] == 0 || c_left[0] == 7)
                    promotion_moves = this.push_move(c_left[0], c_left[1], promotion_moves, verify_valid);
            }
            if (on_board(c_right[0], c_right[1]) && this.board.has_piece_at(c_right[0], c_right[1], opposing_color)) {
                capture_moves = this.push_move(c_right[0], c_right[1], capture_moves, verify_valid);
                if (c_right[0] == 0 || c_right[0] == 7)
                    promotion_moves = this.push_move(c_right[0], c_right[1], promotion_moves, verify_valid);
            }

            // Add in pawn en_passant, rush, and promotion moves
            let dir = (this.color == "w" ? -1 : 1);
            if (!this.has_moved && !this.board.has_piece_at(this.row + dir, this.col) && !this.board.has_piece_at(this.row + 2 * dir, this.col)) {
                available_moves = this.push_move(this.row + 2 * dir, this.col, available_moves, verify_valid);
                rush_moves = this.push_move(this.row + 2 * dir, this.col, rush_moves, verify_valid);
            }
            let pr = this.board.pawn_rush;
            if (pr !== null && pr.row == this.row) {
                if (pr.col == this.col + 1) {
                    capture_moves = this.push_move(this.row + dir, this.col + 1, capture_moves, verify_valid);
                    enpassant_moves = this.push_move(this.row + dir, this.col + 1, enpassant_moves, verify_valid);
                } else if (pr.col == this.col - 1) {
                    capture_moves = this.push_move(this.row + dir, this.col - 1, capture_moves, verify_valid);
                    enpassant_moves = this.push_move(this.row + dir, this.col - 1, enpassant_moves, verify_valid);
                }
            }
        } else if (piece_type == "r") {
            let dir = [
                [1, 0],
                [-1, 0],
                [0, -1],
                [0, 1]
            ]

            // Loop through all possible straight moves
            for (let d = 0; d < dir.length; d++) {
                let r_dir = dir[d][0];
                let c_dir = dir[d][1];
                for (let i = 1; i < 8; i++) {
                    let r = row + r_dir * i;
                    let c = col + c_dir * i;
                    if (on_board(r, c)) {
                        if (this.board.has_piece_at(r, c, opposing_color)) {
                            capture_moves = this.push_move(r, c, capture_moves, verify_valid);
                            break; // break since once one move is blocked in a single direction, we can no longer move anywhere there
                        }
                        else if (!this.board.has_piece_at(r, c))
                            available_moves = this.push_move(r, c, available_moves, verify_valid);
                        else {
                            blocked_moves = this.push_move(r, c, blocked_moves, verify_valid);
                            break; // break since once one move is blocked in a single direction, we can no longer move anywhere there
                        }
                    }
                }
            }
        } else if (piece_type == "b") {
            let dir = [
                [1, 1],
                [1, -1],
                [-1, -1],
                [-1, 1]
            ]

            // Loop through all possible diagonal moves
            for (let d = 0; d < dir.length; d++) {
                let r_dir = dir[d][0];
                let c_dir = dir[d][1];
                for (let i = 1; i < 8; i++) {
                    let r = row + r_dir * i;
                    let c = col + c_dir * i;
                    if (on_board(r, c)) {
                        if (this.board.has_piece_at(r, c, opposing_color)) {
                            capture_moves = this.push_move(r, c, capture_moves, verify_valid);
                            break; // break since once one move is blocked in a single direction, we can no longer move anywhere there
                        }
                        else if (!this.board.has_piece_at(r, c)) {
                            available_moves = this.push_move(r, c, available_moves, verify_valid);
                        } else {
                            blocked_moves = this.push_move(r, c, blocked_moves, verify_valid);
                            break; // break since once one move is blocked in a single direction, we can no longer move anywhere there
                        }
                    } else {
                        break;
                    }
                }
            }
        } else if (piece_type == "q") {
            let dir = [
                [1, 0],
                [-1, 0],
                [0, -1],
                [0, 1],
                [1, 1],
                [1, -1],
                [-1, -1],
                [-1, 1]
            ]

            // Loop through all possible diagonal and straight moves
            for (let d = 0; d < dir.length; d++) {
                let r_dir = dir[d][0];
                let c_dir = dir[d][1];
                for (let i = 1; i < 8; i++) {
                    let r = row + r_dir * i;
                    let c = col + c_dir * i;
                    if (on_board(r, c)) {
                        if (this.board.has_piece_at(r, c, opposing_color)) {
                            capture_moves = this.push_move(r, c, capture_moves, verify_valid);
                            break; // break since once one move is blocked in a single direction, we can no longer move anywhere there
                        }
                        else if (!this.board.has_piece_at(r, c)) {
                            available_moves = this.push_move(r, c, available_moves, verify_valid);
                        } else {
                            blocked_moves = this.push_move(r, c, blocked_moves, verify_valid);
                            break; // break since once one move is blocked in a single direction, we can no longer move anywhere there
                        }
                    } else {
                        break;
                    }
                }
            }
        } else if (piece_type == "n") {
            let moves = knight_moves(row, col);

            for (let m = 0; m < moves.length; m++) {
                let r = moves[m][0];
                let c = moves[m][1];

                if (on_board(r, c)) {
                    if (this.board.has_piece_at(r, c, opposing_color))
                        capture_moves = this.push_move(r, c, capture_moves, verify_valid);
                    else if (this.board.has_piece_at(r, c))
                        blocked_moves = this.push_move(r, c, blocked_moves, verify_valid);
                    else
                        available_moves = this.push_move(r, c, available_moves, verify_valid);
                }
            }
        } else if (piece_type == "k") {
            let relative_moves = [
                [1, -1],
                [1, 0],
                [1, 1],
                [-1, -1],
                [-1, 0],
                [-1, 1],
                [0, -1],
                [0, 1]
            ];

            let marked = this.board.marked_by(opposing_color);

            for (let m = 0; m < relative_moves.length; m++) {
                let r = row + relative_moves[m][0];
                let c = col + relative_moves[m][1];

                if (on_board(r, c)) {
                    if (marked[r][c]) {
                        blocked_moves = this.push_move(r, c, blocked_moves, verify_valid);
                    } else if (this.board.has_piece_at(r, c, opposing_color))
                        capture_moves = this.push_move(r, c, capture_moves, verify_valid);
                    else if (!this.board.has_piece_at(r, c))
                        available_moves = this.push_move(r, c, available_moves, verify_valid);
                    else
                        blocked_moves = this.push_move(r, c, blocked_moves, verify_valid);
                }
            }

            // Add in castling moves
            if (this.type == "k" && !this.has_moved && !this.board.in_check[this.color]) {
                let r = (this.color == "w" ? 7 : 0);
                // check left rook
                let left_rook = this.board.pieces[r][0];
                if (left_rook !== null && !left_rook.has_moved) {
                    if (!this.board.has_piece_at(r, 1) && !this.board.has_piece_at(r, 2) && !this.board.has_piece_at(r, 3)) {
                        if (!marked[r][1] && !marked[r][2] && !marked[r][3]) {
                            // Castling is an option
                            available_moves = this.push_move(r, 2, available_moves, verify_valid);
                            castle_moves = this.push_move(r, 2, castle_moves, verify_valid);
                        }
                    }
                }
                // check right rook
                let right_rook = this.board.pieces[r][7];
                if (right_rook !== null && !right_rook.has_moved) {
                    if (!this.board.has_piece_at(r, 5) && !this.board.has_piece_at(r, 6)) {
                        if (!marked[r][5] && !marked[r][6]) {
                            // Castling is an option
                            available_moves = this.push_move(r, 6, available_moves, verify_valid);
                            castle_moves = this.push_move(r, 6, castle_moves, verify_valid);
                        }
                    }
                }
            }
        }
        return { a: available_moves, c: capture_moves, b: blocked_moves, r: rush_moves, e: enpassant_moves, s: castle_moves, p: promotion_moves };
    }

    this.push_move = function (row, col, array, verify_valid) {
        if (!verify_valid || this.can_move(row, col)) {
            if (on_board(row, col))
                array.push([row, col]);
        }
        return array;
    }

    this.can_move = function (row, col) {
        let test_board = this.board.duplicate();
        test_board.display = false;
        test_board.pieces[this.row][this.col].move_to(row, col);
        let opposing_color = this.color == "w" ? "b" : "w";
        let marked = test_board.marked_by(opposing_color);
        let king = test_board.king[this.color];

        var can_move;
        if (!marked[king.row][king.col]) can_move = true;
        else can_move = false;

        return can_move;
    }

    this.refresh_image = function () {
        let elem = document.getElementById(get_tile_id(this.row, this.col));
        let image = "<img src='img/" + this.color + this.type + ".png'/>";
        elem.innerHTML = image;
    }

    this.duplicate = function (b) {
        let new_piece = new Piece(this.color + this.type, this.row, this.col, b);
        new_piece.has_moved = this.has_moved;
        return new_piece;
    }
}

function undo() {
    game_over = false;
    let prev = board.prev;
    if (prev !== null) {
        board = prev;
        board.render();
        last_board = board.duplicate();
    }
}

function interpolate_image(terp_dest, terp_from, terp_piece, terp_start, terp_stop, terp_t) {
    let current = {
        x: terp_start.x + (terp_stop.x - terp_start.x) * terp_t,
        y: terp_start.y + (terp_stop.y - terp_start.y) * terp_t
    }
    terp_piece.setAttribute("style", "position: absolute; top:" + (current.y + 3) + "px; left:" + (current.x + 3) + "px;");
    if (terp_t < 1) {
        terp_t += 0.05;
        setTimeout(
            interpolate_image, 1000 / 90, terp_dest, terp_from, terp_piece, terp_start, terp_stop, terp_t
        )
        //requestAnimationFrame(interpolate_image);
    } else {
        terp_piece.setAttribute("style", "position: block;");
        terp_dest.innerHTML = terp_from.innerHTML;
        terp_from.innerHTML = "";
    }
}

function switch_turns() {
    if (!game_over) {
        //Switch turns
        board.turn = (board.turn == "w" ? "b" : "w");
        if (board.turn == "w") turn_number++;

        //store board
        if (last_board !== undefined) {
            board.prev = last_board;
        }
        last_board = board.duplicate();

        let game_status = board.game_status(board.turn);
        var win_text;
        switch (game_status) {
            case "check":
                window.alert((board.turn == "w" ? "White" : "Black") + " is in check.");
                break;
            case "checkmate":
                game_over = true;
                win_text = "Checkmate. " + (board.turn == "w" ? "Black" : "White") + " won in " + turn_number + " turns.";
                window.alert(win_text);
                document.getElementById("title").innerHTML = win_text;
                break;
            case "stalemate":
                game_over = true;
                win_text = "Stalemate. Game ended in a draw after " + turn_number + " turns.";
                window.alert(win_text);
                document.getElementById("title").innerHTML = win_text;
                break;
            default:
                break;
        }

        board.selected = null;
        remove_all_classes();

        if (ai && board.turn == "b") {
            setTimeout(
                function () {
                    board.move_ai(2);
                    switch_turns();
                },
                1000
            );
        }

    }
}

function not_on_board_error(row, col) {
    console.warn("Piece move is not on board! Tried highlighting row: " + row + ", col: " + col + ", but it is not located on the board. If this should be on the board, check your on_board() function!");
}

function has_class(row, col, class_name) {
    if (!on_board(row, col)) return false;
    let id = get_tile_id(row, col);
    let elem = document.getElementById(id);
    return elem.classList.contains(class_name);
}

function add_class(row, col, class_name) {
    if (!on_board(row, col)) return false;
    let id = get_tile_id(row, col);
    let elem = document.getElementById(id);
    elem.classList.add(class_name);
}

function remove_class(row, col, class_name) {
    if (!on_board(row, col)) return false;
    let id = get_tile_id(row, col);
    let elem = document.getElementById(id);
    elem.classList.remove(class_name);
}

function remove_classes(row, col) {
    if (!on_board(row, col)) return false;
    let id = get_tile_id(row, col);
    let elem = document.getElementById(id);
    elem.className = '';
}

function remove_all_classes() {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            remove_classes(r, c);
        }
    }
}

function get_tile_id(row, col) {
    return "" + String.fromCharCode(('A').charCodeAt(0) + col) + (8 - row);
}

function get_tile_index(id) {
    let char_1 = id.charCodeAt(0); // first character in ascii number format (column)
    let char_2 = id.charAt(1);     // second character (row)

    let col = char_1 - ('A').charCodeAt(0); // we will get a number from 0 - 7 that represents the column index
    let row = 8 - parseInt(char_2); // we will subtract char_2 from 8 to get a value 0 - 7 that represents the row index

    return { col: col, row: row };
}

function on_board(row, col) {
    if (row >= 0 && row < 8 && col >= 0 && col < 8) // Write the condition in this if statement
        return true;
    else
        return false;
}

function pawn_move(row, col, color) {

    var move;
    var dir;
    if (color == "w") dir = -1;
    else if (color == "b") dir = 1;

    move = [row + dir, col];

    return move;
}

function pawn_capture_moves(row, col, color) {

    var left_capture;
    var right_capture;

    var dir;
    if (color == "w") dir = -1;
    else if (color == "b") dir = 1;

    left_capture = [row + dir, col - 1];
    right_capture = [row + dir, col + 1];

    return [left_capture, right_capture];
}

function knight_moves(row, col) {
    var moves = Array(8);

    moves[0] = [row - 2, col - 1];
    moves[1] = [row - 2, col + 1];
    moves[2] = [row - 1, col - 2];
    moves[3] = [row - 1, col + 2];
    moves[4] = [row + 1, col - 2];
    moves[5] = [row + 1, col + 2];
    moves[6] = [row + 2, col - 1];
    moves[7] = [row + 2, col + 1];

    return moves;
}

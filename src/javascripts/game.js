"use strict";
class Move {
    constructor(piece, x, y, type = 'blocked', captured_piece) {
        this.piece = piece;
        this.x = x;
        this.y = y;
        this.origin = {
            x: piece.pos.x,
            y: piece.pos.y
        };
        this.set_type(type);
        if (captured_piece) {
            this.capture(captured_piece);
        }
    }
    execute() {
        const board = this.piece.board;
        board.en_passant = undefined;
        if (this.is_stale()) {
            board.halfturn_num++;
        }
        else {
            board.halfturn_num = 0;
        }
        if (this.captured_piece) {
            this.captured_piece.take();
        }
        else {
            if (this.piece instanceof King) {
                if (this.piece.color == 'w') {
                    board.castles.K = false;
                    board.castles.Q = false;
                }
                else {
                    board.castles.k = false;
                    board.castles.q = false;
                }
            }
            if (this.piece instanceof Rook) {
                if (this.piece.color == 'w') {
                    if (this.piece.pos.x == 0)
                        board.castles.Q = false;
                    else
                        board.castles.K = false;
                }
                else {
                    if (this.piece.pos.x == 0)
                        board.castles.q = false;
                    else
                        board.castles.k = false;
                }
            }
        }
        this.piece.move(this);
        if (this.after) {
            this.after();
        }
        if (board.turn == 'b') {
            board.turn_num++;
            board.turn = 'w';
        }
        else {
            board.turn = 'b';
        }
    }
    is_stale() {
        return !(this.piece instanceof Pawn || this.captured_piece !== undefined);
    }
    capture(piece) {
        this.captured_piece = piece;
    }
    set_type(type) {
        type = type.toLowerCase();
        const valid_types = ['available', 'blocked', 'castle', 'pawn-rush', 'capture', 'en-passant', 'promote_r', 'promote_n', 'promote_b', 'promote_q'];
        let valid = false;
        for (let i = 0; i < valid_types.length; i++) {
            if (valid_types[i] === type)
                valid = true;
        }
        if (!valid)
            throw new Error(`Invalid move type: ${type}`);
        this.type = type;
    }
    get_code() {
        let code = Board.get_tile_code(this.origin) + Board.get_tile_code(this);
        if (this.captured_piece) {
            code += 't' + Board.get_tile_code(this.captured_piece.pos);
        }
        return code;
    }
    get_result() {
        const board_copy = new Board({ fen_str: this.piece.board.get_fen_string() });
        const piece = board_copy.piece_at(this.piece.pos);
        let captured_piece = undefined;
        if (this.captured_piece) {
            captured_piece = board_copy.piece_at(this.captured_piece.pos);
            if (!captured_piece)
                throw new Error("Could not find copy of captured piece in board copy.");
        }
        if (!piece)
            throw new Error("Could not find copy of piece in board copy.");
        (new Move(piece, this.x, this.y, this.type, captured_piece)).execute();
        return board_copy;
    }
}
class Piece {
    static opponent(color) {
        return color == 'w' ? 'b' : 'w';
    }
    constructor(x, y, color, board) {
        this.color = color == 'w' ? 'w' : 'b';
        this.pos = { x: x, y: y };
        this.board = board;
        this.add_to_board();
    }
    add_to_board() {
        if (this.board.board_elem) {
            this.elem = this.make_elem();
            this.board.place_piece_at(this, this.pos);
        }
        this.board.tiles[this.pos.x][this.pos.y] = this;
        this.board.pieces[this.color].push(this);
    }
    get_valid_moves() {
        const moves = this instanceof King ? this.get_moves().concat(this.get_castle_moves()) : this.get_moves();
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            if (move.type !== 'blocked' && move.get_result().is_check(move.piece.color == 'w' ? 'b' : 'w')) {
                move.type = 'blocked';
            }
        }
        ;
        return moves;
    }
    move(pos) {
        this.board.tiles[this.pos.x][this.pos.y] = undefined;
        this.board.tiles[pos.x][pos.y] = this;
        if (this.elem) {
            this.elem.remove();
            this.board.place_piece_at(this, pos);
        }
        this.pos = pos;
    }
    take() {
        this.board.tiles[this.pos.x][this.pos.y] = undefined;
        switch (this.color) {
            case 'w':
            case 'b':
                this.board.remove_piece(this);
                break;
            default:
                console.error(`Cannot find piece with color: ${this.color}!`);
        }
    }
    get_straight_moves() {
        const moves = new Array();
        const dir = [
            { x: 1, y: 0, blocked: false },
            { x: -1, y: 0, blocked: false },
            { x: 0, y: 1, blocked: false },
            { x: 0, y: -1, blocked: false },
        ];
        for (let i = 1; i < 8; i++) {
            for (let d = 0; d < dir.length; d++) {
                if (!dir[d].blocked) {
                    const move = new Move(this, this.pos.x + i * dir[d].x, this.pos.y + i * dir[d].y);
                    if (Board.in_bounds(move)) {
                        moves.push(move);
                        const piece = this.board.has_piece_at(move);
                        if (piece) {
                            dir[d].blocked = true;
                            if (piece.color != this.color) {
                                move.capture(piece);
                                move.set_type('capture');
                            }
                        }
                        else {
                            move.set_type('available');
                        }
                    }
                }
            }
        }
        return moves;
    }
    get_diagonal_moves() {
        const moves = new Array();
        const dir = [
            { x: 1, y: 1, blocked: false },
            { x: 1, y: -1, blocked: false },
            { x: -1, y: 1, blocked: false },
            { x: -1, y: -1, blocked: false },
        ];
        for (let i = 1; i < 8; i++) {
            for (let d = 0; d < dir.length; d++) {
                if (!dir[d].blocked) {
                    const move = new Move(this, this.pos.x + i * dir[d].x, this.pos.y + i * dir[d].y);
                    if (Board.in_bounds(move)) {
                        moves.push(move);
                        const piece = this.board.has_piece_at(move);
                        if (piece) {
                            dir[d].blocked = true;
                            if (piece.color != this.color) {
                                move.capture(piece);
                                move.set_type('capture');
                            }
                        }
                        else {
                            move.set_type('available');
                        }
                    }
                }
            }
        }
        return moves;
    }
}
class Pawn extends Piece {
    get_worth() {
        return 1;
    }
    get_moves() {
        const moves = new Array();
        const dir = this.color == 'w' ? 1 : -1;
        var start_y = 1;
        if (this.color == 'b')
            start_y = 6;
        if (this.pos.y == start_y) {
            const move = new Move(this, this.pos.x, this.pos.y + 2 * dir);
            const en_passant = new Move(this, this.pos.x, this.pos.y + dir);
            if (Board.in_bounds(move)) {
                moves.push(move);
                if (!this.board.has_piece_at(move) && !this.board.has_piece_at(en_passant)) {
                    move.set_type('pawn-rush');
                    move.after = () => {
                        this.board.en_passant = en_passant;
                    };
                }
            }
        }
        for (let x = -1; x <= 1; x += 2) {
            const capture = new Move(this, this.pos.x + x, this.pos.y + dir, 'capture');
            if (Board.in_bounds(capture)) {
                var captured_piece = this.board.has_piece_at(capture, Piece.opponent(this.color)) ||
                    this.board.has_enpassant_at(capture, Piece.opponent(this.color));
                if (captured_piece) {
                    capture.capture(captured_piece);
                    moves.push(capture);
                }
            }
        }
        var far_y = 7;
        if (this.color == 'b')
            far_y = 0;
        if (this.pos.y + dir == far_y) {
            const promotion_tile = { x: this.pos.x, y: this.pos.y + dir };
            if (Board.in_bounds(promotion_tile) && !this.board.has_piece_at(promotion_tile)) {
                const options = ['r', 'b', 'n', 'q'];
                options.forEach(type => {
                    const promotion = new Move(this, promotion_tile.x, promotion_tile.y, `promote_${type}`);
                    moves.push(promotion);
                    promotion.after = () => {
                        this.promote_to(type);
                    };
                });
            }
        }
        else {
            const forward = new Move(this, this.pos.x, this.pos.y + dir);
            if (Board.in_bounds(forward)) {
                moves.push(forward);
                if (!this.board.has_piece_at(forward)) {
                    forward.set_type('available');
                }
            }
        }
        return moves;
    }
    promote_to(type) {
        this.board.remove_piece(this);
        let new_piece;
        switch (type) {
            case 'r':
                new_piece = new Rook(this.pos.x, this.pos.y, this.color, this.board);
                break;
            case 'b':
                new_piece = new Bishop(this.pos.x, this.pos.y, this.color, this.board);
                break;
            case 'n':
                new_piece = new Knight(this.pos.x, this.pos.y, this.color, this.board);
                break;
            case 'q':
                new_piece = new Queen(this.pos.x, this.pos.y, this.color, this.board);
                break;
        }
        if (!new_piece)
            throw new Error(`Could not promote to type ${type}.`);
    }
    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}p.png`)
            .addClass("piece pawn");
    }
}
class Rook extends Piece {
    get_worth() {
        return 5;
    }
    get_moves() {
        return this.get_straight_moves();
    }
    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}r.png`)
            .addClass("piece rook");
    }
}
class Knight extends Piece {
    get_worth() {
        return 3;
    }
    get_moves() {
        const moves = new Array();
        const motions = [
            { x: 1, y: 2 },
            { x: 2, y: 1 }
        ];
        const dir = [
            { x: 1, y: 1 },
            { x: 1, y: -1 },
            { x: -1, y: 1 },
            { x: -1, y: -1 },
        ];
        for (let m = 0; m < motions.length; m++) {
            for (let d = 0; d < dir.length; d++) {
                const move = new Move(this, this.pos.x + motions[m].x * dir[d].x, this.pos.y + motions[m].y * dir[d].y);
                if (Board.in_bounds(move)) {
                    moves.push(move);
                    const piece = this.board.has_piece_at(move);
                    if (!piece) {
                        move.set_type('available');
                    }
                    else if (piece.color != this.color) {
                        move.capture(piece);
                        move.set_type('capture');
                    }
                }
            }
        }
        return moves;
    }
    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}n.png`)
            .addClass("piece knight");
    }
}
class Bishop extends Piece {
    get_worth() {
        return 3;
    }
    get_moves() {
        return this.get_diagonal_moves();
    }
    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}b.png`)
            .addClass("piece bishop");
    }
}
class Queen extends Piece {
    get_worth() {
        return 9;
    }
    get_moves() {
        return this.get_diagonal_moves().concat(this.get_straight_moves());
    }
    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}q.png`)
            .addClass("piece queen");
    }
}
class King extends Piece {
    get_worth() {
        return Infinity;
    }
    get_castle_moves() {
        const moves = new Array();
        if (this.color == 'w') {
            if (this.board.castles.K) {
                const castle = new Move(this, 6, 0);
                moves.push(castle);
                if (!this.board.has_piece_at({ x: 5, y: 0 }) && !this.board.has_piece_at({ x: 6, y: 0 })) {
                    if (!this.board.is_check()) {
                        castle.set_type('castle');
                        castle.after = () => {
                            const rook = this.board.piece_at({ x: 7, y: 0 });
                            if (!rook)
                                throw new Error("Rook expected at H1 for castle.");
                            rook.move({ x: 5, y: 0 });
                        };
                    }
                }
            }
            if (this.board.castles.Q) {
                const castle = new Move(this, 2, 0);
                moves.push(castle);
                if (!this.board.has_piece_at({ x: 1, y: 0 }) && !this.board.has_piece_at({ x: 2, y: 0 }) && !this.board.has_piece_at({ x: 3, y: 0 })) {
                    if (!this.board.is_check()) {
                        castle.set_type('castle');
                        castle.after = () => {
                            const rook = this.board.piece_at({ x: 0, y: 0 });
                            if (!rook)
                                throw new Error("Rook expected at A1 for castle.");
                            rook.move({ x: 3, y: 0 });
                        };
                    }
                }
            }
        }
        else {
            if (this.board.castles.k) {
                const castle = new Move(this, 6, 7);
                moves.push(castle);
                if (!this.board.has_piece_at({ x: 5, y: 7 }) && !this.board.has_piece_at({ x: 6, y: 7 })) {
                    if (!this.board.is_check()) {
                        castle.set_type('castle');
                        castle.after = () => {
                            const rook = this.board.piece_at({ x: 7, y: 7 });
                            if (!rook)
                                throw new Error("Rook expected at H8 for castle.");
                            rook.move({ x: 5, y: 7 });
                        };
                    }
                }
            }
            if (this.board.castles.q) {
                const castle = new Move(this, 2, 7);
                moves.push(castle);
                if (!this.board.has_piece_at({ x: 1, y: 7 }) && !this.board.has_piece_at({ x: 2, y: 7 }) && !this.board.has_piece_at({ x: 3, y: 7 })) {
                    if (!this.board.is_check()) {
                        castle.set_type('castle');
                        castle.after = () => {
                            const rook = this.board.piece_at({ x: 0, y: 7 });
                            if (!rook)
                                throw new Error("Rook expected at A8 for castle.");
                            rook.move({ x: 3, y: 7 });
                        };
                    }
                }
            }
        }
        return moves;
    }
    get_moves() {
        const moves = new Array();
        const dir = [
            { x: 0, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: 0 },
            { x: 1, y: -1 },
            { x: 0, y: -1 },
            { x: -1, y: -1 },
            { x: -1, y: 0 },
            { x: -1, y: 1 }
        ];
        for (let d = 0; d < dir.length; d++) {
            const move = new Move(this, this.pos.x + dir[d].x, this.pos.y + dir[d].y);
            if (Board.in_bounds(move)) {
                moves.push(move);
                const piece = this.board.has_piece_at(move);
                if (!piece) {
                    move.set_type('available');
                }
                else if (piece.color != this.color) {
                    move.capture(piece);
                    move.set_type('capture');
                }
            }
        }
        return moves;
    }
    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}k.png`)
            .addClass("piece king");
    }
}
class Board {
    constructor({ fen_str = Board.START_FEN, side = 'w', parent_elem, tile_onclick }) {
        this.turn = 'w';
        this.side = side;
        this.piece_set_name = "kiffset_light";
        this.king = { 'w': undefined, 'b': undefined };
        this.tile_onclick = tile_onclick;
        if (parent_elem) {
            $(parent_elem).html("");
            this.append_to(parent_elem);
        }
        this.load_fen(fen_str);
    }
    static in_bounds(pos) {
        return (pos.x >= 0 && pos.x < 8 && pos.y >= 0 && pos.y < 8);
    }
    static get_tile_code(pos) {
        return `${String.fromCharCode(('a').charCodeAt(0) + pos.x)}${pos.y + 1}`;
    }
    static get_coord(tile_code) {
        return {
            x: tile_code.charCodeAt(0) - ('a').charCodeAt(0),
            y: parseInt(tile_code.charAt(1)) - 1
        };
    }
    load_fen(fen_str) {
        const args = fen_str.split(' ');
        const ranks = args[0].split('/');
        this.turn = args[1] == 'b' ? 'b' : 'w';
        this.castles = {
            K: args[2].includes('K'),
            Q: args[2].includes('Q'),
            k: args[2].includes('k'),
            q: args[2].includes('q')
        };
        this.en_passant = Board.get_coord(args[3]);
        this.turn_num = parseInt(args[4]);
        this.halfturn_num = parseInt(args[5]);
        this.tiles = new Array(8);
        for (let i = 0; i < 8; i++) {
            this.tiles[i] = new Array(8);
        }
        this.pieces = {
            'w': new Array(),
            'b': new Array()
        };
        for (let rank = 0; rank < ranks.length; rank++) {
            let file = 0;
            let char_num = 0;
            while (file < 8) {
                const char = ranks[7 - rank].charAt(char_num);
                const blank_spaces = parseInt(char);
                if (!isNaN(blank_spaces)) {
                    file += blank_spaces;
                }
                else {
                    let piece = undefined;
                    const type = char.toUpperCase();
                    const side = type === char ? 'w' : 'b';
                    switch (type) {
                        case 'P':
                            piece = new Pawn(file, rank, side, this);
                            break;
                        case 'R':
                            piece = new Rook(file, rank, side, this);
                            break;
                        case 'N':
                            piece = new Knight(file, rank, side, this);
                            break;
                        case 'B':
                            piece = new Bishop(file, rank, side, this);
                            break;
                        case 'Q':
                            piece = new Queen(file, rank, side, this);
                            break;
                        case 'K':
                            const king = new King(file, rank, side, this);
                            this.king[side] = king;
                            piece = king;
                            break;
                    }
                    if (!piece) {
                        throw new Error(`Piece type [${char}] is not a valid FEN piece code`);
                    }
                    file++;
                }
                char_num++;
            }
        }
    }
    append_to(elem) {
        const board = $(document.createElement("table")).addClass("chess-board");
        this.board_elem = board;
        $(elem).append(board);
        for (let row = 1; row <= 8; row++) {
            const tr = $(document.createElement("tr"));
            if (this.side == 'w') {
                board.prepend(tr);
            }
            else {
                board.append(tr);
            }
            for (let col = 0; col < 8; col++) {
                const char = String.fromCharCode(('A').charCodeAt(0) + col);
                const tile = $(document.createElement("td"))
                    .attr("tile", `${char}${row}`)
                    .attr("x", col)
                    .attr("y", row - 1)
                    .addClass(((row % 2) + col) % 2 == 0 ? "white-tile" : "black-tile")
                    .on("click", (e) => {
                    const code = `${char}${row}`;
                    const x = col;
                    const y = row - 1;
                    const piece = this.has_piece_at({ x: col, y: row - 1 }, this.turn);
                    if (this.tile_onclick)
                        tile_onclick(e.delegateTarget, code, x, y, piece);
                });
                tr.append(tile);
                if (col == 0) {
                    tile.append($(document.createElement("div"))
                        .addClass("row-label")
                        .html("" + row));
                }
                if (row == 1) {
                    tile.append($(document.createElement("div"))
                        .addClass(`col-label-${this.side}`)
                        .html("" + char));
                }
            }
        }
        return board;
    }
    has_piece_at(pos, color) {
        const piece = this.piece_at(pos);
        if (piece instanceof Piece) {
            if (color) {
                if (piece.color == color) {
                    return piece;
                }
                else {
                    return undefined;
                }
            }
            else {
                return piece;
            }
        }
        else {
            return undefined;
        }
    }
    piece_at(pos) {
        return this.tiles[pos.x][pos.y];
    }
    remove_piece(piece) {
        var _a;
        const idx = this.pieces[piece.color].findIndex(p => p == piece);
        delete this.pieces[piece.color][idx];
        (_a = piece.elem) === null || _a === void 0 ? void 0 : _a.remove();
    }
    has_enpassant_at(pos, color) {
        if (this.en_passant && this.en_passant.x == pos.x && this.en_passant.y == pos.y) {
            const en_passant_piece = this.en_passant.y == 2 ?
                this.piece_at({ x: this.en_passant.x, y: 3 }) :
                this.piece_at({ x: this.en_passant.x, y: 4 });
            if (!en_passant_piece)
                throw new Error("No Piece at expected en passant position.");
            if (color) {
                if (en_passant_piece.color == color) {
                    return en_passant_piece;
                }
                else {
                    return undefined;
                }
            }
            else {
                return en_passant_piece;
            }
        }
        else {
            return undefined;
        }
    }
    place_piece_at(piece, pos) {
        if (piece.elem) {
            $(`td[x=${pos.x}][y=${pos.y}]`).append(piece.elem);
        }
    }
    get_fen_string() {
        let fen = "";
        for (let rank = 7; rank >= 0; rank--) {
            let file = 0;
            let blank = 0;
            while (file < 8) {
                const piece = this.piece_at({ x: file, y: rank });
                if (piece) {
                    if (blank > 0) {
                        fen += blank;
                        blank = 0;
                    }
                    if (piece instanceof Pawn) {
                        fen += piece.color === 'w' ? 'P' : 'p';
                    }
                    else if (piece instanceof Rook) {
                        fen += piece.color === 'w' ? 'R' : 'r';
                    }
                    else if (piece instanceof Knight) {
                        fen += piece.color === 'w' ? 'N' : 'n';
                    }
                    else if (piece instanceof Bishop) {
                        fen += piece.color === 'w' ? 'B' : 'b';
                    }
                    else if (piece instanceof Queen) {
                        fen += piece.color === 'w' ? 'Q' : 'q';
                    }
                    else if (piece instanceof King) {
                        fen += piece.color === 'w' ? 'K' : 'k';
                    }
                }
                else {
                    blank++;
                }
                file++;
            }
            if (blank > 0) {
                fen += blank;
                blank = 0;
            }
            if (rank > 0)
                fen += "/";
        }
        fen += ` ${this.turn}`;
        let castles = `${this.castles.K ? 'K' : ''}${this.castles.k ? 'k' : ''}${this.castles.Q ? 'Q' : ''}${this.castles.q ? 'q' : ''}`;
        if (castles.length == 0) {
            castles = '-';
        }
        fen += ` ${castles}`;
        if (this.en_passant) {
            fen += ` ${Board.get_tile_code(this.en_passant)}`;
        }
        else {
            fen += ` -`;
        }
        fen += ` ${this.turn_num}`;
        fen += ` ${this.halfturn_num}`;
        return fen;
    }
    get_moves(valid = true, side) {
        let moves = new Array();
        const pieces = this.pieces[side !== null && side !== void 0 ? side : this.turn];
        pieces.forEach(piece => {
            moves = moves.concat(valid ? piece.get_valid_moves() : piece.get_moves());
        });
        return moves;
    }
    get_executable_moves() {
        const moves = this.get_moves();
        const exe_moves = new Array();
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            if (move.type !== 'blocked') {
                exe_moves.push(move);
            }
        }
        return exe_moves;
    }
    is_check(side) {
        const offence = side !== null && side !== void 0 ? side : (this.turn == 'w' ? 'b' : 'w');
        const defence = offence == 'w' ? 'b' : 'w';
        const moves = this.get_moves(false, offence);
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            if (move.captured_piece == this.king[defence]) {
                return true;
            }
        }
        return false;
    }
    is_checkmate() {
        return this.is_check() && this.has_no_moves();
    }
    is_stalemate() {
        return !this.is_check() && this.has_no_moves();
    }
    has_no_moves() {
        const defence_moves = this.get_moves(true, this.turn);
        for (let i = 0; i < defence_moves.length; i++) {
            if (defence_moves[i].type !== 'blocked') {
                return false;
            }
        }
        return true;
    }
    get_value() {
        const no_moves = this.has_no_moves();
        const check = this.is_check();
        const checkmate = check && no_moves;
        const stalemate = !check && no_moves;
        if (checkmate)
            return this.turn == 'b' ? Infinity : -Infinity;
        let val = 0;
        this.pieces.w.forEach(piece => {
            if (!(piece instanceof King)) {
                val += piece.get_worth();
            }
        });
        this.pieces.b.forEach(piece => {
            if (!(piece instanceof King)) {
                val -= piece.get_worth();
            }
        });
        if (stalemate) {
            return -val * Infinity;
        }
        return val;
    }
}
Board.START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
var board;
var game_mode;
var side;
window.onload = function () {
    const _GET = parse_get_vars();
    game_mode = _GET.game || 0;
    side = _GET.side == 'b' ? 'b' : 'w';
    link_event_listeners();
    if (!check_load_game(_GET)) {
        board = new Board({
            parent_elem: $("#chess-container"),
            tile_onclick: tile_onclick
        });
    }
    check_game_state();
};
function parse_get_vars() {
    const url = new URL(location.href);
    const _GET = {};
    const game = url.searchParams.get('game');
    if (game)
        _GET.game = parseInt(game);
    let fen_str = url.searchParams.get('fen');
    if (fen_str)
        fen_str = unescape(fen_str);
    if (fen_str)
        _GET.fen_str = fen_str;
    const side = url.searchParams.get('side');
    if (side)
        _GET.side = side;
    return _GET;
}
function check_load_game(game_vars) {
    if (!game_vars)
        return false;
    game_vars.parent_elem = $("#chess-container");
    if (!game_vars.parent_elem) {
        throw new Error("Chess Container is undefined.");
    }
    board = new Board({
        fen_str: game_vars.fen_str,
        side: game_vars.side == 'b' ? 'b' : 'w',
        parent_elem: game_vars.parent_elem,
        tile_onclick: tile_onclick
    });
    return true;
}
function tile_onclick(tile, code, x, y, piece) {
    if (game_mode > 0 && side != board.turn)
        return;
    if (piece) {
        const moves = piece.get_valid_moves();
        console.log(moves);
        remove_all_highlights();
        $(tile).addClass('selected');
        moves.forEach(move => {
            let tile_class = "available_move";
            switch (move.type) {
                case 'blocked':
                    tile_class = 'blocked_move';
                    break;
                case 'capture':
                case 'en-passant':
                    tile_class = 'capture_move';
                    break;
                case 'promote_r':
                case 'promote_b':
                case 'promote_n':
                case 'promote_q':
                    tile_class += ' promotion';
                    break;
            }
            $(`td[x=${move.x}][y=${move.y}]`)
                .addClass(tile_class);
        });
    }
    else if ($(tile).hasClass('available_move') || $(tile).hasClass('capture_move')) {
        const selected = $('.selected');
        console.log(selected);
        const selected_pos = {
            x: parseInt(selected.attr('x') || ""),
            y: parseInt(selected.attr('y') || "")
        };
        const selected_piece = board.piece_at(selected_pos);
        const moves = selected_piece === null || selected_piece === void 0 ? void 0 : selected_piece.get_valid_moves();
        const pos = {
            x: x,
            y: y
        };
        let promotion = undefined;
        if ($(tile).hasClass('promotion')) {
            const options = ['rook', 'bishop', 'knight', 'queen'];
            let choice = "";
            let valid = false;
            while (!valid) {
                choice = window.prompt(`What would you like to promote to? (rook, bishop, knight, queen)`) || "";
                for (let i = 0; i < options.length; i++) {
                    if (choice === options[i])
                        valid = true;
                }
            }
            switch (choice) {
                case 'rook':
                    promotion = 'promote_r';
                    break;
                case 'bishop':
                    promotion = 'promote_b';
                    break;
                case 'knight':
                    promotion = 'promote_n';
                    break;
                case 'queen':
                    promotion = 'promote_q';
                    break;
            }
        }
        if (moves) {
            for (let i = 0; i < moves.length; i++) {
                const move = moves[i];
                if (move.x == pos.x && move.y == pos.y && (!promotion || move.type === promotion)) {
                    move.execute();
                    remove_all_highlights();
                    update_url();
                    const game_over = check_game_state();
                    if (!game_over && game_mode > 0) {
                        setTimeout(() => {
                            const move = get_ai_move(board, game_mode);
                            move === null || move === void 0 ? void 0 : move.execute();
                            update_url();
                            check_game_state();
                        }, 0);
                    }
                    break;
                }
            }
        }
    }
    else {
        remove_all_highlights();
    }
}
function update_url() {
    const url = new URL(location.href);
    url.searchParams.set('fen', board.get_fen_string());
    url.searchParams.set('game', "" + game_mode);
    window.history.pushState({}, '', url.toString());
}
function check_game_state() {
    const checkmate = board.is_checkmate();
    const stalemate = board.is_stalemate();
    const check = board.is_check();
    setTimeout(() => {
        if (checkmate) {
            window.alert(`${board.turn == 'w' ? 'Black' : 'White'} won by checkmate in ${board.turn_num} turns.`);
        }
        else if (stalemate) {
            window.alert(`${board.turn == 'w' ? 'Black' : 'White'} has entered stalemate in ${board.turn_num} turns.`);
        }
        else if (check) {
            window.alert(`${board.turn == 'w' ? 'White' : 'Black'} is in check.`);
        }
    }, 0);
    return checkmate || stalemate;
}
function remove_all_highlights() {
    $('.selected').removeClass('selected');
    $('.blocked_move').removeClass('blocked_move');
    $('.available_move').removeClass('available_move');
    $('.capture_move').removeClass('capture_move');
    $('.promotion').removeClass('promotion');
}
function link_event_listeners() {
    $("#new-game-btn").on("click", () => {
        $("#play-options").toggle("fast");
    });
    $("#nav-toggle").on("click", () => {
        $("nav").toggle("fast");
    });
    $("#play-player").on("click", () => {
        window.location.assign("/?game=0");
    });
    $("#play-ai-beginner").on("click", () => {
        window.location.assign("/?game=1");
    });
    $("#play-ai-easy").on("click", () => {
        window.location.assign("/?game=2");
    });
    $("#play-ai-normal").on("click", () => {
        window.location.assign("/?game=3");
    });
    $("#play-ai-hard").on("click", () => {
        window.location.assign("/?game=4");
    });
    $("#undo").on("click", () => {
        window.history.back();
    });
    $("#redo").on("click", () => {
        window.history.forward();
    });
    window.onpopstate = () => {
        window.location.reload();
    };
}
function get_ai_move(board, difficulty = 1, depth) {
    const side = board.turn;
    console.log(side);
    const value_mult = (side == 'w' ? 1 : -1);
    const moves = board.get_executable_moves();
    if (moves.length == 0)
        return undefined;
    switch (difficulty) {
        case 4: {
            const explore_move = (move, data, depth = 1) => {
                const result = move.get_result();
                const moves = result.get_executable_moves();
                for (let i = 0; i < moves.length; i++) {
                    if (depth == 0) {
                        const value = moves[i].get_result().get_value();
                        data.total_value += value;
                        data.num_tests++;
                    }
                    else {
                        explore_move(moves[i], data, depth - 1);
                    }
                }
            };
            let best = random_move(moves);
            if (!best)
                return undefined;
            let max = best.get_result().get_value() * value_mult;
            for (let i = 0; i < moves.length; i++) {
                const data = {
                    move: moves[i],
                    num_tests: 0,
                    total_value: 0
                };
                explore_move(moves[i], data, 2);
                data.total_value *= value_mult;
                const avg = data.total_value / data.num_tests;
                if (avg > max) {
                    max = avg;
                    best = moves[i];
                }
            }
        }
        case 3: {
            const move_data = new Array();
            if (depth === undefined)
                depth = 1;
            let best = undefined;
            let max = -Infinity;
            for (let i = 0; i < moves.length; i++) {
                let result = moves[i].get_result();
                if (depth > 0) {
                    const opposing_move = get_ai_move(result, difficulty, depth - 1);
                    if (opposing_move) {
                        result = opposing_move.get_result();
                    }
                }
                const value = result.get_value() * value_mult;
                move_data.push({ move: moves[i], value: value });
                if (value > max || (value == max && Math.random() <= (2.0 / moves.length))) {
                    max = value;
                    best = moves[i];
                }
            }
            if (depth == 1) {
                console.log(move_data);
                console.log("best", max, best);
            }
            if (!best) {
                console.log("no best move, returning random...");
                return get_ai_move(board, 1);
            }
            return best;
        }
        case 2: {
            let best = random_move(moves);
            if (!best)
                return undefined;
            let max = best.get_result().get_value() * value_mult;
            for (let i = 0; i < moves.length; i++) {
                const value = moves[i].get_result().get_value() * value_mult;
                console.log(moves[i], value);
                if (value > max) {
                    max = value;
                    best = moves[i];
                }
            }
            return best;
        }
        case 1:
        default:
            return random_move(moves);
    }
}
function random_move(moves) {
    if (moves.length == 0)
        return undefined;
    return moves[Math.floor(Math.random() * moves.length)];
}

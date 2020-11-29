"use strict";
class Move {
    constructor(piece, x, y, type = 'blocked') {
        this.piece = piece;
        this.x = x;
        this.y = y;
        this.origin = {
            x: piece.pos.x,
            y: piece.pos.y
        };
        this.set_type(type);
    }
    execute() {
        if (this.captured_piece) {
            this.captured_piece.take();
        }
        this.piece.move(this);
        if (this.after) {
            this.after();
        }
    }
    capture(piece) {
        this.captured_piece = piece;
    }
    set_type(type) {
        type = type.toLowerCase();
        const valid_types = ['available', 'blocked', 'castle', 'pawn-rush', 'promotion', 'capture', 'en-passant'];
        let valid = false;
        for (let i = 0; i < valid_types.length; i++) {
            if (valid_types[i] === type)
                valid = true;
        }
        if (!valid)
            throw new Error(`Invalid move type: ${type}`);
        this.type = type;
        switch (type) {
            case 'blocked':
                this.tile_class = 'blocked_move';
                break;
            case 'available':
            case 'pawn-rush':
            case 'castle':
            case 'promotion':
                this.tile_class = 'available_move';
                break;
            case 'capture':
            case 'en-passant':
                this.tile_class = 'capture_move';
                break;
        }
    }
    get_code() {
        let code = Board.get_tile_code(this.origin) + Board.get_tile_code(this);
        if (this.captured_piece) {
            code += 't' + Board.get_tile_code(this.captured_piece.pos);
        }
        return code;
    }
}
class Piece {
    static opponent(color) {
        return color == 'w' ? 'b' : 'w';
    }
    constructor(x, y, color, board) {
        this.color = color;
        this.pos = { x: x, y: y };
        this.board = board;
        this.elem = this.make_elem();
        this.board.tiles[x][y] = this;
    }
    move(pos) {
        this.board.tiles[this.pos.x][this.pos.y] = undefined;
        this.board.tiles[pos.x][pos.y] = this;
        this.elem.remove();
        this.board.place_piece_at(this, pos);
        this.pos = pos;
    }
    take() {
        this.board.tiles[this.pos.x][this.pos.y] = undefined;
        switch (this.color) {
            case 'w':
            case 'b':
                const idx = this.board.pieces[this.color].findIndex(piece => piece == this);
                delete this.board.pieces[this.color][idx];
                this.elem.remove();
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
            const promotion = new Move(this, this.pos.x, this.pos.y + dir, 'promotion');
            if (Board.in_bounds(promotion) && !this.board.has_piece_at(promotion)) {
                moves.push(promotion);
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
    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}p.png`)
            .addClass("piece pawn");
    }
}
class Rook extends Piece {
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
    constructor({ fen_str = Board.START_FEN, side = 'w', parent_elem }) {
        this.turn = 'w';
        this.side = side;
        this.piece_set_name = "kiffset_light";
        $(parent_elem).html("");
        this.append_to(parent_elem);
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
        console.log(args);
        const ranks = args[0].split('/');
        this.turn = args[1];
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
                            piece = new King(file, rank, side, this);
                            break;
                    }
                    if (!piece) {
                        throw new Error(`Piece type [${char}] is not a valid FEN piece code`);
                    }
                    this.tiles[file][rank] = piece;
                    this.pieces[side].push(piece);
                    file++;
                }
                char_num++;
            }
        }
        this.pieces['w'].concat(this.pieces['b']).forEach((piece) => {
            const tile = `${String.fromCharCode(('A').charCodeAt(0) + piece.pos.x)}${piece.pos.y + 1}`;
            $(`td[tile=${tile}]`).append(piece.elem);
        });
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
                    const piece = this.has_piece_at({ x: col, y: row - 1 }, this.turn);
                    console.log(piece);
                    if (piece) {
                        const moves = piece.get_moves();
                        this.remove_all_highlights();
                        $(e.delegateTarget).addClass('selected');
                        moves.forEach(move => {
                            $(`td[x=${move.x}][y=${move.y}]`)
                                .addClass(move.tile_class);
                        });
                    }
                    else if ($(e.delegateTarget).hasClass('available_move') || $(e.delegateTarget).hasClass('capture_move')) {
                        const selected = $('.selected');
                        console.log(selected);
                        const selected_pos = {
                            x: parseInt(selected.attr('x') || ""),
                            y: parseInt(selected.attr('y') || "")
                        };
                        const selected_piece = this.piece_at(selected_pos);
                        const moves = selected_piece === null || selected_piece === void 0 ? void 0 : selected_piece.get_moves();
                        console.log(moves);
                        const pos = {
                            x: parseInt($(e.delegateTarget).attr('x') || ""),
                            y: parseInt($(e.delegateTarget).attr('y') || "")
                        };
                        if (moves) {
                            for (let i = 0; i < moves.length; i++) {
                                const move = moves[i];
                                if (move.x == pos.x && move.y == pos.y) {
                                    this.en_passant = undefined;
                                    move.execute();
                                    this.remove_all_highlights();
                                    this.turn = this.turn == 'w' ? 'b' : 'w';
                                    const url = new URL(location.href);
                                    url.searchParams.set('fen', this.get_fen_string());
                                    window.history.pushState({}, '', url.toString());
                                    break;
                                }
                            }
                        }
                    }
                    else {
                        this.remove_all_highlights();
                    }
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
        $(`td[x=${pos.x}][y=${pos.y}]`).append(piece.elem);
    }
    remove_all_highlights() {
        $('.selected').removeClass('selected');
        $('.blocked_move').removeClass('blocked_move');
        $('.available_move').removeClass('available_move');
        $('.capture_move').removeClass('capture_move');
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
}
Board.START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

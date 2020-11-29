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
        this.piece.board.append_data(this.get_code());
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
        for (let i = 1; i < 7; i++) {
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
        for (let i = 1; i < 7; i++) {
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
                                    move.execute();
                                    this.remove_all_highlights();
                                    this.turn = this.turn == 'w' ? 'b' : 'w';
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
    constructor({ type = 0, side = 'w', data = "", parent_elem }) {
        this.turn = 'w';
        this.side = side;
        this.turn_num = 0;
        this.type = type;
        this.data = data.toLowerCase();
        this.vs_ai = this.type > 0;
        this.piece_set_name = "kiffset_light";
        $(parent_elem).html("");
        this.append_to(parent_elem);
        this.tiles = new Array(8);
        for (let i = 0; i < 8; i++) {
            this.tiles[i] = new Array(8);
        }
        this.pieces = {
            'w': [
                new Rook(0, 0, 'w', this),
                new Knight(1, 0, 'w', this),
                new Bishop(2, 0, 'w', this),
                new Queen(3, 0, 'w', this),
                new King(4, 0, 'w', this),
                new Bishop(5, 0, 'w', this),
                new Knight(6, 0, 'w', this),
                new Rook(7, 0, 'w', this)
            ],
            'b': [
                new Rook(0, 7, 'b', this),
                new Knight(1, 7, 'b', this),
                new Bishop(2, 7, 'b', this),
                new Queen(3, 7, 'b', this),
                new King(4, 7, 'b', this),
                new Bishop(5, 7, 'b', this),
                new Knight(6, 7, 'b', this),
                new Rook(7, 7, 'b', this)
            ]
        };
        for (let col = 0; col < 8; col++) {
            this.pieces['w'].push(new Pawn(col, 1, 'w', this));
            this.pieces['b'].push(new Pawn(col, 6, 'b', this));
        }
        this.pieces['w'].forEach((piece) => {
            const tile = `${String.fromCharCode(('A').charCodeAt(0) + piece.pos.x)}${piece.pos.y + 1}`;
            $(`td[tile=${tile}]`).append(piece.elem);
        });
        this.pieces['b'].forEach((piece) => {
            const tile = `${String.fromCharCode(('A').charCodeAt(0) + piece.pos.x)}${piece.pos.y + 1}`;
            $(`td[tile=${tile}]`).append(piece.elem);
        });
        if (this.data.length > 0) {
            let data = this.data;
        }
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
    append_data(data) {
        this.data += data;
        this.update_query_string();
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
            if (color) {
                if (this.en_passant.piece.color == color) {
                    return this.en_passant.piece;
                }
                else {
                    return undefined;
                }
            }
            else {
                return this.en_passant.piece;
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
    update_query_string() {
        const url = new URL(window.location.toString());
        url.searchParams.set('game', '' + this.type);
        url.searchParams.set('data', this.data);
        history.pushState({}, '', url.toString());
    }
}

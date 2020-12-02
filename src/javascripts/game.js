"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/*!
 * Copyright (c) Trevor Richard
 *
 * Author: Trevor Richard
 * License: MIT
 *
 * See LICENSE for more details.
 */
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
    execute(animate = true, done) {
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
        else if (this.piece instanceof Rook) {
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
        const end_move = () => {
            if (board.turn == 'b') {
                board.turn_num++;
                board.turn = 'w';
            }
            else {
                board.turn = 'b';
            }
            board.refresh();
            board.push_state();
            if (done)
                done();
        };
        if (done) {
            if (this.after) {
                const after = this.after;
                this.piece.move(this, animate, () => {
                    after(this.piece, end_move);
                });
            }
            else {
                this.piece.move(this, animate, end_move);
            }
        }
        else {
            this.piece.move(this, false);
            if (this.after) {
                this.after(this.piece);
            }
            end_move();
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
        board_copy.state = this.piece.board.state;
        const piece = board_copy.piece_at(this.piece.pos);
        if (!piece) {
            console.log(this);
            throw new Error("Could not find copy of piece in board copy.");
        }
        let captured_piece = undefined;
        if (this.captured_piece) {
            captured_piece = board_copy.piece_at(this.captured_piece.pos);
            if (!captured_piece)
                throw new Error("Could not find copy of captured piece in board copy.");
        }
        const move = new Move(piece, this.x, this.y, this.type, captured_piece);
        move.after = this.after;
        move.execute();
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
        if (this.board.elem) {
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
                move.note = `${move.piece.color == 'w' ? 'b' : 'w'} has check after this move. `;
            }
        }
        ;
        return moves;
    }
    move(pos, animate = true, done) {
        const animate_piece = (elem, start_left, start_top, end_left, end_top, t, after) => __awaiter(this, void 0, void 0, function* () {
            if (t >= 1) {
                after();
                return;
            }
            const duration = 200;
            const steps = duration / 10;
            const progress = 0.5 * (-Math.cos(Math.PI * t) + 1);
            $(elem).css("transform", `translate(${(end_left - start_left) * progress}px, ${(end_top - start_top) * progress}px)`);
            setTimeout(() => {
                animate_piece(elem, start_left, start_top, end_left, end_top, t + (1.0 / steps), after);
            }, duration / steps);
        });
        const last_pos = this.pos;
        this.pos = pos;
        this.board.tiles[last_pos.x][last_pos.y] = undefined;
        this.board.tiles[pos.x][pos.y] = this;
        if (this.elem) {
            const start = $(`td[x=${last_pos.x}][y=${last_pos.y}]`).position();
            const end = $(`td[x=${pos.x}][y=${pos.y}]`).position();
            const elem = this.elem;
            const place_piece = () => {
                $(elem)
                    .remove()
                    .attr('style', '');
                if (!this.taken) {
                    this.board.place_piece_at(this, pos);
                }
                if (done) {
                    done();
                }
            };
            if (animate) {
                $(elem).css("transform", `translate(0, 0)`).css('z-index', '99');
                animate_piece(elem, start.left, start.top, end.left, end.top, 0, () => {
                    place_piece();
                });
            }
            else {
                place_piece();
            }
        }
    }
    take() {
        this.taken = true;
        this.board.tiles[this.pos.x][this.pos.y] = undefined;
        switch (this.color) {
            case 'w':
            case 'b':
                this.board.take(this);
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
    make_elem(type) {
        var img_class = 'pawn';
        switch (type) {
            case 'q':
                img_class = 'queen';
                break;
            case 'r':
                img_class = 'rook';
                break;
            case 'b':
                img_class = 'bishop';
                break;
            case 'n':
                img_class = 'knight';
                break;
            case 'k':
                img_class = 'king';
                break;
        }
        return $(document.createElement("img"))
            .attr("src", `https://midpoint68.github.io/chess/img/${this.board.piece_set_name}/${this.color}${type}.png`)
            .attr('draggable', 'true')
            .attr('ondragstart', `event.dataTransfer.setData("text/plain",null);$(this).css("opacity", 0);`)
            .attr('ondragend', `this.style="";`)
            .addClass(`piece ${img_class}${this.board.piece_set_name.slice(0, 7) === 'kiffset' ? ' pixel-art' : ''}`);
    }
}
class Pawn extends Piece {
    get_worth() {
        return 1;
    }
    get_moves() {
        const moves = new Array();
        const dir = this.color == 'w' ? 1 : -1;
        const check_promotion = (move) => {
            var far_y = 7;
            if (this.color == 'b')
                far_y = 0;
            if (move.y == far_y) {
                const promote_move = (move, type) => {
                    move.set_type(`promote_${type}`);
                    move.after = (piece, done) => {
                        if (piece instanceof Pawn) {
                            piece.promote_to(type);
                        }
                        if (done)
                            done();
                    };
                };
                promote_move(move, 'q');
                const other_options = ['r', 'b', 'n'];
                other_options.forEach(type => {
                    const promotion = new Move(this, move.x, move.y);
                    if (move.captured_piece)
                        promotion.capture(move.captured_piece);
                    moves.push(promotion);
                    promote_move(promotion, type);
                });
            }
        };
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
                    move.after = (piece, done) => {
                        piece.board.en_passant = en_passant;
                        if (done)
                            done();
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
                    check_promotion(capture);
                }
            }
        }
        const forward = new Move(this, this.pos.x, this.pos.y + dir);
        if (Board.in_bounds(forward)) {
            moves.push(forward);
            if (!this.board.has_piece_at(forward)) {
                forward.set_type('available');
                check_promotion(forward);
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
        return super.make_elem('p');
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
        return super.make_elem('r');
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
        return super.make_elem('n');
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
        return super.make_elem('b');
    }
}
class Queen extends Piece {
    get_worth() {
        return 9;
    }
    get_moves() {
        const moves = this.get_diagonal_moves().concat(this.get_straight_moves());
        return moves;
    }
    make_elem() {
        return super.make_elem('q');
    }
}
class King extends Piece {
    get_worth() {
        return 2;
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
                        castle.after = (piece, done) => {
                            const rook = piece.board.piece_at({ x: 7, y: 0 });
                            if (!rook)
                                throw new Error("Rook expected at H1 for castle.");
                            rook.move({ x: 5, y: 0 }, true, done);
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
                        castle.after = (piece, done) => {
                            const rook = piece.board.piece_at({ x: 0, y: 0 });
                            if (!rook)
                                throw new Error("Rook expected at A1 for castle.");
                            rook.move({ x: 3, y: 0 }, true, done);
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
                        castle.after = (piece, done) => {
                            const rook = piece.board.piece_at({ x: 7, y: 7 });
                            if (!rook)
                                throw new Error("Rook expected at H8 for castle.");
                            rook.move({ x: 5, y: 7 }, true, done);
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
                        castle.after = (piece, done) => {
                            const rook = piece.board.piece_at({ x: 0, y: 7 });
                            if (!rook)
                                throw new Error("Rook expected at A8 for castle.");
                            rook.move({ x: 3, y: 7 }, true, done);
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
        return super.make_elem('k');
    }
}
class Board {
    constructor({ fen_str = Board.START_FEN, side = 'w', parent_elem, tile_onclick, piece_set_name = "paper" }) {
        this.turn = 'w';
        this.side = side;
        this.set_piece_set(piece_set_name);
        this.king = { 'w': undefined, 'b': undefined };
        this.tile_onclick = tile_onclick;
        this.state = undefined;
        this.state_store = new Array();
        if (parent_elem) {
            $(parent_elem).html("");
            this.append_to(parent_elem);
        }
        this.load_fen(fen_str);
        this.push_state();
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
    set_piece_set(piece_set) {
        switch (piece_set) {
            case 'kiffset':
            case 'kiffset_light':
            case 'default':
            case 'paper':
                break;
            default:
                piece_set = 'paper';
        }
        this.piece_set_name = piece_set;
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
        this.save_fen_cache(fen_str);
    }
    push_state() {
        this.state = new BoardState(this, this.state);
        this.state_store = new Array();
    }
    refresh_elem(refresh_image = false) {
        if (this.elem) {
            const parent = $(this.elem).parent();
            $(this.elem).remove();
            this.append_to(parent, refresh_image);
        }
    }
    previous_state() {
        if (this.state && this.state.prev) {
            this.state_store.push(this.state);
            this.state = this.state.prev;
            this.load_fen(this.state.fen_str);
            this.refresh_elem();
        }
    }
    next_state() {
        const state = this.state_store.pop();
        if (state) {
            this.state = state;
            this.load_fen(this.state.fen_str);
            this.refresh_elem();
        }
    }
    save_fen_cache(fen_str) {
        this.fen_cache = {
            fen_str: fen_str,
            turn: this.turn,
            turn_num: this.turn_num
        };
    }
    append_to(elem, refresh_image = false) {
        const board = $(document.createElement("table")).addClass("chess-board");
        this.elem = board;
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
                        this.tile_onclick(e.delegateTarget, code, x, y, false, piece);
                })
                    .on("dragstart", (e) => {
                    const code = `${char}${row}`;
                    const x = col;
                    const y = row - 1;
                    const piece = this.has_piece_at({ x: col, y: row - 1 }, this.turn);
                    if (this.tile_onclick)
                        this.tile_onclick(e.delegateTarget, code, x, y, false, piece);
                })
                    .on("dragenter", (e) => {
                    $('.drag-hover').removeClass('drag-hover');
                    $(e.delegateTarget).addClass('drag-hover');
                })
                    .on("dragend", (e) => {
                    $('.drag-hover').removeClass('drag-hover');
                })
                    .on("dragover", (e) => {
                    e.preventDefault();
                })
                    .on("dragleave", (e) => {
                })
                    .on("drop", (e) => {
                    const code = `${char}${row}`;
                    const x = col;
                    const y = row - 1;
                    const piece = this.has_piece_at({ x: col, y: row - 1 }, this.turn);
                    if (this.tile_onclick)
                        this.tile_onclick(e.delegateTarget, code, x, y, true, piece);
                });
                if (this.side == 'w') {
                    tr.append(tile);
                }
                else {
                    tr.prepend(tile);
                }
                if (col == (this.side == 'w' ? 0 : 7)) {
                    tile.append($(document.createElement("div"))
                        .addClass("row-label")
                        .html("" + row));
                }
                if (row == (this.side == 'w' ? 1 : 8)) {
                    tile.append($(document.createElement("div"))
                        .addClass(`col-label`)
                        .html("" + char));
                }
            }
        }
        if (this.pieces) {
            this.pieces.w.concat(this.pieces.b).forEach(piece => {
                this.place_piece_at(piece, piece.pos, refresh_image);
            });
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
    take(piece) {
        this.remove_piece(piece);
    }
    remove_piece(piece) {
        var _a;
        const idx = this.pieces[piece.color].findIndex(p => p == piece);
        delete this.pieces[piece.color][idx];
        this.tiles[piece.pos.x][piece.pos.y] = undefined;
        (_a = piece.elem) === null || _a === void 0 ? void 0 : _a.remove();
    }
    refresh() {
        this.fen_cache = undefined;
        this.get_fen_string();
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
    place_piece_at(piece, pos, refresh_image = false) {
        if (refresh_image) {
            piece.elem = piece.make_elem();
        }
        if (piece.elem) {
            $(`td[x=${pos.x}][y=${pos.y}]`).append(piece.elem);
        }
    }
    get_fen_string() {
        if (this.fen_cache && this.fen_cache.turn == this.turn && this.fen_cache.turn_num == this.turn_num) {
            return this.fen_cache.fen_str;
        }
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
        this.save_fen_cache(fen);
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
    calculate_check(side) {
        const offence = side !== null && side !== void 0 ? side : (this.turn == 'w' ? 'b' : 'w');
        const defence = offence == 'w' ? 'b' : 'w';
        const moves = this.get_moves(false, offence);
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            if (move.type !== 'blocked' && move.captured_piece == this.king[defence]) {
                return true;
            }
        }
        return false;
    }
    is_check(side) {
        if (!this.state)
            throw new Error(`State expected for board with FEN: ${this.get_fen_string()}`);
        return this.state.is_check(side);
    }
    is_checkmate() {
        if (!this.state)
            throw new Error(`State expected for board with FEN: ${this.get_fen_string()}`);
        return this.state.is_checkmate();
    }
    is_stalemate() {
        if (!this.state)
            throw new Error(`State expected for board with FEN: ${this.get_fen_string()}`);
        return this.state.is_stalemate();
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
    get_value(advanced) {
        const checkmate = this.is_checkmate();
        const stalemate = this.is_stalemate();
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
        if (advanced) {
            const castle_points = 0.25;
            const early_game = this.pieces.b.length + this.pieces.w.length > 20;
            if (early_game) {
                val += (this.castles.K ? castle_points : 0);
                val += (this.castles.Q ? castle_points : 0);
                val -= (this.castles.k ? castle_points : 0);
                val -= (this.castles.q ? castle_points : 0);
            }
            const capture_multiplier = 0.05;
            const castle_move_points = 0.1;
            const promotion_points = 0.25;
            const move_points = 0.01;
            var king_moves = { w: 0, b: 0 };
            const moves = this.get_moves(false, 'w').concat(this.get_moves(false, 'b'));
            for (let i = 0; i < moves.length; i++) {
                const move = moves[i];
                if (move.type !== 'blocked') {
                    val += move_points * (move.piece.color == 'w' ? 1 : -1);
                    if (move.piece instanceof King) {
                        king_moves[move.piece.color]++;
                    }
                    if (move.captured_piece) {
                        val += move.captured_piece.get_worth() * capture_multiplier * (move.captured_piece.color == 'w' ? -1 : 1);
                    }
                    switch (move.type) {
                        case 'promote_q':
                        case 'promote_r':
                        case 'promote_b':
                        case 'promote_n':
                            val += promotion_points * (move.piece.color == 'w' ? 1 : -1);
                            break;
                        case 'castle':
                            if (early_game) {
                                val += castle_move_points * (move.piece.color == 'w' ? 1 : -1);
                            }
                            break;
                    }
                }
            }
            const king_escape_points = 0.5;
            val += (king_moves.w >= 3 ? king_escape_points : 0) - (king_moves.b >= 3 ? king_escape_points : 0);
        }
        if (stalemate) {
            return -val * Infinity;
        }
        return val;
    }
}
Board.START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
class BoardState {
    constructor(board, prev) {
        this.board = board;
        this.fen_str = board.get_fen_string();
        this.position = this.fen_str.slice(0, this.fen_str.indexOf(' '));
        this.turn = board.turn;
        this.prev = prev;
        this.occurrence = 1;
        if (prev) {
            let current = prev;
            while (current) {
                if (current.position === this.position) {
                    this.occurrence = current.occurrence + 1;
                    break;
                }
                current = current.prev;
            }
        }
        this.check = board.calculate_check();
        this.defence_check = board.calculate_check(this.turn);
        this.calculated = false;
    }
    is_check(side) {
        if (side && side == this.turn) {
            return this.defence_check;
        }
        return this.check;
    }
    calculate_state() {
        const has_no_moves = this.board.has_no_moves();
        this.checkmate = this.check && has_no_moves;
        this.stalemate = false;
        if (!this.check && has_no_moves) {
            this.stalemate = true;
            this.stale_reason = "There are no moves available for the defensive side.";
        }
        else if (this.board.halfturn_num >= 50) {
            this.stalemate = true;
            this.stale_reason = "There have been 50 moves without a capture or pawn move.";
        }
        else if (this.occurrence >= 3) {
            this.stalemate = true;
            this.stale_reason = "The resulting position has occurred 3 times.";
        }
        this.calculated = true;
    }
    is_checkmate() {
        if (!this.calculated)
            this.calculate_state();
        return this.checkmate;
    }
    is_stalemate() {
        if (!this.calculated)
            this.calculate_state();
        return this.stalemate;
    }
}
var board;
var game_mode;
var game_over = false;
var play_as;
var piece_set;
var move_sounds = new Array();
var check_sound;
window.onload = function () {
    move_sounds.push(document.getElementById('move-sound-1'));
    move_sounds.push(document.getElementById('move-sound-2'));
    check_sound = document.getElementById('check-sound');
    const _GET = parse_get_vars();
    game_mode = _GET.game || 0;
    play_as = _GET.play_as == 'b' ? 'b' : 'w';
    piece_set = _GET.piece_set;
    if (!check_load_game(_GET)) {
        board = new Board({
            parent_elem: $("#chess-container"),
            tile_onclick: tile_onclick,
            side: play_as,
            piece_set_name: piece_set
        });
    }
    check_game_state();
    link_event_listeners();
    if (_GET.game == 5) {
        function ai_vs_ai() {
            return __awaiter(this, void 0, void 0, function* () {
                check_game_state();
                if (game_over)
                    return;
                const diff = board.turn == 'w' ? 4 : 5;
                const move = yield get_ai_move(board, diff);
                highlight_move(move);
                move === null || move === void 0 ? void 0 : move.execute(true, () => {
                    update_url();
                    ai_vs_ai();
                });
            });
        }
        ai_vs_ai();
    }
    else if (_GET.game != 0 && play_as != board.turn) {
        (() => __awaiter(this, void 0, void 0, function* () {
            const move = yield get_ai_move(board, _GET.game);
            highlight_move(move);
            move === null || move === void 0 ? void 0 : move.execute(true, () => {
                update_url();
                check_game_state();
            });
        }))();
    }
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
    const play_as = url.searchParams.get('play_as');
    if (play_as)
        _GET.play_as = play_as;
    _GET.piece_set = url.searchParams.get('piece_set') || undefined;
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
        side: game_vars.play_as == 'b' ? 'b' : 'w',
        parent_elem: game_vars.parent_elem,
        tile_onclick: tile_onclick,
        piece_set_name: piece_set
    });
    return true;
}
function tile_onclick(tile, code, x, y, dropped, piece) {
    if (game_over || (game_mode > 0 && play_as != board.turn))
        return;
    if (piece) {
        const moves = piece.get_valid_moves();
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
                    highlight_move(move);
                    move.execute(!dropped, () => {
                        update_url();
                        check_game_state();
                        if (!game_over && game_mode > 0) {
                            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                const move = yield get_ai_move(board, game_mode);
                                highlight_move(move);
                                move === null || move === void 0 ? void 0 : move.execute(true, () => {
                                    update_url();
                                    check_game_state();
                                });
                            }), 0);
                        }
                    });
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
    if (piece_set)
        url.searchParams.set('piece_set', piece_set);
    window.history.pushState({}, '', url.toString());
}
function check_game_state() {
    const checkmate = board.is_checkmate();
    const stalemate = board.is_stalemate();
    const check = board.is_check();
    try {
        if (check) {
            check_sound.play();
        }
        else {
            move_sounds[Math.floor(Math.random() * move_sounds.length)].play();
        }
    }
    catch (e) {
        console.error(e);
    }
    setTimeout(() => {
        var _a;
        if (checkmate) {
            window.alert(`${board.turn == 'w' ? 'Black' : 'White'} won by checkmate in ${board.turn_num} turns.`);
        }
        else if (stalemate) {
            window.alert(`${(_a = board.state) === null || _a === void 0 ? void 0 : _a.stale_reason} ${board.turn == 'w' ? 'Black' : 'White'} has entered stalemate in ${board.turn_num} turns.`);
        }
        else if (check) {
            $("#check-alert").fadeIn("fast").html(`${board.turn == 'w' ? 'White' : 'Black'} is in check.`);
            setTimeout(() => {
                $("#check-alert").fadeOut("slow");
            }, 2500);
        }
    }, 0);
    update_state_buttons();
    game_over = checkmate || stalemate || false;
}
function highlight_move(move) {
    if (move) {
        remove_all_highlights();
        $(`td[x=${move.piece.pos.x}][y=${move.piece.pos.y}]`).addClass('last-position');
        $(`td[x=${move.x}][y=${move.y}]`).addClass('new-position');
    }
}
function remove_all_highlights() {
    $('.selected').removeClass('selected');
    $('.blocked_move').removeClass('blocked_move');
    $('.available_move').removeClass('available_move');
    $('.capture_move').removeClass('capture_move');
    $('.promotion').removeClass('promotion');
    $('.last-position').removeClass('last-position');
    $('.new-position').removeClass('new-position');
}
function update_state_buttons() {
    var _a;
    const undo_active = ((_a = board.state) === null || _a === void 0 ? void 0 : _a.prev) || false;
    $('#undo').prop('disabled', !undo_active)
        .attr('aria-disabled', `${!undo_active}`);
    const redo_active = board.state_store.length > 0;
    $('#redo').prop('disabled', !redo_active)
        .attr('aria-disabled', `${!redo_active}`);
}
function link_event_listeners() {
    $("#new-game-btn").on("click", () => {
        $("#play-options").toggle("fast");
    });
    $("#nav-toggle").on("click", (e) => {
        e.stopPropagation();
        $("nav").toggleClass("hide-on-mobile");
    });
    $("#chess-container").on("click", () => {
        $("nav").addClass("hide-on-mobile");
    });
    $("#play-player").on("click", () => {
        window.location.assign(`${location.pathname}?game=0&play_as=${play_as}&piece_set=${piece_set}`);
    });
    $("#play-ai-beginner").on("click", () => {
        window.location.assign(`${location.pathname}?game=1&play_as=${play_as}&piece_set=${piece_set}`);
    });
    $("#play-ai-easy").on("click", () => {
        window.location.assign(`${location.pathname}?game=2&play_as=${play_as}&piece_set=${piece_set}`);
    });
    $("#play-ai-normal").on("click", () => {
        window.location.assign(`${location.pathname}?game=3&play_as=${play_as}&piece_set=${piece_set}`);
    });
    $("#play-ai-hard").on("click", () => {
        window.location.assign(`${location.pathname}?game=4&play_as=${play_as}&piece_set=${piece_set}`);
    });
    $("#undo").on("click", (e) => {
        board.previous_state();
        check_game_state();
        update_state_buttons();
        update_url();
    });
    $("#redo").on("click", (e) => {
        board.next_state();
        check_game_state();
        update_state_buttons();
        update_url();
    });
    update_state_buttons();
    const update_play_as = (elem) => {
        $(elem)
            .attr('play-as', play_as)
            .css('background-color', play_as == 'w' ? '#eee' : 'black')
            .css('color', play_as == 'w' ? 'black' : 'white')
            .html(play_as == 'w' ? "Play as <strong>Black</strong>" : "Play as <strong>White</strong>");
    };
    update_play_as($("#play-as-btn").on("click", (e) => {
        play_as = $(e.delegateTarget).attr('play-as') == 'w' ? 'b' : 'w';
        update_play_as(e.delegateTarget);
    }).attr('play-as', play_as));
    $("#rotate-board").on("click", () => {
        if (board.elem) {
            $(board.elem).remove();
        }
        board.side = board.side == 'w' ? 'b' : 'w';
        board.append_to($('#chess-container'));
    });
    $("#check-alert").on("click", (e) => {
        $(e.delegateTarget).hide();
    });
    $("#save").on("click", () => {
        const download = (filename, text) => {
            const link = $(document.createElement('a'))
                .attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text))
                .attr('download', filename)
                .hide()
                .appendTo(document.body);
            link.get(0).click();
            $(link).remove();
        };
        const date = new Date();
        download(`Chess (${date.getFullYear()}-${date.getMonth()}-${date.getDate()}).html`, `<!DOCTYPE html><h2>Click <a href="${location.href.toString()}>here</a> if not redirected..."</h2><script>window.onload=()=>{location.assign("${location.href.toString()}");}</script>`);
    });
    $("#piece-set-name").on("change", (e) => {
        const name = $(e.delegateTarget).val();
        if (name) {
            piece_set = name.toString();
            board.set_piece_set(piece_set);
            board.refresh_elem(true);
            update_url();
        }
    });
    $("#piece-set-name option").prop("selected", false);
    $(`#piece-set-name option[value=${piece_set}]`).prop("selected", true);
    $("#toggle-settings").on("click", (e) => {
        $("#settings").toggle("fast");
    });
}
function get_ai_move(board, difficulty = 1, depth) {
    return __awaiter(this, void 0, void 0, function* () {
        let first = false;
        if (depth === undefined && board.elem) {
            $(board.elem).addClass('wait')
                .find('td').addClass('wait');
            first = true;
        }
        yield new Promise(resolve => {
            setTimeout(() => {
                resolve('resolved');
            }, 5);
        });
        const side = board.turn;
        console.log(side);
        const value_mult = (side == 'w' ? 1 : -1);
        const moves = board.get_executable_moves();
        let selected_move = undefined;
        if (moves.length > 0) {
            switch (difficulty) {
                case 5: {
                    const move_data = new Array();
                    const initial_depth = 1;
                    if (depth === undefined)
                        depth = initial_depth;
                    for (let i = 0; i < moves.length; i++) {
                        let result = moves[i].get_result();
                        let following_move = undefined;
                        let following_result = undefined;
                        if (depth > 0) {
                            following_move = yield get_ai_move(result, difficulty, 0);
                            if (following_move) {
                                result = following_move.get_result();
                                following_result = result;
                            }
                        }
                        const value = result.get_value(true) * value_mult;
                        move_data.push({ move: moves[i], value: value, result: result, following_move: following_move, following_result: following_result });
                    }
                    const sorted_moves = move_data.sort((a, b) => b.value - a.value);
                    const pool_size = depth == initial_depth ? Math.min(sorted_moves.length, 16) : (1 + depth);
                    let best = undefined;
                    let max = -Infinity;
                    if (sorted_moves.length > 0) {
                        for (let b = 0; b < Math.min(sorted_moves.length, pool_size); b++) {
                            const move = sorted_moves[b].move;
                            const result = sorted_moves[b].following_result || sorted_moves[b].result;
                            let value = sorted_moves[b].value;
                            if (depth > 0) {
                                const updated_move = yield get_ai_move(result, difficulty, depth - 1);
                                if (updated_move) {
                                    const updated_result = updated_move.get_result();
                                    value = updated_result.get_value(true) * value_mult;
                                }
                            }
                            if (value > max || (value == max && Math.random() <= 0.2)) {
                                max = value;
                                best = move;
                            }
                        }
                    }
                    if (!best) {
                        console.log("no best move, returning random...");
                        selected_move = get_ai_move(board, 1);
                    }
                    else {
                        if (depth == initial_depth) {
                            console.log(`AI ${difficulty} best move [turn=${board.turn_num}] for ${board.turn}:`, max, best);
                        }
                        selected_move = best;
                    }
                    break;
                }
                case 4: {
                    if (depth === undefined)
                        depth = 1;
                    let best = undefined;
                    let max = -Infinity;
                    for (let i = 0; i < moves.length; i++) {
                        let result = moves[i].get_result();
                        if (depth > 0) {
                            const opposing_move = yield get_ai_move(result, difficulty, depth - 1);
                            if (opposing_move) {
                                result = opposing_move.get_result();
                            }
                        }
                        const value = result.get_value(true) * value_mult;
                        if (value > max || (value == max && Math.random() <= (2.0 / moves.length))) {
                            max = value;
                            best = moves[i];
                        }
                    }
                    if (depth == 1) {
                        console.log(`AI ${difficulty} best move [turn=${board.turn_num}] for ${board.turn}:`, max, best);
                    }
                    if (!best) {
                        console.log("no best move, returning random...");
                        selected_move = get_ai_move(board, 1);
                    }
                    else {
                        selected_move = best;
                    }
                    break;
                }
                case 3: {
                    if (depth === undefined)
                        depth = 1;
                    let best = undefined;
                    let max = -Infinity;
                    for (let i = 0; i < moves.length; i++) {
                        let result = moves[i].get_result();
                        if (depth > 0) {
                            const opposing_move = yield get_ai_move(result, difficulty, depth - 1);
                            if (opposing_move) {
                                result = opposing_move.get_result();
                            }
                        }
                        const value = result.get_value() * value_mult;
                        if (value > max || (value == max && Math.random() <= (2.0 / moves.length))) {
                            max = value;
                            best = moves[i];
                        }
                    }
                    if (depth == 1) {
                        console.log(`AI ${difficulty} best move [turn=${board.turn_num}] for ${board.turn}:`, max, best);
                    }
                    if (!best) {
                        console.log("no best move, returning random...");
                        selected_move = get_ai_move(board, 1);
                    }
                    else {
                        selected_move = best;
                    }
                    break;
                }
                case 2: {
                    let best = random_move(moves);
                    if (!best)
                        return undefined;
                    let max = best.get_result().get_value() * value_mult;
                    for (let i = 0; i < moves.length; i++) {
                        const value = moves[i].get_result().get_value() * value_mult;
                        if (value > max) {
                            max = value;
                            best = moves[i];
                        }
                    }
                    selected_move = best;
                    break;
                }
                case 1:
                default:
                    selected_move = random_move(moves);
                    break;
            }
        }
        if (first && board.elem)
            $('.wait').removeClass('wait');
        return selected_move;
    });
}
function random_move(moves) {
    if (moves.length == 0)
        return undefined;
    return moves[Math.floor(Math.random() * moves.length)];
}


/// <reference path="./board.ts" />

interface TilePos {
    x: number
    y: number
}

interface Move extends TilePos {
    piece: Piece
    type: string
    origin: TilePos
    captured_piece?: Piece
    note?: string
    after?: (done: () => void) => void
}

interface Piece {
    color: 'w' | 'b'
    pos: TilePos
    board: Board
    elem?: HTMLImageElement | JQuery<HTMLImageElement>
    taken?: boolean
    move(pos: TilePos): void
    get_moves(): Move[]
    make_elem(): HTMLImageElement | JQuery<HTMLImageElement>
    get_worth(): number
}

class Move implements Move {
    constructor(piece: Piece, x: number, y: number, type = 'blocked', captured_piece?: Piece) {
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

    execute(done?: () => void) {

        // Get the board
        const board = this.piece.board;

        // Remove en passant
        board.en_passant = undefined;

        // Increment halfturn count if it is a stale move (see 50 move rule)
        if (this.is_stale()) {
            board.halfturn_num++;
        } else {
            board.halfturn_num = 0;
        }

        if (this.captured_piece) {

            // Capture piece
            this.captured_piece.take();

        } else {

            // Was not a capture move

            // Check if king was moved and disable castles
            if (this.piece instanceof King) {
                if (this.piece.color == 'w') {
                    board.castles.K = false;
                    board.castles.Q = false;
                } else {
                    board.castles.k = false;
                    board.castles.q = false;
                }
            }

            // Check if a rook was moved and disable castles
            if (this.piece instanceof Rook) {
                if (this.piece.color == 'w') {
                    if (this.piece.pos.x == 0)
                        board.castles.Q = false;
                    else
                        board.castles.K = false;
                } else {
                    if (this.piece.pos.x == 0)
                        board.castles.q = false;
                    else
                        board.castles.k = false;
                }
            }

        }



        // Execute move and then after function
        if (this.after) {
            const after = this.after;
            // Move
            this.piece.move(this, () => {
                after(done || (() => { }));
            });
        } else {
            // Just Move
            this.piece.move(this, done);
        }

        // Switch turn
        if (board.turn == 'b') {
            board.turn_num++;
            board.turn = 'w';
        } else {
            board.turn = 'b';
        }

        // Update fen cache
        board.refresh();

    }

    is_stale() {
        return !(this.piece instanceof Pawn || this.captured_piece !== undefined);
    }

    capture(piece: Piece) {
        this.captured_piece = piece;
    }

    set_type(type: string) {
        type = type.toLowerCase();
        const valid_types: Array<string> = ['available', 'blocked', 'castle', 'pawn-rush', 'capture', 'en-passant', 'promote_r', 'promote_n', 'promote_b', 'promote_q'];
        let valid = false;
        for (let i = 0; i < valid_types.length; i++) {
            if (valid_types[i] === type) valid = true;
        }
        if (!valid) throw new Error(`Invalid move type: ${type}`);
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
            if (!captured_piece) throw new Error("Could not find copy of captured piece in board copy.");
        }
        if (!piece) throw new Error("Could not find copy of piece in board copy.");
        (new Move(piece, this.x, this.y, this.type, captured_piece)).execute();
        return board_copy;
    }

}

abstract class Piece implements Piece {

    static opponent(color: string) {
        return color == 'w' ? 'b' : 'w';
    }

    constructor(x: number, y: number, color: string, board: Board) {
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
            // Check if other side gets check
            const move = moves[i];
            if (move.type !== 'blocked' && move.get_result().is_check(move.piece.color == 'w' ? 'b' : 'w')) {
                move.type = 'blocked';
                move.note = `${move.piece.color == 'w' ? 'b' : 'w'} has check after this move. `;
            }
        };
        return moves;
    }

    move(pos: TilePos, done?: () => void) {
        const animate_piece = async (elem: HTMLElement | JQuery<HTMLElement>, start_left: number, start_top: number, end_left: number, end_top: number, t: number, after: () => void) => {
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
        }
        this.board.tiles[this.pos.x][this.pos.y] = undefined;
        this.board.tiles[pos.x][pos.y] = this;
        if (this.elem) {
            const start = $(`td[x=${this.pos.x}][y=${this.pos.y}]`).position();
            const end = $(`td[x=${pos.x}][y=${pos.y}]`).position();
            const elem = this.elem;
            $(elem).css("transform", `translate(0, 0)`).css('z-index', '99');
            animate_piece(elem, start.left, start.top, end.left, end.top, 0, () => {
                $(elem)
                    .remove()
                    .attr('style', '');
                if (!this.taken) {
                    this.board.place_piece_at(this, pos);
                }
                if (done) {
                    done();
                }
            });
        }
        this.pos = pos;
    }

    take() {
        this.taken = true;
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
        const moves = new Array<Move>();

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
                        } else {
                            move.set_type('available');
                        }
                    }
                }
            }
        }

        return moves;
    }

    get_diagonal_moves() {
        const moves = new Array<Move>();

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
                        } else {
                            move.set_type('available');
                        }
                    }
                }
            }
        }

        return moves;
    }
}

class Pawn extends Piece implements Piece {

    get_worth() {
        return 1;
    }

    get_moves() {
        const moves = new Array<Move>();

        // Set pawn dir
        const dir = this.color == 'w' ? 1 : -1;

        const check_promotion = (move: Move) => {
            var far_y = 7;
            if (this.color == 'b') far_y = 0;
            if (move.y == far_y) {
                const promote_move = (move: Move, type: 'r' | 'b' | 'n' | 'q') => {
                    move.set_type(`promote_${type}`);
                    move.after = (done: () => void) => {
                        this.promote_to(type);
                        done();
                    };
                }
                promote_move(move, 'q'); // queen
                const other_options: Array<'r' | 'b' | 'n'> = ['r', 'b', 'n'];
                other_options.forEach(type => {
                    const promotion = new Move(this, move.x, move.y); //others
                    if (move.captured_piece) promotion.capture(move.captured_piece);
                    moves.push(promotion);
                    promote_move(promotion, type);
                });
            }
        }

        // Check pawn rush moves
        var start_y = 1;
        if (this.color == 'b') start_y = 6;
        if (this.pos.y == start_y) {
            const move = new Move(this, this.pos.x, this.pos.y + 2 * dir);
            const en_passant = new Move(this, this.pos.x, this.pos.y + dir);
            if (Board.in_bounds(move)) {
                moves.push(move);
                if (!this.board.has_piece_at(move) && !this.board.has_piece_at(en_passant)) {
                    move.set_type('pawn-rush');
                    move.after = (done: () => void) => {
                        this.board.en_passant = en_passant;
                        done();
                    };
                }
            }
        }

        // Check capture moves (with en-passant)
        for (let x = -1; x <= 1; x += 2) {
            const capture = new Move(this, this.pos.x + x, this.pos.y + dir, 'capture');
            if (Board.in_bounds(capture)) {
                var captured_piece =
                    this.board.has_piece_at(capture, Piece.opponent(this.color)) ||
                    this.board.has_enpassant_at(capture, Piece.opponent(this.color));
                if (captured_piece) {
                    capture.capture(captured_piece);
                    moves.push(capture);
                    check_promotion(capture);
                }
            }
        }

        // Check normal moves
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

    promote_to(type: 'r' | 'b' | 'n' | 'q') {
        this.board.remove_piece(this);
        let new_piece: Piece;
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
        this.board.refresh();
        console.log(new_piece);
        if (!new_piece) throw new Error(`Could not promote to type ${type}.`);
    }

    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `https://midpoint68.github.io/chess/img/${this.board.piece_set_name}/${this.color}p.png`)
            .addClass("piece pawn");
    }

}

class Rook extends Piece implements Piece {

    get_worth() {
        return 5;
    }

    get_moves() {
        return this.get_straight_moves();
    }

    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `https://midpoint68.github.io/chess/img/${this.board.piece_set_name}/${this.color}r.png`)
            .addClass("piece rook");
    }

}

class Knight extends Piece implements Piece {

    get_worth() {
        return 3;
    }

    get_moves() {
        const moves = new Array<Move>();

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
                    } else if (piece.color != this.color) {
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
            .attr("src", `https://midpoint68.github.io/chess/img/${this.board.piece_set_name}/${this.color}n.png`)
            .addClass("piece knight");
    }

}

class Bishop extends Piece implements Piece {

    get_worth() {
        return 3;
    }

    get_moves() {
        return this.get_diagonal_moves();
    }

    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `https://midpoint68.github.io/chess/img/${this.board.piece_set_name}/${this.color}b.png`)
            .addClass("piece bishop");
    }

}

class Queen extends Piece implements Piece {

    get_worth() {
        return 9;
    }

    get_moves() {
        const moves = this.get_diagonal_moves().concat(this.get_straight_moves());
        return moves;
    }

    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `https://midpoint68.github.io/chess/img/${this.board.piece_set_name}/${this.color}q.png`)
            .addClass("piece queen");
    }

}

class King extends Piece implements Piece {

    get_worth() {
        return 2; // 2 for getting the worth of an attempted capture
    }

    get_castle_moves() {
        const moves = new Array<Move>();

        // Castling
        if (this.color == 'w') {
            if (this.board.castles.K) {
                const castle = new Move(this, 6, 0);
                moves.push(castle);
                if (!this.board.has_piece_at({ x: 5, y: 0 }) && !this.board.has_piece_at({ x: 6, y: 0 })) {
                    if (!this.board.is_check()) {
                        castle.set_type('castle');
                        castle.after = (done?: () => void) => {
                            const rook = this.board.piece_at({ x: 7, y: 0 });
                            if (!rook) throw new Error("Rook expected at H1 for castle.");
                            rook.move({ x: 5, y: 0 }, done);
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
                        castle.after = (done?: () => void) => {
                            const rook = this.board.piece_at({ x: 0, y: 0 });
                            if (!rook) throw new Error("Rook expected at A1 for castle.");
                            rook.move({ x: 3, y: 0 }, done);
                        };
                    }
                }
            }
        } else {
            if (this.board.castles.k) {
                const castle = new Move(this, 6, 7);
                moves.push(castle);
                if (!this.board.has_piece_at({ x: 5, y: 7 }) && !this.board.has_piece_at({ x: 6, y: 7 })) {
                    if (!this.board.is_check()) {
                        castle.set_type('castle');
                        castle.after = (done?: () => void) => {
                            const rook = this.board.piece_at({ x: 7, y: 7 });
                            if (!rook) throw new Error("Rook expected at H8 for castle.");
                            rook.move({ x: 5, y: 7 }, done);
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
                        castle.after = (done?: () => void) => {
                            const rook = this.board.piece_at({ x: 0, y: 7 });
                            if (!rook) throw new Error("Rook expected at A8 for castle.");
                            rook.move({ x: 3, y: 7 }, done);
                        };
                    }
                }
            }
        }

        return moves;
    }

    get_moves() {
        const moves = new Array<Move>();

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
                } else if (piece.color != this.color) {
                    move.capture(piece);
                    move.set_type('capture');
                }
            }
        }

        return moves;
    }

    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `https://midpoint68.github.io/chess/img/${this.board.piece_set_name}/${this.color}k.png`)
            .addClass("piece king");
    }

}
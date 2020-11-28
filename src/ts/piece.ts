
/// <reference path="./board.ts" />

interface TilePos {
    x: number
    y: number
}

interface Move extends TilePos {
    piece: Piece
    type: string
    tile_class: string
    origin: TilePos
    captured_piece?: Piece
    after?: () => any
}

interface Piece {
    color: string
    pos: TilePos
    board: Board
    elem: HTMLImageElement | JQuery<HTMLImageElement>
    move(pos: TilePos): void
    get_moves(): Move[]
    make_elem(): HTMLImageElement | JQuery<HTMLImageElement>
}

class Move implements Move {
    constructor(piece: Piece, x: number, y: number, type = 'blocked') {
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

    capture(piece: Piece) {
        this.captured_piece = piece;
    }

    set_type(type: string) {
        type = type.toLowerCase();
        const valid_types: Array<string> = ['available', 'blocked', 'castle', 'pawn-rush', 'promotion', 'capture', 'en-passant'];
        let valid = false;
        for (let i = 0; i < valid_types.length; i++) {
            if (valid_types[i] === type) valid = true;
        }
        if (!valid) throw new Error(`Invalid move type: ${type}`);
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

abstract class Piece implements Piece {

    static opponent(color: string) {
        return color == 'w' ? 'b' : 'w';
    }

    constructor(x: number, y: number, color: string, board: Board) {
        this.color = color;
        this.pos = { x: x, y: y };
        this.board = board;
        this.elem = this.make_elem();
        this.board.tiles[x][y] = this;
    }

    move(pos: TilePos) {
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
        const moves = new Array<Move>();

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

    get_moves() {
        const moves = new Array<Move>();

        // Set pawn dir
        const dir = this.color == 'w' ? 1 : -1;

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
                    move.after = () => {
                        this.board.en_passant = en_passant;
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
                }
            }
        }

        // Check Promotion
        var far_y = 7;
        if (this.color == 'b') far_y = 0;
        if (this.pos.y + dir == far_y) {
            const promotion = new Move(this, this.pos.x, this.pos.y + dir, 'promotion');
            if (Board.in_bounds(promotion) && !this.board.has_piece_at(promotion)) {
                moves.push(promotion);
            }
        } else {
            // Check normal moves
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

class Rook extends Piece implements Piece {

    get_moves() {
        return this.get_straight_moves();
    }

    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}r.png`)
            .addClass("piece rook");
    }

}

class Knight extends Piece implements Piece {

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
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}n.png`)
            .addClass("piece knight");
    }

}

class Bishop extends Piece implements Piece {

    get_moves() {
        return this.get_diagonal_moves();
    }

    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}b.png`)
            .addClass("piece bishop");
    }

}

class Queen extends Piece implements Piece {

    get_moves() {
        return this.get_diagonal_moves().concat(this.get_straight_moves());
    }

    make_elem() {
        return $(document.createElement("img"))
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}q.png`)
            .addClass("piece queen");
    }

}

class King extends Piece implements Piece {

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
            .attr("src", `/img/${this.board.piece_set_name}/${this.color}k.png`)
            .addClass("piece king");
    }

}
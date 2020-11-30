
/// <reference path="./piece.ts" />

interface Board {
    turn: 'w' | 'b'
    side: 'w' | 'b'
    piece_set_name: string
    halfturn_num: number
    turn_num: number
    castles: {
        K: boolean
        Q: boolean
        k: boolean
        q: boolean
    }
    king: { 'w'?: King, 'b'?: King }
    board_elem?: HTMLTableElement | JQuery<HTMLTableElement>
    tiles: Array<Array<Piece | undefined>>
    pieces: { 'w': Array<Piece>, 'b': Array<Piece> }
    en_passant?: TilePos
    no_moves?: boolean
    checkmate?: boolean
    stalemate?: boolean
    tile_onclick?: (tile: JQuery<HTMLElement> | HTMLElement, tile_code: string, x: number, y: number, piece?: Piece) => void
}

class Board implements Board {

    /**
     * STATIC VARS
     */

    static START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';



    /**
     * Evaluates if the position is on the board and returns true or false
     */

    static in_bounds(pos: TilePos) {
        return (pos.x >= 0 && pos.x < 8 && pos.y >= 0 && pos.y < 8);
    }



    /**
     * Converts a coordinate position to a standard notation
     */

    static get_tile_code(pos: TilePos) {
        return `${String.fromCharCode(('a').charCodeAt(0) + pos.x)}${pos.y + 1}`;
    }



    /**
     * Converts standard tile location to coordinates
     */

    static get_coord(tile_code: string) {
        return {
            x: tile_code.charCodeAt(0) - ('a').charCodeAt(0),
            y: parseInt(tile_code.charAt(1)) - 1
        };
    }


    /**
     * CONSTRUCTOR
     */

    constructor({
        fen_str = Board.START_FEN,
        side = 'w',
        parent_elem,
        tile_onclick
    }: {
        fen_str?: string
        side?: 'w' | 'b'
        parent_elem?: HTMLElement | JQuery<HTMLElement>
        tile_onclick?: (tile: JQuery<HTMLElement> | HTMLElement, tile_code: string, x: number, y: number, piece?: Piece) => void
    }) {

        // Set vars
        this.turn = 'w';
        this.side = side;
        this.piece_set_name = "kiffset_light";
        this.king = { 'w': undefined, 'b': undefined };
        this.tile_onclick = tile_onclick;

        // Append Board
        if (parent_elem) {
            $(parent_elem).html("");
            this.append_to(parent_elem);
        }

        // Setup the board
        this.load_fen(fen_str);

    }

    load_fen(fen_str: string) {

        const args = fen_str.split(' ');
        const ranks = args[0].split('/');
        this.turn = args[1] == 'b' ? 'b' : 'w';
        this.castles = {
            K: args[2].includes('K'),
            Q: args[2].includes('Q'),
            k: args[2].includes('k'),
            q: args[2].includes('q')
        }
        this.en_passant = Board.get_coord(args[3]);
        this.turn_num = parseInt(args[4]);
        this.halfturn_num = parseInt(args[5]);

        // Create the tile arrays
        this.tiles = new Array<Array<Piece | undefined>>(8);
        for (let i = 0; i < 8; i++) {
            this.tiles[i] = new Array<Piece | undefined>(8);
        }


        // Create the piece arrays
        this.pieces = {
            'w': new Array<Piece>(),
            'b': new Array<Piece>()
        };

        // Place the pieces
        for (let rank = 0; rank < ranks.length; rank++) {

            let file = 0;
            let char_num = 0;
            while (file < 8) {
                const char = ranks[7 - rank].charAt(char_num);
                const blank_spaces = parseInt(char);
                if (!isNaN(blank_spaces)) {
                    file += blank_spaces;
                } else {
                    let piece: Piece | undefined = undefined;
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

    append_to(elem: HTMLElement | JQuery<HTMLElement>) {

        const board = $(document.createElement("table")).addClass("chess-board");
        this.board_elem = board;

        $(elem).append(board);
        for (let row = 1; row <= 8; row++) {
            const tr = $(document.createElement("tr"));
            if (this.side == 'w') {
                board.prepend(tr);
            } else {
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
                        if (this.tile_onclick) tile_onclick(e.delegateTarget, code, x, y, piece);
                    });
                tr.append(tile);
                // Row Labels
                if (col == 0) {
                    tile.append(
                        $(document.createElement("div"))
                            .addClass("row-label")
                            .html("" + row)
                    );
                }
                // Col Labels
                if (row == 1) {
                    tile.append(
                        $(document.createElement("div"))
                            .addClass(`col-label-${this.side}`)
                            .html("" + char)
                    );
                }
            }
        }
        return board;

    }

    has_piece_at(pos: TilePos, color?: string) {
        const piece = this.piece_at(pos);
        if (piece instanceof Piece) {
            if (color) {
                if (piece.color == color) {
                    return piece;
                } else {
                    return undefined;
                }
            } else {
                return piece;
            }
        } else {
            return undefined;
        }
    }

    piece_at(pos: TilePos) {
        return this.tiles[pos.x][pos.y];
    }

    remove_piece(piece: Piece) {
        const idx = this.pieces[piece.color].findIndex(p => p == piece);
        delete this.pieces[piece.color][idx];
        piece.elem?.remove();
    }

    has_enpassant_at(pos: TilePos, color?: string) {
        if (this.en_passant && this.en_passant.x == pos.x && this.en_passant.y == pos.y) {
            const en_passant_piece = this.en_passant.y == 2 ?
                this.piece_at({ x: this.en_passant.x, y: 3 }) :
                this.piece_at({ x: this.en_passant.x, y: 4 });
            if (!en_passant_piece) throw new Error("No Piece at expected en passant position.");
            if (color) {
                if (en_passant_piece.color == color) {
                    return en_passant_piece;
                } else {
                    return undefined;
                }
            } else {
                return en_passant_piece;
            }
        } else {
            return undefined;
        }
    }

    place_piece_at(piece: Piece, pos: TilePos) {
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
                    } else if (piece instanceof Rook) {
                        fen += piece.color === 'w' ? 'R' : 'r';
                    } else if (piece instanceof Knight) {
                        fen += piece.color === 'w' ? 'N' : 'n';
                    } else if (piece instanceof Bishop) {
                        fen += piece.color === 'w' ? 'B' : 'b';
                    } else if (piece instanceof Queen) {
                        fen += piece.color === 'w' ? 'Q' : 'q';
                    } else if (piece instanceof King) {
                        fen += piece.color === 'w' ? 'K' : 'k';
                    }
                } else {
                    blank++;
                }
                file++;
            }
            if (blank > 0) {
                fen += blank;
                blank = 0;
            }
            if (rank > 0) fen += "/";
        }

        // Turn
        fen += ` ${this.turn}`;

        // Castles
        let castles = `${this.castles.K ? 'K' : ''}${this.castles.k ? 'k' : ''}${this.castles.Q ? 'Q' : ''}${this.castles.q ? 'q' : ''}`;
        if (castles.length == 0) {
            castles = '-';
        }
        fen += ` ${castles}`;

        // En Passant
        if (this.en_passant) {
            fen += ` ${Board.get_tile_code(this.en_passant)}`;
        } else {
            fen += ` -`;
        }

        // Turn Number
        fen += ` ${this.turn_num}`;

        // Halfturn Number
        fen += ` ${this.halfturn_num}`;

        return fen;
    }

    get_moves(valid = true, side?: 'w' | 'b') {
        let moves = new Array<Move>();
        const pieces = this.pieces[side ?? this.turn];
        pieces.forEach(piece => {
            moves = moves.concat(valid ? piece.get_valid_moves() : piece.get_moves());
        });
        return moves;
    }

    get_executable_moves() {
        const moves = this.get_moves();
        const exe_moves = new Array<Move>();
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            if (move.type !== 'blocked') {
                exe_moves.push(move);
            }
        }
        return exe_moves;
    }

    is_check(side?: 'w' | 'b') {
        const offence = side ?? (this.turn == 'w' ? 'b' : 'w');
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

        // Check if there are any available valid moves
        for (let i = 0; i < defence_moves.length; i++) {
            if (defence_moves[i].type !== 'blocked') {
                return false;
            }
        }

        return true;
    }


    /**
     * Positive value is advantage for white, negative is advantage for black
     */
    get_value() {
        const no_moves = this.has_no_moves();
        const check = this.is_check();
        const checkmate = check && no_moves;
        const stalemate = !check && no_moves;
        if (checkmate) return this.turn == 'b' ? Infinity : -Infinity;
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